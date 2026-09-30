-- Nuovo sistema dei Punti Rete.
--
-- Punti:
-- - attivazione pagata con carta di un invitato diretto: Base 49, Pro 122;
--   passaggio a Pro di un invitato diretto: 60. Li riceve solo lo sponsor
--   diretto, una volta per fattura Stripe (webhook invoice.paid). Voucher e
--   rinnovi non danno punti. Un rimborso li toglie.
-- - Bonus Struttura (posti riempiti nella propria matrice): invariato, 5.
-- - Tolti: bonus qualifica, bonus dal 6° diretto, ringraziamento attività,
--   extra Pro da dashboard (funzioni lasciate nel database ma non più
--   eseguibili dagli utenti).
--
-- Voucher:
-- - pacchetti che consumano punti e danno credito voucher in euro:
--   294 punti = 49 €, 1800 = 294 €, 5500 = 980 € (ripetibili);
-- - con il credito si creano voucher Base (49 €) o Pro (149 €), da regalare
--   o vendere (prezzo facoltativo); un voucher non usato si può annullare e
--   il credito torna disponibile.
--
-- Qualifiche (Kuman Green / Star / Black): solo badge, raggiunti con i punti
-- rete guadagnati in totale (294 / 1800 / 5500, le stesse soglie dei
-- pacchetti). Nessun premio collegato.
--
-- KU Points: quantità per attività modificabili dall'Admin (ku_activity_points).
-- Tutti i valori sono in system_settings (Admin → Impostazioni → Punti Rete).

-- ---------------------------------------------------------------------------
-- Impostazioni
-- ---------------------------------------------------------------------------
insert into public.system_settings (key, value) values
  ('network_points_activation_base', '49'),
  ('network_points_activation_pro', '122'),
  ('network_points_upgrade_pro', '60'),
  ('voucher_packs', '[{"points":294,"credit_eur":49},{"points":1800,"credit_eur":294},{"points":5500,"credit_eur":980}]'),
  ('voucher_value_base_eur', '49'),
  ('voucher_value_pro_eur', '149')
on conflict (key) do nothing;

-- Bonus Struttura a 5 punti, ringraziamento attività a 0
update public.system_settings set value = '5' where key in ('matrix_slot_bonus_points', 'matrix_spillover_bonus_points');
insert into public.system_settings (key, value) values ('matrix_slot_bonus_points', '5'), ('matrix_spillover_bonus_points', '5')
on conflict (key) do nothing;
update public.system_settings set value = '0' where key = 'activity_thanks_points';

create or replace function public.setting_int(p_key text, p_default integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(trim(both '"' from value), '')::int from public.system_settings where key = p_key),
    p_default
  );
$$;
revoke all on function public.setting_int(text, integer) from public, anon, authenticated;

-- Pacchetti voucher ordinati per punti: [{points, credit_eur}, ...]
create or replace function public.voucher_packs()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_agg(p order by (p ->> 'points')::int)
     from jsonb_array_elements(
       (select value::jsonb from public.system_settings where key = 'voucher_packs')
     ) p
     where (p ->> 'points')::int > 0 and (p ->> 'credit_eur')::int > 0),
    '[{"points":294,"credit_eur":49},{"points":1800,"credit_eur":294},{"points":5500,"credit_eur":980}]'::jsonb
  );
$$;
grant execute on function public.voucher_packs() to authenticated;

-- ---------------------------------------------------------------------------
-- Profilo: punti guadagnati in totale (badge) e credito voucher in euro
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists network_points_earned_total integer not null default 0,
  add column if not exists voucher_credit_cents integer not null default 0 check (voucher_credit_cents >= 0);

-- Nuove colonne mai impostabili dal browser: in modifica le protegge già
-- profiles_guard_privileged_columns (whitelist); qui anche in creazione.
create or replace function public.profiles_guard_network_wallet()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.network_points_earned_total := 0;
    new.voucher_credit_cents := 0;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_guard_network_wallet on public.profiles;
create trigger profiles_guard_network_wallet
  before insert on public.profiles
  for each row execute function public.profiles_guard_network_wallet();

