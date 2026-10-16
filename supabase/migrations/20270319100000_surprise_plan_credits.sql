-- KUMANI Sorpresa inclusa nel piano: chi ha Base o Pro ha alcune sorprese già
-- pagate (quota che si ricarica ogni mese o ogni 3 mesi, per tipo) e in più un
-- percorso di 3 giorni in regalo a ogni attivazione/rinnovo dell'abbonamento e
-- nelle feste (San Valentino, Festa del papà, Festa della mamma, Natale).
-- Quantità e regali li decide l'Admin (0 = niente). La sorpresa si attiva
-- subito, come dopo il pagamento con la carta o con i punti.

alter table public.surprise_gifts drop constraint if exists surprise_gifts_paid_with_check;
alter table public.surprise_gifts
  add constraint surprise_gifts_paid_with_check check (paid_with in ('card', 'karma', 'ku_points', 'plan')),
  -- Quale sorpresa inclusa è stata usata: 'quota', 'rinnovo:<scadenza>' o 'festa:<festa>-<anno>'
  add column if not exists plan_credit text;

-- Un regalo (rinnovo o festa) si usa una volta sola
create unique index if not exists surprise_gifts_plan_bonus_idx
  on public.surprise_gifts (user_id, plan_credit)
  where plan_credit like 'rinnovo:%' or plan_credit like 'festa:%';
create index if not exists surprise_gifts_plan_quota_idx
  on public.surprise_gifts (user_id, kind, paid_at)
  where plan_credit = 'quota';

-- Quote predefinite: <piano>_<tipo> = quante, <piano>_<tipo>_months = ogni quanti mesi (1, 3 o 12)
insert into public.system_settings (key, value) values
  ('surprise_plan_base_voucher', '3'),
  ('surprise_plan_base_voucher_months', '1'),
  ('surprise_plan_base_journey3', '1'),
  ('surprise_plan_base_journey3_months', '3'),
  ('surprise_plan_base_journey7', '0'),
  ('surprise_plan_base_journey7_months', '3'),
  ('surprise_plan_pro_voucher', '10'),
  ('surprise_plan_pro_voucher_months', '1'),
  ('surprise_plan_pro_journey3', '1'),
  ('surprise_plan_pro_journey3_months', '1'),
  ('surprise_plan_pro_journey7', '1'),
  ('surprise_plan_pro_journey7_months', '3'),
  -- Percorso di 3 giorni in regalo (1 = sì, 0 = no)
  ('surprise_bonus_renewal', '1'),
  ('surprise_bonus_feste', '1')
on conflict (key) do nothing;

-- Pagamento, stato e link li decide solo il server (ora anche quale sorpresa inclusa)
create or replace function public.surprise_gifts_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.public_token := null;
    new.paid_at := null;
    new.amount_cents := null;
    new.stripe_session_id := null;
    new.stripe_payment_intent := null;
    new.refunded_at := null;
    new.opened_at := null;
    new.link_opened_at := null;
    new.paid_with := null;
    new.points_spent := null;
    new.plan_credit := null;
  else
    new.status := old.status;
    new.public_token := old.public_token;
    new.paid_at := old.paid_at;
    new.amount_cents := old.amount_cents;
    new.stripe_session_id := old.stripe_session_id;
    new.stripe_payment_intent := old.stripe_payment_intent;
    new.refunded_at := old.refunded_at;
    new.opened_at := old.opened_at;
    new.link_opened_at := old.link_opened_at;
    new.paid_with := old.paid_with;
    new.points_spent := old.points_spent;
    new.plan_credit := old.plan_credit;
    new.user_id := old.user_id;
    if old.status = 'active' then
      new.kind := old.kind;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Festa in corso (giorno di Roma): chiave 'festa:<nome>-<anno>' oppure null.
-- San Valentino 1-14 febbraio, Festa del papà 12-19 marzo, Festa della mamma
-- la settimana fino alla seconda domenica di maggio, Natale 1-25 dicembre.
create or replace function public.surprise_festa_now()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  d date := (now() at time zone 'Europe/Rome')::date;
  y int := extract(year from d)::int;
  first_may date := make_date(y, 5, 1);
  mamma date := first_may + ((7 - extract(dow from first_may)::int) % 7) + 7;
begin
  if d between make_date(y, 2, 1) and make_date(y, 2, 14) then return 'festa:san-valentino-' || y; end if;
  if d between make_date(y, 3, 12) and make_date(y, 3, 19) then return 'festa:papa-' || y; end if;
  if d between mamma - 7 and mamma then return 'festa:mamma-' || y; end if;
  if d between make_date(y, 12, 1) and make_date(y, 12, 25) then return 'festa:natale-' || y; end if;
  return null;
end;
$$;

