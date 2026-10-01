-- Pass servizio: un solo servizio per un anno, senza abbonamento Base/Pro.
-- Si ottiene pagando con carta (Stripe, pagamento una tantum) oppure con un
-- codice pass (lotti per negozi o coupon assegnati dallo Staff, attivabili
-- da chiunque abbia il codice). Il pass non dà KU Points a chi ha invitato
-- e non cambia il prezzo degli abbonamenti (49 € / 149 €).

-- Per ogni servizio l'Admin decide se è vendibile da solo e a che prezzo.
alter table public.marketplace_settings
  add column if not exists pass_enabled boolean not null default false,
  add column if not exists pass_price_cents integer not null default 1000
    check (pass_price_cents between 100 and 100000);

create table if not exists public.tool_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source text not null check (source in ('stripe', 'code', 'admin')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  code text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tool_passes_user_tool_idx on public.tool_passes (user_id, tool);
create index if not exists tool_passes_payment_intent_idx on public.tool_passes (stripe_payment_intent);

alter table public.tool_passes enable row level security;
drop policy if exists "Owner reads own passes" on public.tool_passes;
create policy "Owner reads own passes" on public.tool_passes for select to authenticated using (user_id = auth.uid());

-- Codici pass: creati solo dallo Staff (service role), attivati con
-- redeem_tool_pass_code(). Nessuna policy: dal browser non si leggono.
create table if not exists public.tool_pass_codes (
  code text primary key,
  tool text not null,
  days integer not null default 365 check (days between 1 and 3650),
  label text check (char_length(label) <= 200),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz
);
alter table public.tool_pass_codes enable row level security;

-- Coupon del Wallet che contiene un codice pass (pulsante "Attiva servizio")
alter table public.wallet_coupons add column if not exists pass_tool text;

-- Pass attivo per un servizio
create or replace function public.has_tool_pass(p_user_id uuid, p_tool text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tool_passes
    where user_id = p_user_id and tool = p_tool and revoked_at is null
      and starts_at <= now() and expires_at > now()
  );
$$;
revoke all on function public.has_tool_pass(uuid, text) from public, anon, authenticated;

-- Regola d'accesso unica: come prima, più il pass del singolo servizio.
create or replace function public.tool_access(p_user_id uuid, p_tool text)
returns table(allowed boolean, required_plan text, known boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_enabled boolean;
  v_required text;
  v_known boolean;
  v_plan text := coalesce(public.plan_of(p_user_id), 'none');
  v_trial_only boolean := public.is_trial_only(p_user_id);
begin
  select s.is_enabled, s.required_plan into v_enabled, v_required
  from public.marketplace_settings s where s.tool_name = p_tool;
  v_known := found;
  v_enabled := coalesce(v_enabled, true);
  v_required := coalesce(v_required, 'base');

  return query select
    v_enabled and (
      v_required = 'free'
      or (v_required = 'base' and v_plan in ('base', 'pro') and not v_trial_only)
      or (v_required = 'pro' and v_plan = 'pro')
      or public.has_tool_pass(p_user_id, p_tool)
    ),
    v_required,
    v_known;
end;
$$;

-- Pass attivi dell'utente collegato (schede, dashboard, Wallet)
create or replace function public.my_tool_passes()
returns table(tool text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select tool, max(expires_at)
  from public.tool_passes
  where user_id = auth.uid() and revoked_at is null and expires_at > now()
  group by tool;
$$;
revoke all on function public.my_tool_passes() from public, anon;
grant execute on function public.my_tool_passes() to authenticated;

-- Assegna un pass: se ce n'è già uno attivo per lo stesso servizio, l'anno
-- si aggiunge alla sua scadenza. Idempotente per sessione Stripe.
create or replace function public.grant_tool_pass(
  p_user_id uuid, p_tool text, p_days integer, p_source text,
  p_session_id text default null, p_payment_intent text default null,
  p_amount_cents integer default 0, p_code text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing timestamptz;
  v_from timestamptz;
  v_expires timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('tool_pass:' || p_user_id::text || ':' || p_tool));
  if p_session_id is not null then
    select expires_at into v_existing from public.tool_passes where stripe_session_id = p_session_id;
    if found then
      return v_existing;
    end if;
  end if;
  select max(expires_at) into v_from from public.tool_passes
  where user_id = p_user_id and tool = p_tool and revoked_at is null and expires_at > now();
  v_from := greatest(coalesce(v_from, now()), now());
  v_expires := v_from + make_interval(days => p_days);
  insert into public.tool_passes (user_id, tool, starts_at, expires_at, source, stripe_session_id, stripe_payment_intent, amount_cents, code)
  values (p_user_id, p_tool, now(), v_expires, p_source, p_session_id, p_payment_intent, coalesce(p_amount_cents, 0), p_code);
  return v_expires;
end;
$$;
revoke all on function public.grant_tool_pass(uuid, text, integer, text, text, text, integer, text) from public, anon, authenticated;

-- Attivazione con codice pass (chiunque abbia il codice, per sé)
create or replace function public.redeem_tool_pass_code(p_code text)
returns table(success boolean, reason text, tool text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row public.tool_pass_codes%rowtype;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated', null::text, null::timestamptz;
    return;
  end if;
  select * into v_row from public.tool_pass_codes where code = upper(trim(p_code)) for update;
  if not found then
    return query select false, 'not_found', null::text, null::timestamptz;
    return;
  end if;
  if v_row.redeemed_at is not null then
    return query select false, 'already_used', v_row.tool, null::timestamptz;
    return;
  end if;
  if not exists (select 1 from public.marketplace_settings s where s.tool_name = v_row.tool) then
    return query select false, 'unknown_tool', v_row.tool, null::timestamptz;
    return;
  end if;
  update public.tool_pass_codes set redeemed_by = auth.uid(), redeemed_at = now() where code = v_row.code;
  -- Il coupon nel Wallet di chi l'aveva ricevuto risulta usato
  update public.wallet_coupons set redeemed_at = now() where code = v_row.code and redeemed_at is null;
  v_expires := public.grant_tool_pass(auth.uid(), v_row.tool, v_row.days, 'code', null, null, 0, v_row.code);
  return query select true, null::text, v_row.tool, v_expires;
end;
$$;
revoke all on function public.redeem_tool_pass_code(text) from public, anon;
grant execute on function public.redeem_tool_pass_code(text) to authenticated;

-- Rimborso del pagamento: il pass acquistato viene revocato
create or replace function public.revoke_tool_pass_payment(p_payment_intent text)
returns integer
language sql
security definer
set search_path = public
as $$
  with revoked as (
    update public.tool_passes set revoked_at = now()
    where stripe_payment_intent = p_payment_intent and revoked_at is null
    returning 1
  )
  select count(*)::integer from revoked;
$$;
revoke all on function public.revoke_tool_pass_payment(text) from public, anon, authenticated;