-- Punto di partenza: i punti attuali contano come già guadagnati
update public.profiles set network_points_earned_total = coalesce(network_points, 0)
where network_points_earned_total = 0 and coalesce(network_points, 0) > 0;

-- ---------------------------------------------------------------------------
-- Registro dei punti rete assegnati (attivazioni, passaggi a Pro, Bonus
-- Struttura). stripe_invoice_id unico: il webhook ripetuto non raddoppia.
-- ---------------------------------------------------------------------------
create table if not exists public.network_point_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_user_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('activation_base', 'activation_pro', 'upgrade_pro', 'matrix')),
  points integer not null check (points > 0),
  stripe_invoice_id text unique,
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists network_point_awards_user_idx on public.network_point_awards (user_id, created_at desc);
alter table public.network_point_awards enable row level security;
drop policy if exists network_point_awards_select_own on public.network_point_awards;
create policy network_point_awards_select_own on public.network_point_awards
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.network_point_awards from anon, authenticated;

-- Badge raggiunti con i punti guadagnati: registra la data della prima volta
create or replace function public.record_network_badges(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earned int;
  v_packs jsonb := public.voucher_packs();
  v_keys text[] := array['rising_star', 'shining_star', 'diamond_star'];
  i int;
begin
  select coalesce(network_points_earned_total, 0) into v_earned from public.profiles where id = p_user;
  for i in 1 .. least(3, jsonb_array_length(v_packs)) loop
    if v_earned >= (v_packs -> (i - 1) ->> 'points')::int then
      insert into public.rank_achievements (user_id, rank_key, achieved_at)
      values (p_user, v_keys[i], now())
      on conflict do nothing;
    end if;
  end loop;
end;
$$;
revoke all on function public.record_network_badges(uuid) from public, anon, authenticated;

-- Accredito dei punti per un'attivazione pagata con carta (chiamata dal
-- webhook Stripe con la chiave di servizio). Solo sponsor diretto, niente
-- punti al conto KUMANI.
create or replace function public.award_activation_points(p_invoice_id text, p_customer uuid, p_kind text)
returns table (awarded boolean, sponsor_id uuid, points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor uuid;
  v_points int;
  v_house text := public.setting_text('house_account_id');
  v_id uuid;
begin
  if p_kind not in ('activation_base', 'activation_pro', 'upgrade_pro') or p_invoice_id is null then
    return query select false, null::uuid, 0;
    return;
  end if;

  select p.sponsor_id into v_sponsor from public.profiles p where p.id = p_customer;
  if v_sponsor is null or v_sponsor::text = coalesce(v_house, '') then
    return query select false, v_sponsor, 0;
    return;
  end if;

  v_points := case p_kind
    when 'activation_base' then public.setting_int('network_points_activation_base', 49)
    when 'activation_pro' then public.setting_int('network_points_activation_pro', 122)
    else public.setting_int('network_points_upgrade_pro', 60)
  end;
  if v_points <= 0 then
    return query select false, v_sponsor, 0;
    return;
  end if;

  insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id)
  values (v_sponsor, p_customer, p_kind, v_points, p_invoice_id)
  on conflict (stripe_invoice_id) do nothing
  returning id into v_id;

  if v_id is null then
    return query select false, v_sponsor, 0;
    return;
  end if;

  update public.profiles
  set network_points = coalesce(network_points, 0) + v_points,
      network_points_earned_total = coalesce(network_points_earned_total, 0) + v_points
  where id = v_sponsor;

  perform public.record_network_badges(v_sponsor);
  return query select true, v_sponsor, v_points;
end;
$$;
revoke all on function public.award_activation_points(text, uuid, text) from public, anon, authenticated;
grant execute on function public.award_activation_points(text, uuid, text) to service_role;

