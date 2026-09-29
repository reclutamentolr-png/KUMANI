-- Bacheca: località degli annunci e privacy dei contatti.
-- Da eseguire PRIMA del deploy del codice che usa country_code / city /
-- is_remote (compatibile anche con il codice attuale).

-- 1. Località: nazione, città e "anche online / a distanza"
alter table public.listings add column if not exists country_code text;
alter table public.listings add column if not exists city text;
alter table public.listings add column if not exists is_remote boolean not null default false;

alter table public.listings drop constraint if exists listings_country_code_check;
alter table public.listings add constraint listings_country_code_check
  check (country_code is null or country_code ~ '^[A-Z]{2}$');
alter table public.listings drop constraint if exists listings_city_check;
alter table public.listings add constraint listings_city_check
  check (city is null or char_length(city) between 1 and 80);

-- Annunci già pubblicati: la nazione del loro autore. La città resta vuota
-- (quella del profilo è un dato personale dato per un altro scopo).
update public.listings l
set country_code = upper(trim(p.country_code))
from public.profiles p
where p.id = l.user_id
  and l.country_code is null
  and upper(trim(coalesce(p.country_code, ''))) ~ '^[A-Z]{2}$';

create index if not exists idx_listings_country_city on public.listings (country_code, lower(city));

-- 2. Contatti: email e telefono non sono mai mostrati (si contatta dalla
-- chat) ma erano leggibili da chiunque. Si cancellano e non si salvano più.
update public.listings set contact_email = null, contact_phone = null
where contact_email is not null or contact_phone is not null;

create or replace function public.listings_strip_contacts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.contact_email := null;
  new.contact_phone := null;
  return new;
end;
$$;

drop trigger if exists listings_strip_contacts on public.listings;
create trigger listings_strip_contacts
  before insert or update on public.listings
  for each row execute function public.listings_strip_contacts();

-- 3. Gli annunci si leggono solo da loggati (la Bacheca richiede l'accesso;
-- il link condiviso passa dal login).
revoke select on public.listings from anon;
