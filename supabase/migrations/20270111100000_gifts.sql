-- Regali: un Kumano paga con carta 1–10 codici regalo, per il Pass di un
-- servizio (1 anno) oppure per un anno di KUMANI Base o Pro, e li manda a chi
-- vuole. Chi riceve il link /regalo/CODICE si iscrive (o accede) e attiva il
-- regalo per sé.
--   - I codici si attivano entro 1 anno dall'acquisto; chi compra non può
--     attivare i propri.
--   - Niente KU Points sui regali: lo sponsor (chi regala, se il destinatario
--     si iscrive dal link) li riceve solo quando il destinatario si abbona
--     pagando (come sempre, dalla fattura Stripe dell'abbonamento).
--   - Rimborso del pagamento: i codici non ancora attivati vengono annullati.
--   - Chi arriva con il regalo di un Pass, senza piano, vede una dashboard
--     essenziale (profiles.gift_welcome) finché non la chiude o si abbona.

create table if not exists public.gift_orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('pass', 'plan')),
  tool text,
  plan text check (plan in ('base', 'pro')),
  quantity integer not null check (quantity between 1 and 10),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  amount_cents integer not null check (amount_cents >= 0),
  message text check (char_length(message) <= 300),
  locale text,
  stripe_session_id text not null unique,
  stripe_payment_intent text,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gift_orders_item check ((kind = 'pass' and tool is not null and plan is null) or (kind = 'plan' and plan is not null and tool is null))
);
create index if not exists gift_orders_buyer_idx on public.gift_orders (buyer_id, created_at desc);
create index if not exists gift_orders_payment_idx on public.gift_orders (stripe_payment_intent);

