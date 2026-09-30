-- Agenti venditori: account creati dallo Staff (profilo completo con dati
-- fiscali, senza sponsor né posto in matrice), piano Pro incluso per
-- conoscere i servizi, provvigioni in euro sugli abbonamenti pagati dai
-- clienti arrivati dal loro link. Tabelle leggibili e scrivibili solo dal
-- server (chiave di servizio).

-- Scheda agente (dati di fatturazione e percentuali)
create table if not exists public.agents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique check (code ~ '^AG-[A-Z0-9]{6}$'),
  tax_regime text not null default 'partita_iva' check (tax_regime in ('partita_iva', 'occasionale', 'agenzia')),
  business_name text check (business_name is null or char_length(business_name) <= 120),
  vat_number text check (vat_number is null or vat_number ~ '^[0-9]{11}$'),
  pec text check (pec is null or char_length(pec) <= 120),
  sdi_code text check (sdi_code is null or sdi_code ~ '^[A-Z0-9]{7}$'),
  iban text check (iban is null or iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  commission_first_pct numeric(5, 2) not null default 20 check (commission_first_pct between 0 and 100),
  commission_renewal_pct numeric(5, 2) not null default 10 check (commission_renewal_pct between 0 and 100),
  is_active boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cliente arrivato dal link di un agente (solo all'iscrizione: chi era già
-- iscritto non conta). Colonna non leggibile dal browser.
alter table public.profiles add column if not exists agent_id uuid references public.agents(user_id) on delete set null;
create index if not exists profiles_agent_idx on public.profiles (agent_id) where agent_id is not null;
revoke select (agent_id), update (agent_id), insert (agent_id) on public.profiles from anon, authenticated;

alter table public.profiles drop constraint if exists profiles_signup_source_check;
alter table public.profiles add constraint profiles_signup_source_check check (signup_source in ('invite', 'direct', 'agent'));

-- Pagamenti agli agenti (bonifici fatti dallo Staff)
create table if not exists public.agent_payouts (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(user_id) on delete cascade,
  amount_cents integer not null,
  paid_on date not null,
  reference text check (reference is null or char_length(reference) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists agent_payouts_agent_idx on public.agent_payouts (agent_id, paid_on desc);

-- Provvigioni: una per fattura pagata (prima vendita o rinnovo), più le
-- rettifiche per i rimborsi. "Maturata" 14 giorni dopo (recesso).
create table if not exists public.agent_commissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(user_id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('first', 'renewal', 'adjustment')),
  plan text check (plan in ('base', 'pro')),
  stripe_invoice_id text,
  stripe_payment_intent text,
  gross_cents integer not null default 0,
  net_cents integer not null default 0,
  pct numeric(5, 2) not null default 0,
  commission_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'paid')),
  matures_at timestamptz not null default (now() + interval '14 days'),
  payout_id uuid references public.agent_payouts(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists agent_commissions_invoice_uniq on public.agent_commissions (stripe_invoice_id) where kind <> 'adjustment';
create index if not exists agent_commissions_agent_idx on public.agent_commissions (agent_id, created_at desc);
create index if not exists agent_commissions_pi_idx on public.agent_commissions (stripe_payment_intent) where stripe_payment_intent is not null;

alter table public.agents enable row level security;
alter table public.agent_commissions enable row level security;
alter table public.agent_payouts enable row level security;
revoke all on public.agents from anon, authenticated;
revoke all on public.agent_commissions from anon, authenticated;
revoke all on public.agent_payouts from anon, authenticated;

-- Aliquota IVA per ricavare l'imponibile quando Stripe non indica l'IVA
-- (prezzi IVA inclusa): la provvigione si calcola sull'imponibile.
insert into public.system_settings (key, value) values ('agent_commission_vat_rate', '22')
on conflict (key) do nothing;

-- Agente attivo = piano Pro (tutti i servizi, per conoscerli e promuoverli)
create or replace function public.plan_of(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.agents a where a.user_id = p.id and a.is_active) then 'pro'
    when p.pro_trial_ends_at is not null and p.pro_trial_ends_at > now() then 'pro'
    when p.subscription_status = 'active'
      and (p.subscription_expires_at is null or p.subscription_expires_at > now())
      then coalesce(p.subscription_plan, 'base')
    else 'none'
  end
  from public.profiles p
  where p.id = p_user_id;
$$;
revoke all on function public.plan_of(uuid) from public, anon, authenticated;

-- Iscrizione: nuovo parametro facoltativo p_agent_code (link dell'agente).
-- Si toglie la versione a 5 parametri per non avere due funzioni uguali.
drop function if exists public.complete_registration(text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.complete_registration(p_first_name text, p_last_name text, p_country text, p_city text, p_referral_code text, p_agent_code text DEFAULT '')
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_code text := upper(trim(coalesce(p_referral_code, '')));
  v_sponsor uuid;
  v_source text;
  v_house uuid;
  v_thanks_to uuid;
  v_house_node uuid;
  v_agent uuid;
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;

  -- Profilo già creato: si completa solo il posto in matrice, se manca.
  select sponsor_id into v_sponsor from public.profiles where id = v_uid;
  if found then
    if not exists (select 1 from public.matrix_nodes where user_id = v_uid) and v_sponsor is not null then
      perform public.place_in_matrix(v_uid, v_sponsor);
    end if;
    return 'ok';
  end if;

  begin
    v_house := public.setting_text('house_account_id')::uuid;
  exception when others then
    v_house := null;
  end;

  if v_code <> '' then
    select id into v_sponsor from public.profiles
    where referral_code = v_code and coalesce(is_active, true) = true and not coalesce(is_blocked, false)
      -- Gli agenti venditori non fanno parte della rete: niente inviti
      and not exists (select 1 from public.agents ag where ag.user_id = profiles.id);
    if v_sponsor is null then
      return 'invalid_referral';
    end if;
    v_source := 'invite';
  else
    if v_house is null or not exists (select 1 from public.profiles where id = v_house) then
      return 'direct_unavailable';
    end if;
    v_sponsor := v_house;
    v_source := 'direct';
    -- Iscritto dal link di un Agente venditore: la vendita è dell'agente
    -- (niente "Ringraziamento attività" a un Kumano). Codice non valido o
    -- agente sospeso: iscrizione diretta normale.
    select a.user_id into v_agent from public.agents a
    where a.code = upper(trim(coalesce(p_agent_code, ''))) and a.is_active;
    if v_agent is not null then
      v_source := 'agent';
    else
      v_thanks_to := public.pick_activity_kumano(p_city, p_country, v_uid);
    end if;
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.profiles (
    id, email, username, first_name, last_name, country_code, city,
    referral_code, subscription_status, date_of_birth, sponsor_id,
    signup_source, activity_thanks_to, agent_id
  ) values (
    v_uid,
    v_email,
    split_part(coalesce(v_email, 'kumano'), '@', 1) || '_' || floor(random() * 10000)::int,
    left(trim(p_first_name), 80),
    left(trim(p_last_name), 80),
    upper(left(trim(p_country), 2)),
    nullif(left(trim(coalesce(p_city, '')), 80), ''),
    public.new_referral_code(p_country),
    'free',
    '2000-01-01',
    v_sponsor,
    v_source,
    v_thanks_to,
    v_agent
  );

  -- L'account KUMANI senza un posto in matrice diventa una radice propria.
  if v_source in ('direct', 'agent') and not exists (select 1 from public.matrix_nodes where user_id = v_house) then
    insert into public.matrix_nodes (user_id, parent_id, path, level, "position", depth)
    values (v_house, null, text2ltree('root.' || replace(v_house::text, '-', '_')), 1, 1, 0)
    returning id into v_house_node;
  end if;

  if public.place_in_matrix(v_uid, v_sponsor) is null then
    -- Sponsor senza posto in matrice (dato storico incompleto): si va nella
    -- struttura dell'account KUMANI, se configurato.
    if v_house is not null and v_house <> v_sponsor then
      perform public.place_in_matrix(v_uid, v_house);
    end if;
  end if;

  return 'ok';
end;
$function$;
revoke all on function public.complete_registration(text, text, text, text, text, text) from public, anon;
grant execute on function public.complete_registration(text, text, text, text, text, text) to authenticated;

-- Anteprima "ti ha invitato…" nell'iscrizione: mai per un agente
create or replace function public.get_public_profile_by_referral(p_referral_code text)
returns table (first_name text, last_name text, country_code character, referral_code text)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  select p.first_name, ''::text, p.country_code, p.referral_code
  from public.profiles p
  where p.referral_code = p_referral_code
    and p.is_active = true
    and not coalesce(p.is_blocked, false)
    and not exists (select 1 from public.agents ag where ag.user_id = p.id);
end;
$function$;
