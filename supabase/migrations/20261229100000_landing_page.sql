-- Landing Page (servizio Pro): un piccolo sito vetrina per ogni utente,
-- pubblico su kumani.io/p/<indirizzo>. Una pagina per utente, fatta di
-- blocchi già pronti (contenuto in jsonb), con modello e colore scelti.
-- La pagina pubblica legge tutto con get_public_landing(): visibile solo se
-- pubblicata, non sospesa dallo Staff, titolare non bloccato e con il
-- servizio ancora incluso nel suo piano.

-- 1. Pagine ----------------------------------------------------------------
create table if not exists public.landing_pages (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$' and slug !~ '--'),
  is_published boolean not null default false,
  template text not null default 'scuro' check (template in ('scuro', 'chiaro', 'colore')),
  accent text not null default '#c79a3b' check (accent ~ '^#[0-9a-f]{6}$'),
  content_locale text not null default 'it' check (content_locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru')),
  content jsonb not null default '{}'::jsonb check (pg_column_size(content) < 200000),
  -- Sospensione decisa dallo Staff: il titolare non la può togliere
  suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.landing_pages enable row level security;

drop policy if exists landing_pages_own_select on public.landing_pages;
create policy landing_pages_own_select on public.landing_pages for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists landing_pages_own_insert on public.landing_pages;
create policy landing_pages_own_insert on public.landing_pages for insert to authenticated
  with check (owner_id = (select auth.uid()) and suspended = false);
drop policy if exists landing_pages_own_update on public.landing_pages;
create policy landing_pages_own_update on public.landing_pages for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists landing_pages_own_delete on public.landing_pages;
create policy landing_pages_own_delete on public.landing_pages for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Solo chi ha il servizio nel piano può creare o modificare
drop policy if exists landing_pages_plan_insert on public.landing_pages;
create policy landing_pages_plan_insert on public.landing_pages as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('landing-page') t where t.allowed));
drop policy if exists landing_pages_plan_update on public.landing_pages;
create policy landing_pages_plan_update on public.landing_pages as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('landing-page') t where t.allowed));

-- Il titolare modifica solo i suoi campi, mai la sospensione
revoke insert, update on public.landing_pages from authenticated, anon;
grant insert (owner_id, slug, is_published, template, accent, content_locale, content, updated_at) on public.landing_pages to authenticated;
grant update (slug, is_published, template, accent, content_locale, content, updated_at) on public.landing_pages to authenticated;
grant select, delete on public.landing_pages to authenticated;

-- 2. Lettura pubblica --------------------------------------------------------
create or replace function public.get_public_landing(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug', l.slug,
    'template', l.template,
    'accent', l.accent,
    'content_locale', l.content_locale,
    'content', l.content,
    'updated_at', l.updated_at,
    'referral_code', p.referral_code,
    -- Collegamento al menù del titolare, se ha KUMANI Menu attivo
    'menu_token', (
      select m.token from public.menus m
      where m.owner_id = l.owner_id and m.is_active
        and exists (select 1 from public.tool_access(l.owner_id, 'menu') ta where ta.allowed)
    )
  )
  from public.landing_pages l
  join public.profiles p on p.id = l.owner_id
  where l.slug = lower(p_slug)
    and l.is_published
    and not l.suspended
    and not public.is_user_blocked(l.owner_id)
    and exists (select 1 from public.tool_access(l.owner_id, 'landing-page') ta where ta.allowed);
$$;
revoke all on function public.get_public_landing(text) from public;
grant execute on function public.get_public_landing(text) to anon, authenticated, service_role;

-- Elenco per la sitemap (solo server)
create or replace function public.list_public_landings()
returns table(slug text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.slug, l.updated_at
  from public.landing_pages l
  where l.is_published
    and not l.suspended
    and not public.is_user_blocked(l.owner_id)
    and exists (select 1 from public.tool_access(l.owner_id, 'landing-page') ta where ta.allowed)
  order by l.updated_at desc
  limit 5000;
$$;
revoke all on function public.list_public_landings() from public, anon, authenticated;
grant execute on function public.list_public_landings() to service_role;

-- 3. Segnalazioni dei visitatori (scritte dal server) --------------------------
create table if not exists public.landing_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.landing_pages(owner_id) on delete cascade,
  reason text not null check (reason in ('scam', 'fake_reviews', 'offensive', 'copyright', 'other')),
  details text check (char_length(details) <= 1000),
  reporter_hash text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);
create index if not exists landing_reports_status_idx on public.landing_reports (status, created_at desc);
alter table public.landing_reports enable row level security;
-- Nessuna policy: solo il server (service role) legge e scrive

-- 4. Foto ----------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landing-photos', 'landing-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 5. Testi con l'AI: contatore giornaliero (solo server) ----------------------
create table if not exists public.landing_ai_usage (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  used_on date not null,
  runs integer not null default 0,
  primary key (owner_id, used_on)
);
alter table public.landing_ai_usage enable row level security;

create or replace function public.ai_quota_take(p_kind text, p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_runs integer;
  v_day date := (now() at time zone 'utc')::date; -- come il resto del codice (data UTC)
begin
  if p_limit is null or p_limit <= 0 or p_user is null then
    return null;
  end if;
  if p_kind = 'offermaker' then
    insert into public.offermaker_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  elsif p_kind = 'menu' then
    insert into public.menu_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  elsif p_kind = 'landing' then
    insert into public.landing_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  else
    raise exception 'unknown_kind';
  end if;
  return v_runs;
end;
$$;
revoke all on function public.ai_quota_take(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_quota_take(text, uuid, integer) to service_role;

-- 6. Servizio nel Marketplace: incluso nel piano Pro --------------------------
insert into public.marketplace_settings (tool_name, is_enabled, required_plan)
values ('landing-page', true, 'pro')
on conflict (tool_name) do nothing;
