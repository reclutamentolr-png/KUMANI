-- «Fatti trovare su Google» per Landing Page e Negozio: spento di partenza.
-- Le pagine restano pubbliche per chi ha il link, ma finiscono sui motori di
-- ricerca (e nella sitemap) solo se il titolare lo sceglie: un privato non
-- espone telefono o indirizzo senza rendersene conto.
alter table public.landing_pages add column if not exists search_visible boolean not null default false;
alter table public.shop_settings add column if not exists search_visible boolean not null default false;

create or replace function public.list_public_landings()
returns table (slug text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select l.slug, l.updated_at
  from public.landing_pages l
  where l.is_published
    and l.search_visible
    and not l.suspended
    and not public.is_user_blocked(l.owner_id)
    and exists (select 1 from public.tool_access(l.owner_id, 'landing-page') ta where ta.allowed)
  order by l.updated_at desc
  limit 5000;
$$;
revoke all on function public.list_public_landings() from public, anon, authenticated;
grant execute on function public.list_public_landings() to service_role;

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
    'search_visible', l.search_visible,
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