create table if not exists public.gift_codes (
  code text primary key,
  order_id uuid not null references public.gift_orders(id) on delete cascade,
  valid_until timestamptz not null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists gift_codes_order_idx on public.gift_codes (order_id);

-- Solo lettura per chi ha comprato; tutto il resto passa dalle funzioni
alter table public.gift_orders enable row level security;
alter table public.gift_codes enable row level security;
drop policy if exists gift_orders_buyer_select on public.gift_orders;
create policy gift_orders_buyer_select on public.gift_orders for select to authenticated using (buyer_id = (select auth.uid()));
drop policy if exists gift_codes_buyer_select on public.gift_codes;
create policy gift_codes_buyer_select on public.gift_codes for select to authenticated
  using (exists (select 1 from public.gift_orders o where o.id = order_id and o.buyer_id = (select auth.uid())));
grant select on public.gift_orders, public.gift_codes to authenticated;

-- Pass attivati con un regalo: origine 'gift'
alter table public.tool_passes drop constraint if exists tool_passes_source_check;
alter table public.tool_passes add constraint tool_passes_source_check check (source in ('stripe', 'code', 'admin', 'gift'));

-- Consensi del modulo di pagamento: anche per i regali
alter table public.subscription_consents drop constraint if exists subscription_consents_kind_check;
alter table public.subscription_consents add constraint subscription_consents_kind_check check (kind in ('checkout', 'upgrade', 'pass', 'gift'));

-- Dashboard essenziale per chi arriva con un regalo
alter table public.profiles add column if not exists gift_welcome boolean not null default false;

-- ---------------------------------------------------------------------------
-- Pagamento completato (solo server, idempotente per sessione Stripe): ordine
-- e codici GIFT-XXXX-XXXX validi 1 anno
-- ---------------------------------------------------------------------------
create or replace function public.create_gift_order(
  p_session_id text, p_payment_intent text, p_buyer uuid, p_kind text, p_tool text, p_plan text,
  p_quantity integer, p_unit_cents integer, p_amount_cents integer, p_message text, p_locale text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  perform pg_advisory_xact_lock(hashtext('gift_order:' || p_session_id));
  select id into v_id from public.gift_orders where stripe_session_id = p_session_id;
  if found then
    return v_id;
  end if;
  insert into public.gift_orders (buyer_id, kind, tool, plan, quantity, unit_amount_cents, amount_cents, message, locale, stripe_session_id, stripe_payment_intent)
  values (p_buyer, p_kind, case when p_kind = 'pass' then p_tool end, case when p_kind = 'plan' then p_plan end,
          p_quantity, p_unit_cents, p_amount_cents, nullif(left(trim(coalesce(p_message, '')), 300), ''), p_locale, p_session_id, p_payment_intent)
  returning id into v_id;
  for i in 1..p_quantity loop
    loop
      v_code := 'GIFT-'
        || (select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4))
        || '-'
        || (select string_agg(substr(v_alphabet, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 4));
      begin
        insert into public.gift_codes (code, order_id, valid_until) values (v_code, v_id, now() + interval '1 year');
        exit;
      exception when unique_violation then
        -- codice già esistente: se ne genera un altro
      end;
    end loop;
  end loop;
  return v_id;
end;
$$;
revoke all on function public.create_gift_order(text, text, uuid, text, text, text, integer, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.create_gift_order(text, text, uuid, text, text, text, integer, integer, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Pagina pubblica del regalo: cosa contiene e chi lo regala (solo il nome)
-- ---------------------------------------------------------------------------
create or replace function public.gift_code_info(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object(
      'status', case
        when c.revoked_at is not null or o.refunded_at is not null then 'revoked'
        when c.redeemed_at is not null then 'redeemed'
        when c.valid_until < now() then 'expired'
        else 'valid'
      end,
      'kind', o.kind,
      'tool', o.tool,
      'plan', o.plan,
      'message', o.message,
      'valid_until', c.valid_until,
      'giver_name', p.first_name,
      'giver_referral', p.referral_code,
      'mine', o.buyer_id is not null and o.buyer_id = auth.uid(),
      'redeemed_by_me', c.redeemed_by is not null and c.redeemed_by = auth.uid()
    )
    from public.gift_codes c
    join public.gift_orders o on o.id = c.order_id
    left join public.profiles p on p.id = o.buyer_id and p.deleted_at is null
    where c.code = upper(trim(p_code))
  ), jsonb_build_object('status', 'not_found'));
$$;
grant execute on function public.gift_code_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Attivazione del regalo (per sé)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_gift_code(p_code text)
returns table (success boolean, reason text, kind text, tool text, plan text, expires_at timestamptz, buyer_id uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_code public.gift_codes%rowtype;
  v_order public.gift_orders%rowtype;
  v_profile public.profiles%rowtype;
  v_required text;
  v_enabled boolean;
  v_plan_now text;
  v_from timestamptz;
  v_expires timestamptz;
  v_new_plan text;
begin
  if v_uid is null then
    return query select false, 'not_authenticated', null::text, null::text, null::text, null::timestamptz, null::uuid;
    return;
  end if;
  select * into v_code from public.gift_codes where code = upper(trim(p_code)) for update;
  if not found then
    return query select false, 'not_found', null::text, null::text, null::text, null::timestamptz, null::uuid;
    return;
  end if;
  select * into v_order from public.gift_orders where id = v_code.order_id;
  if v_code.revoked_at is not null or v_order.refunded_at is not null then
    return query select false, 'revoked', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  if v_code.redeemed_at is not null then
    return query select false, 'already_used', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  if v_code.valid_until < now() then
    return query select false, 'expired', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  if v_order.buyer_id = v_uid then
    return query select false, 'self', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or coalesce(v_profile.is_blocked, false) then
    return query select false, 'not_allowed', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  v_plan_now := public.plan_of(v_uid);

  if v_order.kind = 'pass' then
    select s.required_plan, s.is_enabled into v_required, v_enabled from public.marketplace_settings s where s.tool_name = v_order.tool;
    if not found or v_enabled is false then
      return query select false, 'unavailable', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
      return;
    end if;
    -- Il servizio è già nel suo piano: il regalo resta per qualcun altro
    if coalesce(v_required, 'base') = 'free'
       or (v_required = 'base' and v_plan_now in ('base', 'pro'))
       or (v_required = 'pro' and v_plan_now = 'pro') then
      return query select false, 'already_included', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
      return;
    end if;
    update public.gift_codes set redeemed_by = v_uid, redeemed_at = now() where code = v_code.code;
    v_expires := public.grant_tool_pass(v_uid, v_order.tool, 365, 'gift', null, null, 0, v_code.code);
    -- Nuovo iscritto arrivato con il regalo e senza piano: dashboard essenziale
    if v_plan_now = 'none' and v_profile.created_at > now() - interval '7 days' then
      update public.profiles set gift_welcome = true where id = v_uid;
    end if;
    return query select true, null::text, v_order.kind, v_order.tool, v_order.plan, v_expires, v_order.buyer_id;
    return;
  end if;

  -- Regalo di un anno di Base o Pro. Con un abbonamento Stripe attivo si
  -- pagherebbe due volte: il regalo resta per qualcun altro.
  if v_profile.subscription_source = 'stripe' and v_profile.subscription_status = 'active'
     and (v_profile.subscription_expires_at is null or v_profile.subscription_expires_at > now()) then
    return query select false, 'already_subscribed', v_order.kind, v_order.tool, v_order.plan, null::timestamptz, null::uuid;
    return;
  end if;
  update public.gift_codes set redeemed_by = v_uid, redeemed_at = now() where code = v_code.code;
  -- Piano già attivo con voucher o regalo: l'anno si aggiunge alla scadenza
  v_from := now();
  if v_profile.subscription_status = 'active' and v_profile.subscription_expires_at > now() then
    v_from := v_profile.subscription_expires_at;
  end if;
  v_expires := v_from + interval '1 year';
  v_new_plan := case
    when v_order.plan = 'pro' then 'pro'
    when v_profile.subscription_plan = 'pro' and v_profile.subscription_status = 'active'
      and (v_profile.subscription_expires_at is null or v_profile.subscription_expires_at > now()) then 'pro'
    else 'base'
  end;
  update public.profiles
  set subscription_status = 'active',
      subscription_expires_at = v_expires,
      subscription_source = 'voucher',
      subscription_plan = v_new_plan,
      gift_welcome = false
  where id = v_uid;
  return query select true, null::text, v_order.kind, v_order.tool, v_new_plan, v_expires, v_order.buyer_id;
end;
$$;
revoke all on function public.redeem_gift_code(text) from public, anon;
grant execute on function public.redeem_gift_code(text) to authenticated;

-- Rimborso del pagamento (solo server): i codici non ancora attivati non valgono più
create or replace function public.revoke_gift_payment(p_payment_intent text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.gift_orders set refunded_at = coalesce(refunded_at, now()) where stripe_payment_intent = p_payment_intent;
  update public.gift_codes c set revoked_at = now()
  from public.gift_orders o
  where o.id = c.order_id and o.stripe_payment_intent = p_payment_intent and c.redeemed_at is null and c.revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.revoke_gift_payment(text) from public, anon, authenticated;
grant execute on function public.revoke_gift_payment(text) to service_role;

-- I regali comprati, con lo stato di ogni codice (di chi l'ha attivato solo il nome)
create or replace function public.my_gift_orders()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'kind', o.kind, 'tool', o.tool, 'plan', o.plan, 'quantity', o.quantity,
    'amount_cents', o.amount_cents, 'message', o.message, 'created_at', o.created_at, 'refunded', o.refunded_at is not null,
    'codes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', c.code, 'valid_until', c.valid_until, 'redeemed_at', c.redeemed_at,
        'redeemed_name', case when c.redeemed_by is not null then (select first_name from public.profiles where id = c.redeemed_by and deleted_at is null) end,
        'revoked', c.revoked_at is not null or o.refunded_at is not null
      ) order by c.created_at, c.code), '[]'::jsonb)
      from public.gift_codes c where c.order_id = o.id
    )
  ) order by o.created_at desc), '[]'::jsonb)
  from public.gift_orders o
  where o.buyer_id = auth.uid();
$$;
revoke all on function public.my_gift_orders() from public, anon;
grant execute on function public.my_gift_orders() to authenticated;

-- "Mostra la dashboard completa"
create or replace function public.gift_welcome_off()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set gift_welcome = false where id = auth.uid() and gift_welcome;
$$;
revoke all on function public.gift_welcome_off() from public, anon;
grant execute on function public.gift_welcome_off() to authenticated;

-- Dashboard essenziale attiva per l'utente collegato (solo senza piano)
create or replace function public.my_gift_welcome()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select gift_welcome from public.profiles where id = auth.uid()), false)
     and public.plan_of(auth.uid()) = 'none';
$$;
revoke all on function public.my_gift_welcome() from public, anon;
grant execute on function public.my_gift_welcome() to authenticated;
