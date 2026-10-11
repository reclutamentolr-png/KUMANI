-- «I colori del tuo brand», correzioni dopo la revisione:
-- • brand_follow accetta solo true/false (un valore diverso bloccava ogni
--   salvataggio della Scheda attività);
-- • Link in Bio: il tema «brand» vuol dire seguire il brand. Se il brand non
--   è più seguito, la pagina torna al tema di partenza; salvare la pagina con
--   lo stesso tema non la riaggancia da sola.

create or replace function public.valid_brand_follow(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'object'
    and not exists (select 1 from jsonb_each(p) e where jsonb_typeof(e.value) <> 'boolean');
$$;

update public.quote_issuer_profiles set brand_follow = '{}'::jsonb where not public.valid_brand_follow(brand_follow);
alter table public.quote_issuer_profiles drop constraint if exists quote_issuer_profiles_brand_follow_check;
alter table public.quote_issuer_profiles add constraint quote_issuer_profiles_brand_follow_check check (public.valid_brand_follow(brand_follow));

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
  else
    update public.link_in_bio set theme = 'rosa', brand_colors = null
     where user_id = p_user and theme = 'brand';
  end if;
  perform set_config('kumani.brand_sync', '', true);
end;
$$;
revoke all on function public.brand_sync(uuid) from public, anon, authenticated;

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
      new.theme := coalesce(case when tg_op = 'UPDATE' and old.theme <> 'brand' then old.theme end, 'rosa');
      new.brand_colors := null;
      return new;
    end if;
    new.brand_colors := b;
    -- Riaggancio solo quando il tema «brand» viene scelto adesso
    if tg_op = 'INSERT' or old.theme is distinct from 'brand' then
      perform set_config('kumani.brand_sync', '1', true);
      update public.quote_issuer_profiles set brand_follow = brand_follow || '{"bio": true}'::jsonb
       where user_id = new.user_id and not coalesce((brand_follow ->> 'bio')::boolean, false);
      perform set_config('kumani.brand_sync', '', true);
    end if;
  elsif tg_op = 'INSERT' or new.theme is distinct from old.theme then
    perform public.brand_unfollow(new.user_id, 'bio');
  end if;
  return new;
end;
$$;
revoke all on function public.brand_bio_before() from public, anon, authenticated;
