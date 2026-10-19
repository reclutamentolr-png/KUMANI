-- Link corti per inviare il video di un servizio (kumani.io/v/CODICE): uno
-- per Kumano e servizio, sempre lo stesso. Chi lo apre vede il video, chi lo
-- consiglia e si iscrive con il suo invito; l'indirizzo che gira resta
-- pulito (niente ?ref=). Si crea solo dal server (service role).

create table if not exists public.share_links (
  slug text primary key check (slug ~ '^[A-Z2-9]{6}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool text not null check (tool ~ '^[a-z0-9-]{1,40}$'),
  opens integer not null default 0,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tool)
);

create index if not exists share_links_tool_idx on public.share_links (tool);

alter table public.share_links enable row level security;

-- Ognuno vede solo i propri link; scritture solo dal server
drop policy if exists share_links_own_select on public.share_links;
create policy share_links_own_select on public.share_links
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Pagina pubblica del link: servizio e codice invito di chi lo ha mandato
-- (solo account attivi, come get_public_profile_by_referral)
create or replace function public.share_link_info(p_slug text)
returns table (tool text, referral_code text)
language sql
stable
security definer
set search_path = public
as $$
  select s.tool, p.referral_code
  from public.share_links s
  join public.profiles p on p.id = s.user_id
  where s.slug = upper(p_slug)
    and p.referral_code is not null
    and p.is_active = true
    and not coalesce(p.is_blocked, false);
$$;

-- Un'apertura in più (la chiama il browser, così le anteprime dei
-- programmi di chat non contano)
create or replace function public.share_link_opened(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.share_links
  set opens = opens + 1, last_opened_at = now()
  where slug = upper(p_slug);
$$;

revoke all on function public.share_link_info(text) from public;
revoke all on function public.share_link_opened(text) from public;
grant execute on function public.share_link_info(text) to anon, authenticated;
grant execute on function public.share_link_opened(text) to anon, authenticated;
