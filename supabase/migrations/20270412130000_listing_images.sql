-- Più foto per annuncio (20/10/2026): fino a 6, numero massimo scelto in
-- Admin → Bacheca (3 o 6). image_url resta la copertina (la prima foto).
alter table public.listings add column if not exists images text[] not null default '{}';
update public.listings set images = array[image_url] where image_url is not null and cardinality(images) = 0;

insert into public.system_settings (key, value)
values ('listing_max_photos', '6')
on conflict (key) do nothing;

-- Cambiare le foto rimette l'annuncio in revisione
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
    if (new.title, new.description, new.category, new.price, new.image_url, new.images, new.country_code, new.region, new.city, new.is_remote)
       is distinct from (old.title, old.description, old.category, old.price, old.image_url, old.images, old.country_code, old.region, old.city, old.is_remote) then
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
