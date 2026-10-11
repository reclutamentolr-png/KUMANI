-- «I colori del tuo brand» (Scheda attività, piani Base e Pro).
-- brand_colors: i colori scelti (primary, accent, background, text) più
-- quelli calcolati dall'app (onPrimary, qr). brand_follow: quali servizi
-- seguono il brand (landing, quotes, qr, bio, email).
-- I servizi che seguono il brand si aggiornano da soli quando il brand cambia
-- (brand_sync). Se in un servizio si cambia il colore a mano, quel servizio
-- smette di seguire il brand. accent resta il colore principale (lo usano
-- già i servizi con «Usa i dati della Scheda attività»).

alter table public.quote_issuer_profiles add column if not exists brand_colors jsonb;
alter table public.quote_issuer_profiles add column if not exists brand_follow jsonb not null default '{}'::jsonb;
alter table public.link_in_bio add column if not exists brand_colors jsonb;

create or replace function public.valid_brand_colors(p jsonb)
returns boolean
language sql
immutable
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select bool_and(coalesce(p ->> k, '') ~ '^#[0-9a-fA-F]{6}$') from unnest(array['primary', 'accent', 'background', 'text', 'onPrimary', 'qr']) k)
    and (select count(*) from jsonb_object_keys(p)) <= 6
  );
$$;

alter table public.quote_issuer_profiles drop constraint if exists quote_issuer_profiles_brand_colors_check;
alter table public.quote_issuer_profiles add constraint quote_issuer_profiles_brand_colors_check check (public.valid_brand_colors(brand_colors));
alter table public.quote_issuer_profiles drop constraint if exists quote_issuer_profiles_brand_follow_check;
alter table public.quote_issuer_profiles add constraint quote_issuer_profiles_brand_follow_check check (jsonb_typeof(brand_follow) = 'object');
alter table public.link_in_bio drop constraint if exists link_in_bio_brand_colors_check;
alter table public.link_in_bio add constraint link_in_bio_brand_colors_check check (public.valid_brand_colors(brand_colors));

