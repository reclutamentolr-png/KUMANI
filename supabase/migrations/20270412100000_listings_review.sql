-- Bacheca controllata dallo Staff (20/10/2026)
-- Ogni annuncio nuovo o modificato passa dalla revisione dello Staff prima di
-- comparire. Con «Bacheca libera» (Admin → Bacheca) pubblicare è gratis,
-- altrimenti costa i KU Karma di sempre: la revisione c'è in tutti e due i casi.

-- 1. Stato di revisione (gli annunci già esistenti restano pubblicati)
alter table public.listings
  add column if not exists review_status text not null default 'approved',
  add column if not exists review_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.listings drop constraint if exists listings_review_status_check;
alter table public.listings add constraint listings_review_status_check check (review_status in ('pending', 'approved', 'rejected'));

create index if not exists listings_review_pending_idx on public.listings (created_at) where review_status = 'pending';

-- 2. Visibili a tutti solo se approvati; chi li ha scritti vede anche i propri
drop policy if exists "Annunci attivi visibili a tutti" on public.listings;
create policy "Annunci approvati visibili a tutti" on public.listings
  for select using (is_active = true and review_status = 'approved');
drop policy if exists listings_owner_select on public.listings;
create policy listings_owner_select on public.listings
  for select using ((select auth.uid()) = user_id);

-- 3. Dal sito l'autore non tocca lo stato di revisione; se cambia il testo,
--    la foto, il prezzo o il luogo, l'annuncio torna «da controllare»
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
    if (new.title, new.description, new.category, new.price, new.image_url, new.country_code, new.city, new.is_remote)
       is distinct from (old.title, old.description, old.category, old.price, old.image_url, old.country_code, old.city, old.is_remote) then
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

-- 4. Interruttore «Bacheca libera» (spento: si paga in KU Karma come prima)
insert into public.system_settings (key, value)
values ('listings_free_mode', 'false')
on conflict (key) do nothing;