-- Rimborso di una fattura: toglie i punti assegnati per quella fattura
-- (senza andare sotto zero). I badge già raggiunti restano.
create or replace function public.reverse_activation_points(p_invoice_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.network_point_awards;
begin
  update public.network_point_awards
  set reversed_at = now()
  where stripe_invoice_id = p_invoice_id and reversed_at is null
  returning * into v_row;

  if v_row.id is null then
    return 0;
  end if;

  update public.profiles
  set network_points = greatest(coalesce(network_points, 0) - v_row.points, 0),
      network_points_earned_total = greatest(coalesce(network_points_earned_total, 0) - v_row.points, 0)
  where id = v_row.user_id;
  return v_row.points;
end;
$$;
revoke all on function public.reverse_activation_points(text) from public, anon, authenticated;
grant execute on function public.reverse_activation_points(text) to service_role;

-- ---------------------------------------------------------------------------
-- Bonus Struttura: come prima, in più conta nei punti guadagnati (badge) e
-- finisce nel registro.
-- ---------------------------------------------------------------------------
create or replace function public.claim_matrix_slot_bonus()
returns table (success boolean, awarded integer, direct_slots_paid integer, spillover_slots_paid integer, new_network_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_node_id uuid;
  v_active_direct int;
  v_active_spillover int;
  v_already_direct int;
  v_already_spillover int;
  v_new_direct int;
  v_new_spillover int;
  v_rate_direct int;
  v_rate_spillover int;
  v_awarded int;
  v_balance int;
begin
  if auth.uid() is null then
    return;
  end if;

  select id into v_my_node_id from matrix_nodes where user_id = auth.uid();
  if v_my_node_id is null then
    return query select false, 0, 0, 0, coalesce((select network_points from profiles where id = auth.uid()), 0);
    return;
  end if;

  select
    count(*) filter (where p.sponsor_id = auth.uid()),
    count(*) filter (where p.sponsor_id is distinct from auth.uid() and p.signup_source <> 'direct')
  into v_active_direct, v_active_spillover
  from matrix_nodes child
  join profiles p on p.id = child.user_id
  where child.parent_id = v_my_node_id
    and p.subscription_status = 'active'
    and p.subscription_source = 'stripe'
    and (p.subscription_expires_at is null or p.subscription_expires_at > now());

  select coalesce(matrix_bonus_direct_slots_paid, 0), coalesce(matrix_bonus_spillover_slots_paid, 0)
  into v_already_direct, v_already_spillover
  from profiles where id = auth.uid();

  v_new_direct := greatest(v_active_direct - v_already_direct, 0);
  v_new_spillover := greatest(v_active_spillover - v_already_spillover, 0);

  if v_new_direct = 0 and v_new_spillover = 0 then
    select coalesce(network_points, 0) into v_balance from profiles where id = auth.uid();
    return query select false, 0, v_already_direct, v_already_spillover, v_balance;
    return;
  end if;

  v_rate_direct := public.setting_int('matrix_slot_bonus_points', 5);
  v_rate_spillover := public.setting_int('matrix_spillover_bonus_points', 5);
  v_awarded := v_new_direct * v_rate_direct + v_new_spillover * v_rate_spillover;

  update profiles
  set
    network_points = coalesce(network_points, 0) + v_awarded,
    network_points_earned_total = coalesce(network_points_earned_total, 0) + v_awarded,
    matrix_bonus_direct_slots_paid = greatest(v_active_direct, v_already_direct),
    matrix_bonus_spillover_slots_paid = greatest(v_active_spillover, v_already_spillover)
  where id = auth.uid()
    and coalesce(matrix_bonus_direct_slots_paid, 0) = v_already_direct
    and coalesce(matrix_bonus_spillover_slots_paid, 0) = v_already_spillover
  returning network_points into v_balance;

  if not found then
    select coalesce(network_points, 0) into v_balance from profiles where id = auth.uid();
    return query select false, 0, v_already_direct, v_already_spillover, v_balance;
    return;
  end if;

  if v_awarded > 0 then
    insert into public.network_point_awards (user_id, kind, points) values (auth.uid(), 'matrix', v_awarded);
    perform public.record_network_badges(auth.uid());
  end if;

  return query select true, v_awarded, greatest(v_active_direct, v_already_direct), greatest(v_active_spillover, v_already_spillover), v_balance;
end;
$$;

-- Vecchi bonus: non più eseguibili dagli utenti (le funzioni restano)
revoke execute on function public.claim_rank_bonus(text) from public, anon, authenticated;
revoke execute on function public.claim_sponsor_overflow_bonus() from public, anon, authenticated;
revoke execute on function public.claim_activity_thanks() from public, anon, authenticated;
revoke execute on function public.claim_pro_invite_bonus() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Qualifiche come badge sui punti guadagnati: le date registrate col vecchio
-- criterio (numero di diretti) si azzerano.
-- ---------------------------------------------------------------------------
delete from public.rank_achievements;

create or replace function public.my_rank_achievements()
returns table (rank_key text, achieved_at timestamptz, days integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;
  perform public.record_network_badges(v_uid);
  return query
  select a.rank_key, a.achieved_at,
         greatest(0, ((a.achieved_at at time zone 'Europe/Rome')::date - (p.created_at at time zone 'Europe/Rome')::date))::int
  from public.rank_achievements a
  join public.profiles p on p.id = a.user_id
  where a.user_id = v_uid;
end;
$$;

-- Punti, credito voucher e pacchetti dell'utente (Portafoglio, Rete)
create or replace function public.my_network_wallet()
returns table (
  network_points integer,
  earned_total integer,
  voucher_credit_cents integer,
  packs jsonb,
  voucher_value_base_eur integer,
  voucher_value_pro_eur integer
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.network_points, 0), coalesce(p.network_points_earned_total, 0), coalesce(p.voucher_credit_cents, 0),
         public.voucher_packs(),
         public.setting_int('voucher_value_base_eur', 49),
         public.setting_int('voucher_value_pro_eur', 149)
  from public.profiles p
  where p.id = auth.uid();
$$;
grant execute on function public.my_network_wallet() to authenticated;

-- ---------------------------------------------------------------------------
-- Pacchetti voucher: si spendono i punti, si riceve credito in euro
-- ---------------------------------------------------------------------------
create table if not exists public.voucher_credit_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('pack', 'voucher', 'voucher_cancelled')),
  points_spent integer not null default 0,
  cents integer not null,
  voucher_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists voucher_credit_movements_user_idx on public.voucher_credit_movements (user_id, created_at desc);
alter table public.voucher_credit_movements enable row level security;
drop policy if exists voucher_credit_movements_select_own on public.voucher_credit_movements;
create policy voucher_credit_movements_select_own on public.voucher_credit_movements
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.voucher_credit_movements from anon, authenticated;

create or replace function public.redeem_voucher_pack(p_index integer)
returns table (success boolean, reason text, new_network_points integer, new_credit_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack jsonb;
  v_points int;
  v_cents int;
  v_spend record;
  v_credit int;
begin
  if auth.uid() is null then
    return;
  end if;
  v_pack := public.voucher_packs() -> p_index;
  if v_pack is null then
    return query select false, 'not_found', coalesce((select network_points from profiles where id = auth.uid()), 0), coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;
  v_points := (v_pack ->> 'points')::int;
  v_cents := (v_pack ->> 'credit_eur')::int * 100;

  select * into v_spend from public.spend_network_points(v_points);
  if not v_spend.success then
    return query select false, 'insufficient_points', v_spend.new_network_points, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  update profiles set voucher_credit_cents = coalesce(voucher_credit_cents, 0) + v_cents
  where id = auth.uid()
  returning voucher_credit_cents into v_credit;

  insert into public.voucher_credit_movements (user_id, kind, points_spent, cents) values (auth.uid(), 'pack', v_points, v_cents);
  return query select true, null::text, v_spend.new_network_points, v_credit;
end;
$$;
grant execute on function public.redeem_voucher_pack(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Voucher creati col credito: piano, uso (regalo/vendita), prezzo, costo
-- ---------------------------------------------------------------------------
alter table public.subscription_vouchers
  add column if not exists plan text check (plan in ('base', 'pro')),
  add column if not exists purpose text check (purpose in ('gift', 'sale')),
  add column if not exists sale_price_cents integer check (sale_price_cents >= 0),
  add column if not exists buyer_name text check (char_length(buyer_name) <= 200),
  add column if not exists sold_at timestamptz,
  add column if not exists cost_cents integer check (cost_cents >= 0);

drop function if exists public.create_subscription_voucher();

create or replace function public.create_subscription_voucher(p_plan text, p_purpose text, p_price_cents integer)
returns table (success boolean, reason text, code text, new_credit_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost int;
  v_credit int;
  v_code text;
  v_id uuid;
  v_attempt int := 0;
begin
  if auth.uid() is null then
    return;
  end if;
  if p_plan not in ('base', 'pro') or p_purpose not in ('gift', 'sale') or (p_price_cents is not null and p_price_cents < 0) then
    return query select false, 'invalid', null::text, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  v_cost := case p_plan when 'pro' then public.setting_int('voucher_value_pro_eur', 149) else public.setting_int('voucher_value_base_eur', 49) end * 100;

  update profiles set voucher_credit_cents = voucher_credit_cents - v_cost
  where id = auth.uid() and voucher_credit_cents >= v_cost
  returning voucher_credit_cents into v_credit;
  if not found then
    return query select false, 'insufficient_credit', null::text, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := 'KV-' || (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 10)
    );
    begin
      insert into subscription_vouchers (code, created_by, status, plan, purpose, sale_price_cents, cost_cents)
      values (v_code, auth.uid(), 'active', p_plan, p_purpose, case when p_purpose = 'sale' then p_price_cents end, v_cost)
      returning id into v_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'voucher_code_generation_failed';
      end if;
    end;
  end loop;

  insert into public.voucher_credit_movements (user_id, kind, cents, voucher_id) values (auth.uid(), 'voucher', -v_cost, v_id);
  return query select true, null::text, v_code, v_credit;
end;
$$;
grant execute on function public.create_subscription_voucher(text, text, integer) to authenticated;

-- Annulla un proprio voucher non ancora usato: il credito torna disponibile
create or replace function public.cancel_my_voucher(p_voucher_id uuid)
returns table (success boolean, new_credit_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost int;
  v_credit int;
begin
  if auth.uid() is null then
    return;
  end if;
  update subscription_vouchers set status = 'revoked'
  where id = p_voucher_id and created_by = auth.uid() and status = 'active' and cost_cents is not null
  returning cost_cents into v_cost;
  if not found then
    return query select false, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;
  update profiles set voucher_credit_cents = voucher_credit_cents + v_cost where id = auth.uid()
  returning voucher_credit_cents into v_credit;
  insert into public.voucher_credit_movements (user_id, kind, cents, voucher_id) values (auth.uid(), 'voucher_cancelled', v_cost, p_voucher_id);
  return query select true, v_credit;
end;
$$;
grant execute on function public.cancel_my_voucher(uuid) to authenticated;

-- Il piano del voucher (se creato col credito) vale più di quello del lotto
create or replace function public.redeem_subscription_voucher(p_code text)
returns table (success boolean, reason text, new_expires_at timestamptz)
security definer
set search_path = public
language plpgsql
as $$
declare
  v_id uuid;
  v_created_by uuid;
  v_status text;
  v_plan text;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;

  select v.id, v.created_by, v.status, coalesce(v.plan, b.plan, 'base')
  into v_id, v_created_by, v_status, v_plan
  from subscription_vouchers v
  left join voucher_batches b on b.id = v.batch_id
  where v.code = upper(trim(p_code));

  if v_id is null then
    return query select false, 'not_found', null::timestamptz;
    return;
  end if;

  if v_created_by = auth.uid() then
    return query select false, 'self_redemption', null::timestamptz;
    return;
  end if;

  if v_status <> 'active' then
    return query select false, 'already_used', null::timestamptz;
    return;
  end if;

  update subscription_vouchers
  set status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = now()
  where id = v_id and status = 'active';

  if not found then
    return query select false, 'already_used', null::timestamptz;
    return;
  end if;

  v_expires := now() + interval '1 year';

  update profiles p
  set subscription_status = 'active',
      subscription_expires_at = v_expires,
      subscription_source = 'voucher',
      subscription_plan = case
        when v_plan = 'pro' then 'pro'
        when p.subscription_plan = 'pro' and p.subscription_status = 'active'
          and (p.subscription_expires_at is null or p.subscription_expires_at > now()) then 'pro'
        else 'base'
      end
  where p.id = auth.uid();

  return query select true, null::text, v_expires;
end;
$$;
grant execute on function public.redeem_subscription_voucher(text) to authenticated;

-- ---------------------------------------------------------------------------
-- KU Points per attività, modificabili dall'Admin (Gestione KU)
-- ---------------------------------------------------------------------------
create table if not exists public.ku_activity_points (
  key text primary key,
  label text not null,
  points integer not null default 1 check (points >= 0 and points <= 100),
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);
alter table public.ku_activity_points enable row level security;
revoke all on public.ku_activity_points from anon, authenticated;

insert into public.ku_activity_points (key, label, sort_order) values
  ('daily_login', 'Accesso giornaliero', 1),
  ('link-in-bio', 'Link in bio', 10), ('memolife', 'MemoLife', 10), ('neurobalance', 'NeuroBalance', 10),
  ('svat', 'SVAT', 10), ('offermaker', 'OfferMaker', 10), ('qr-code-pro', 'QR Code Pro', 10),
  ('life-calendar', 'Life Calendar', 10), ('findo', 'Findo', 10), ('digital-receipt', 'Ricevute digitali', 10),
  ('spendly', 'Spendly', 10), ('fidelity', 'Fidelity', 10), ('kumani-cv', 'KUMANI CV', 10),
  ('preventivi', 'Preventivi', 10), ('menu', 'KUMANI Menu', 10), ('veritas', 'Veritas', 10),
  ('travel', 'Viaggi', 10), ('events', 'Eventi', 10), ('verifoto', 'VeriFoto', 10),
  ('timebank', 'Banca del Tempo', 10), ('magazzino', 'Magazzino', 10), ('mosaic', 'Mosaic', 10),
  ('fabula', 'Fabula', 10), ('checkmail', 'CheckMail', 10), ('oxygen', 'Oxygen', 10),
  ('documento-sicuro', 'Documento Sicuro', 10), ('verifica-iban', 'Verifica IBAN', 10),
  ('firma-email', 'Firma Email', 10), ('calcolatrici', 'Calcolatrici', 10), ('focus', 'KUMANI Focus', 10)
on conflict (key) do nothing;

create or replace function public.ku_points_for(p_key text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select points from public.ku_activity_points where key = p_key), 1);
$$;
revoke all on function public.ku_points_for(text) from public, anon, authenticated;

create or replace function public.award_daily_login_point()
returns table (awarded boolean, new_daily_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_points int;
  v_ku int := public.ku_points_for('daily_login');
begin
  if auth.uid() is null then
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku,
      last_daily_login = v_today
  where id = auth.uid()
    and (last_daily_login is null or last_daily_login < v_today)
  returning daily_points into v_points;

  if not found then
    select coalesce(daily_points, 0) into v_points from profiles where id = auth.uid();
    return query select false, v_points;
    return;
  end if;
  insert into public.login_day_counts (user_id, days) values (auth.uid(), 1)
  on conflict (user_id) do update set days = login_day_counts.days + 1;
  return query select v_ku > 0, v_points;
end;
$$;

CREATE OR REPLACE FUNCTION public.award_tool_point(p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
  v_ku int;
begin
  if auth.uid() is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus'
  ) then
    return;
  end if;

  -- Niente punti per strumenti non inclusi nel piano (evita di raccogliere
  -- KU chiamando la funzione direttamente senza usare lo strumento).
  if not exists (select 1 from public.tool_access(auth.uid(), p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (auth.uid(), p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = auth.uid();
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = auth.uid()
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;

create or replace function public.timebank_award_point(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
  v_ku int := public.ku_points_for('timebank');
begin
  if public.timebank_blocked(p_uid) then
    return;
  end if;
  insert into public.daily_tool_points (user_id, tool_name, awarded_on)
  values (p_uid, 'timebank', (now() at time zone 'Europe/Rome')::date)
  on conflict (user_id, tool_name, awarded_on) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 and v_ku > 0 then
    update public.profiles set daily_points = coalesce(daily_points, 0) + v_ku, ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
    where id = p_uid;
  end if;
end;
$$;
