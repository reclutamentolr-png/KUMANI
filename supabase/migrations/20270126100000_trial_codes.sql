-- Prove temporanee dei servizi senza registrazione.
--
-- Un Kumano (Base o Pro), un agente o l'Admin crea un codice di prova per
-- un servizio e una durata (1 ora, 24 ore, 3 giorni, 7 giorni) e lo manda a
-- una persona. Chi apre il link entra come OSPITE: account temporaneo creato
-- dal server (ruolo 'guest' nell'account), che vede solo quel servizio fino
-- alla scadenza. Un codice vale per una sola persona e va attivato entro 7
-- giorni. Alla scadenza l'accesso si chiude e, poco dopo, l'account ospite e
-- tutto ciò che ha creato vengono cancellati.

-- Profilo dell'ospite: guest_until non nullo = ospite in prova
alter table public.profiles add column if not exists guest_until timestamptz;
alter table public.profiles add column if not exists guest_tool text;
create index if not exists profiles_guest_until_idx on public.profiles (guest_until) where guest_until is not null;

create table if not exists public.trial_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  tool text not null,
  duration_minutes integer not null check (duration_minutes in (60, 1440, 4320, 10080)),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  activate_by timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  access_until timestamptz,
  revoked_at timestamptz
);
create index if not exists trial_codes_creator_idx on public.trial_codes (created_by, created_at desc);

alter table public.trial_codes enable row level security;
-- Nessuna policy: codici letti e scritti solo dal server.

-- Il Pass che apre il servizio all'ospite
alter table public.tool_passes drop constraint if exists tool_passes_source_check;
alter table public.tool_passes add constraint tool_passes_source_check check (source in ('stripe', 'code', 'admin', 'gift', 'trial'));

create or replace function public.is_guest(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user_id and guest_until is not null);
$$;

-- Accesso ai servizi: il Pass di prova vale SOLO per l'ospite stesso.
-- Quando a chiedere è qualcun altro (pagine pubbliche: Landing, Menu, CV,
-- Ricevute, Link in Bio, QR…) l'ospite risulta senza accesso, quindi nulla
-- di ciò che crea in prova diventa mai visibile in pubblico.
create or replace function public.tool_access(p_user_id uuid, p_tool text)
returns table(allowed boolean, required_plan text, known boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  v_enabled boolean;
  v_required text;
  v_known boolean;
  v_plan text := coalesce(public.plan_of(p_user_id), 'none');
  v_trial_only boolean := public.is_trial_only(p_user_id);
  v_guest boolean := public.is_guest(p_user_id);
begin
  select s.is_enabled, s.required_plan into v_enabled, v_required
  from public.marketplace_settings s where s.tool_name = p_tool;
  v_known := found;
  v_enabled := coalesce(v_enabled, true);
  v_required := coalesce(v_required, 'base');

  if v_guest then
    return query select
      v_enabled and auth.uid() = p_user_id and public.has_tool_pass(p_user_id, p_tool),
      v_required,
      v_known;
    return;
  end if;

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
$function$;

-- Pagine pubbliche: mai per gli ospiti (anche le ricevute, che altrimenti
-- restano visibili per un anno)
create or replace function public.public_page_visible(p_owner uuid, p_tool text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_last timestamptz;
begin
  if public.is_guest(p_owner) then
    return false;
  end if;
  if p_tool <> 'digital-receipt' and public.is_user_blocked(p_owner) then
    return false;
  end if;
  if exists (select 1 from public.tool_access(p_owner, p_tool) t where t.allowed) then
    return true;
  end if;
  if p_tool = 'digital-receipt' then
    -- Strumento spento dallo Staff: le ricevute restano consultabili
    if not public.tool_online(p_tool) then
      return true;
    end if;
    -- Fino a 12 mesi dopo la fine del piano (o della prova Pro)
    select greatest(coalesce(subscription_expires_at, '-infinity'::timestamptz), coalesce(pro_trial_ends_at, '-infinity'::timestamptz))
      into v_last from public.profiles where id = p_owner;
    return v_last is not null and v_last > now() - interval '1 year';
  end if;
  return false;
end;
$function$;

-- Pulizia: account ospite cancellati 2 ore dopo la fine della prova (con
-- tutto ciò che hanno creato); codici mai attivati tenuti 30 giorni per lo storico
create or replace function public.cleanup_trial_guests()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users
  where id in (select id from public.profiles where guest_until is not null and guest_until < now() - interval '2 hours');
  delete from public.trial_codes
  where coalesce(access_until, activate_by) < now() - interval '30 days';
end;
$$;
revoke all on function public.cleanup_trial_guests() from public, anon, authenticated;
select cron.schedule('kumani-trial-guests-cleanup', '15 * * * *', 'select public.cleanup_trial_guests()');
