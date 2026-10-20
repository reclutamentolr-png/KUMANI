-- Bacheca (21/10/2026):
-- 1. Due categorie nuove: «Te lo regalo» (gratis) e «Scambio» (baratto)
alter table public.listings drop constraint if exists listings_category_check;
alter table public.listings add constraint listings_category_check check (category = any (array[
  'veicoli', 'immobili', 'elettronica', 'moda', 'casa_persona', 'tempo_libero', 'colf_badanti', 'agricoltura', 'animali', 'impresa', 'servizi', 'regalo', 'baratto'
]));

-- 2. «Avvisami quando esce»: ricerche salvate. Quando lo Staff approva un
--    annuncio adatto arriva un avviso (campanella e telefono).
create table if not exists public.listing_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text,
  category text,
  country_code text,
  region text,
  city text,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists listing_alerts_user_idx on public.listing_alerts (user_id);
alter table public.listing_alerts enable row level security;

drop policy if exists listing_alerts_own_select on public.listing_alerts;
create policy listing_alerts_own_select on public.listing_alerts for select using ((select auth.uid()) = user_id);
drop policy if exists listing_alerts_own_insert on public.listing_alerts;
create policy listing_alerts_own_insert on public.listing_alerts for insert with check ((select auth.uid()) = user_id);
drop policy if exists listing_alerts_own_delete on public.listing_alerts;
create policy listing_alerts_own_delete on public.listing_alerts for delete using ((select auth.uid()) = user_id);

-- Al massimo 10 ricerche salvate per persona
create or replace function public.listing_alerts_limit()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if (select count(*) from public.listing_alerts where user_id = new.user_id) >= 10 then
    raise exception 'listing_alerts_limit';
  end if;
  return new;
end;
$function$;
revoke execute on function public.listing_alerts_limit() from public, anon, authenticated;
drop trigger if exists listing_alerts_limit on public.listing_alerts;
create trigger listing_alerts_limit before insert on public.listing_alerts for each row execute function public.listing_alerts_limit();