-- Sorprese incluse di un utente: piano, quota per tipo (quante, usate, ogni
-- quanti mesi, da quando si conta) e regali disponibili adesso.
create or replace function public.surprise_plan_status(p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_plan text := coalesce(public.plan_of(p_uid), 'none');
  v_profile record;
  v_quota jsonb := '{}'::jsonb;
  v_bonus jsonb := '[]'::jsonb;
  v_kind text;
  v_n int;
  v_months int;
  v_from timestamptz;
  v_used int;
  v_key text;
  v_rome timestamp := now() at time zone 'Europe/Rome';
begin
  if v_plan not in ('base', 'pro') then
    return jsonb_build_object('plan', v_plan, 'quota', v_quota, 'bonus', v_bonus);
  end if;

  foreach v_kind in array array['voucher', 'journey3', 'journey7'] loop
    v_n := greatest(public.setting_int('surprise_plan_' || v_plan || '_' || v_kind, 0), 0);
    v_months := public.setting_int('surprise_plan_' || v_plan || '_' || v_kind || '_months', 1);
    v_from := (case
      when v_months = 12 then date_trunc('year', v_rome)
      when v_months = 3 then date_trunc('quarter', v_rome)
      else date_trunc('month', v_rome)
    end) at time zone 'Europe/Rome';
    select count(*) into v_used from public.surprise_gifts g
    where g.user_id = p_uid and g.plan_credit = 'quota' and g.kind = v_kind and g.paid_at >= v_from;
    v_quota := v_quota || jsonb_build_object(v_kind, jsonb_build_object(
      'total', v_n, 'used', v_used, 'left', greatest(v_n - v_used, 0),
      'months', case when v_months in (3, 12) then v_months else 1 end, 'since', v_from));
  end loop;

  -- Regalo del rinnovo: uno per ogni periodo di abbonamento pagato (non per la prova Pro)
  select subscription_status, subscription_expires_at into v_profile from public.profiles where id = p_uid;
  if public.setting_int('surprise_bonus_renewal', 1) = 1
     and v_profile.subscription_status = 'active'
     and (v_profile.subscription_expires_at is null or v_profile.subscription_expires_at > now()) then
    v_key := 'rinnovo:' || coalesce(to_char(v_profile.subscription_expires_at at time zone 'Europe/Rome', 'YYYY-MM-DD'), 'sempre');
    if not exists (select 1 from public.surprise_gifts g where g.user_id = p_uid and g.plan_credit = v_key) then
      v_bonus := v_bonus || jsonb_build_object('key', v_key, 'reason', 'rinnovo', 'kind', 'journey3');
    end if;
  end if;

  -- Regalo della festa in corso
  v_key := public.surprise_festa_now();
  if public.setting_int('surprise_bonus_feste', 1) = 1 and v_key is not null
     and not exists (select 1 from public.surprise_gifts g where g.user_id = p_uid and g.plan_credit = v_key) then
    v_bonus := v_bonus || jsonb_build_object('key', v_key, 'reason', split_part(v_key, ':', 2), 'kind', 'journey3');
  end if;

  return jsonb_build_object('plan', v_plan, 'quota', v_quota, 'bonus', v_bonus);
end;
$$;
revoke all on function public.surprise_plan_status(uuid) from public, anon, authenticated;

-- Per chi è collegato
create or replace function public.my_surprise_plan()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.surprise_plan_status(auth.uid());
$$;
revoke all on function public.my_surprise_plan() from public, anon;
grant execute on function public.my_surprise_plan() to authenticated;

-- Attiva una sorpresa in bozza con il piano. Si usa per prima la festa in corso
-- (scade presto), poi la quota del periodo, poi il regalo del rinnovo.
-- Tutto in un'unica transazione; le richieste dello stesso utente vanno in fila.
create or replace function public.claim_surprise_with_plan(p_gift_id uuid)
returns table (success boolean, reason text, credit text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gift record;
  v_status jsonb;
  v_credit text;
  v_b jsonb;
begin
  if v_uid is null then
    return query select false, 'not_logged_in', null::text;
    return;
  end if;

  -- In fila per utente: due richieste insieme non usano la stessa sorpresa inclusa
  perform 1 from public.profiles where id = v_uid for update;

  select g.id, g.kind, g.status, g.title, g.recipient_name into v_gift
  from public.surprise_gifts g
  where g.id = p_gift_id and g.user_id = v_uid
  for update;
  if not found then
    return query select false, 'not_found', null::text;
    return;
  end if;
  if v_gift.status <> 'draft' then
    return query select false, 'already_active', null::text;
    return;
  end if;
  if v_gift.kind not in ('voucher', 'journey3', 'journey7') or trim(coalesce(v_gift.title, '')) = '' or trim(coalesce(v_gift.recipient_name, '')) = '' then
    return query select false, 'incomplete', null::text;
    return;
  end if;

  v_status := public.surprise_plan_status(v_uid);
  if v_status ->> 'plan' not in ('base', 'pro') then
    return query select false, 'no_plan', null::text;
    return;
  end if;

  for v_b in select * from jsonb_array_elements(v_status -> 'bonus') loop
    if v_b ->> 'kind' = v_gift.kind and v_b ->> 'reason' <> 'rinnovo' then
      v_credit := v_b ->> 'key';
    end if;
  end loop;
  if v_credit is null and coalesce((v_status -> 'quota' -> v_gift.kind ->> 'left')::int, 0) > 0 then
    v_credit := 'quota';
  end if;
  if v_credit is null then
    for v_b in select * from jsonb_array_elements(v_status -> 'bonus') loop
      if v_b ->> 'kind' = v_gift.kind and v_b ->> 'reason' = 'rinnovo' then
        v_credit := v_b ->> 'key';
      end if;
    end loop;
  end if;
  if v_credit is null then
    return query select false, 'none_left', null::text;
    return;
  end if;

  update public.surprise_gifts
  set status = 'active',
      public_token = coalesce(public_token, replace(gen_random_uuid()::text, '-', '')),
      paid_at = now(),
      amount_cents = 0,
      paid_with = 'plan',
      plan_credit = v_credit,
      start_at = coalesce(start_at, now())
  where id = v_gift.id;

  return query select true, null::text, v_credit;
end;
$$;
revoke all on function public.claim_surprise_with_plan(uuid) from public, anon;
grant execute on function public.claim_surprise_with_plan(uuid) to authenticated;