-- Sincronizza i servizi che seguono il brand
create or replace function public.brand_sync(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b jsonb;
  f jsonb;
begin
  select brand_colors, brand_follow into b, f from public.quote_issuer_profiles where user_id = p_user;
  if b is null then
    return;
  end if;
  perform set_config('kumani.brand_sync', '1', true);
  if coalesce((f ->> 'landing')::boolean, false) then
    update public.landing_pages set accent = lower(b ->> 'primary')
     where owner_id = p_user and accent is distinct from lower(b ->> 'primary');
  end if;
  if coalesce((f ->> 'qr')::boolean, false) then
    update public.qr_pro_codes set fg_color = lower(b ->> 'qr'), bg_color = '#ffffff'
     where user_id = p_user and (lower(fg_color) is distinct from lower(b ->> 'qr') or lower(bg_color) is distinct from '#ffffff');
  end if;
  if coalesce((f ->> 'bio')::boolean, false) then
    update public.link_in_bio set theme = 'brand', brand_colors = b
     where user_id = p_user and (theme is distinct from 'brand' or brand_colors is distinct from b);
  end if;
  perform set_config('kumani.brand_sync', '', true);
end;
$$;
revoke all on function public.brand_sync(uuid) from public, anon, authenticated;

-- Scheda attività: brand cambiato → colore principale e stile dei preventivi;
-- stile dei preventivi cambiato a mano → i preventivi non seguono più il brand
create or replace function public.brand_profile_before()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  b jsonb := new.brand_colors;
  follows_quotes boolean := coalesce((new.brand_follow ->> 'quotes')::boolean, false);
  style jsonb := coalesce(new.quote_band_style, '{}'::jsonb);
begin
  if b is null then
    return new;
  end if;
  if tg_op = 'INSERT' or new.brand_colors is distinct from old.brand_colors or new.brand_follow is distinct from old.brand_follow then
    new.accent := lower(b ->> 'primary');
    if follows_quotes then
      new.quote_band_style := style || jsonb_build_object('band', lower(b ->> 'primary'), 'line', lower(b ->> 'accent'));
    end if;
  elsif new.quote_band_style is distinct from old.quote_band_style
    and coalesce(current_setting('kumani.brand_sync', true), '') <> '1'
    and follows_quotes
    and (lower(style ->> 'band') is distinct from lower(b ->> 'primary') or lower(style ->> 'line') is distinct from lower(b ->> 'accent')) then
    new.brand_follow := new.brand_follow || '{"quotes": false}'::jsonb;
  end if;
  return new;
end;
$$;

create or replace function public.brand_profile_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Durante una sincronizzazione (o dal tema «brand» del Link in Bio) non si riparte
  if coalesce(current_setting('kumani.brand_sync', true), '') = '1' then
    return null;
  end if;
  if new.brand_colors is not null and (tg_op = 'INSERT' or new.brand_colors is distinct from old.brand_colors or new.brand_follow is distinct from old.brand_follow) then
    perform public.brand_sync(new.user_id);
  end if;
  return null;
end;
$$;
revoke all on function public.brand_profile_after() from public, anon, authenticated;

drop trigger if exists brand_profile_before on public.quote_issuer_profiles;
create trigger brand_profile_before before insert or update on public.quote_issuer_profiles
  for each row execute function public.brand_profile_before();
drop trigger if exists brand_profile_after on public.quote_issuer_profiles;
create trigger brand_profile_after after insert or update of brand_colors, brand_follow on public.quote_issuer_profiles
  for each row execute function public.brand_profile_after();

-- Un servizio che non segue più il brand (colore cambiato a mano)
create or replace function public.brand_unfollow(p_user uuid, p_service text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.quote_issuer_profiles
     set brand_follow = brand_follow || jsonb_build_object(p_service, false)
   where user_id = p_user and coalesce((brand_follow ->> p_service)::boolean, false);
$$;
revoke all on function public.brand_unfollow(uuid, text) from public, anon, authenticated;

create or replace function public.brand_landing_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b jsonb;
begin
  if coalesce(current_setting('kumani.brand_sync', true), '') = '1' then
    return new;
  end if;
  select brand_colors into b from public.quote_issuer_profiles where user_id = new.owner_id;
  if b is not null and lower(new.accent) is distinct from lower(b ->> 'primary') then
    perform public.brand_unfollow(new.owner_id, 'landing');
  end if;
  return new;
end;
$$;
revoke all on function public.brand_landing_check() from public, anon, authenticated;
drop trigger if exists brand_landing_check on public.landing_pages;
create trigger brand_landing_check after insert or update of accent on public.landing_pages
  for each row execute function public.brand_landing_check();

create or replace function public.brand_qr_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b jsonb;
begin
  if coalesce(current_setting('kumani.brand_sync', true), '') = '1' then
    return new;
  end if;
  select brand_colors into b from public.quote_issuer_profiles where user_id = new.user_id;
  if b is not null and (lower(new.fg_color) is distinct from lower(b ->> 'qr') or lower(new.bg_color) is distinct from '#ffffff') then
    perform public.brand_unfollow(new.user_id, 'qr');
  end if;
  return new;
end;
$$;
revoke all on function public.brand_qr_check() from public, anon, authenticated;
drop trigger if exists brand_qr_check on public.qr_pro_codes;
create trigger brand_qr_check after insert or update of fg_color, bg_color on public.qr_pro_codes
  for each row execute function public.brand_qr_check();

-- Link in Bio: scegliere il tema «brand» lo fa seguire, un altro tema no
create or replace function public.brand_bio_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b jsonb;
begin
  if coalesce(current_setting('kumani.brand_sync', true), '') = '1' then
    return new;
  end if;
  if new.theme = 'brand' then
    select brand_colors into b from public.quote_issuer_profiles where user_id = new.user_id;
    if b is null then
      new.theme := coalesce(case when tg_op = 'UPDATE' then old.theme end, 'rosa');
      if new.theme = 'brand' then new.theme := 'rosa'; end if;
      return new;
    end if;
    new.brand_colors := b;
    perform set_config('kumani.brand_sync', '1', true);
    update public.quote_issuer_profiles set brand_follow = brand_follow || '{"bio": true}'::jsonb
     where user_id = new.user_id and not coalesce((brand_follow ->> 'bio')::boolean, false);
    perform set_config('kumani.brand_sync', '', true);
  elsif tg_op = 'INSERT' or new.theme is distinct from old.theme then
    perform public.brand_unfollow(new.user_id, 'bio');
  end if;
  return new;
end;
$$;
revoke all on function public.brand_bio_before() from public, anon, authenticated;
drop trigger if exists brand_bio_before on public.link_in_bio;
create trigger brand_bio_before before insert or update of theme on public.link_in_bio
  for each row execute function public.brand_bio_before();
