-- Regione dell'annuncio (20/10/2026): scelta da un elenco per i paesi
-- principali (Italia, Svizzera, Spagna, Francia, Germania, Austria,
-- Portogallo), libera per gli altri. Serve anche alla ricerca per regione.
alter table public.listings add column if not exists region text;
create index if not exists listings_country_region_idx on public.listings (country_code, region);

-- Cambiare la regione rimette l'annuncio in revisione, come città e testo
create or replace function public.listings_guard_user_changes()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.featured_until := old.featured_until;
    new.user_id := old.user_id;
    new.reviewed_at := old.reviewed_at;
    new.reviewed_by := old.reviewed_by;
    if (new.title, new.description, new.category, new.price, new.image_url, new.country_code, new.region, new.city, new.is_remote)
       is distinct from (old.title, old.description, old.category, old.price, old.image_url, old.country_code, old.region, old.city, old.is_remote) then
      new.review_status := 'pending';
      new.review_note := null;
    else
      new.review_status := old.review_status;
      new.review_note := old.review_note;
    end if;
  else
    new.featured_until := null;
    new.review_status := 'pending';
    new.review_note := null;
    new.reviewed_at := null;
    new.reviewed_by := null;
  end if;
  if new.expires_at is null or new.expires_at > now() + interval '30 days 1 hour' then
    new.expires_at := now() + interval '30 days';
  end if;
  return new;
end;
$function$;
