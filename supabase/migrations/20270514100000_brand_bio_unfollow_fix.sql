-- Link in Bio: salvare con un tema diverso da «brand» mentre la pagina segue
-- i colori del brand dava «ON CONFLICT DO UPDATE command cannot affect row a
-- second time». Lo sgancio (brand_unfollow) cambiava brand_follow, il trigger
-- della Scheda attività ripartiva (brand_sync) e modificava la stessa riga di
-- link_in_bio che il salvataggio stava scrivendo. Lo sgancio ora avviene in
-- modalità sincronizzazione: cambia solo brand_follow.bio e non riparte nulla
-- (gli altri servizi non cambiano, quindi non serve risincronizzarli).
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
    -- Sgancio senza far ripartire brand_sync sulla riga che si sta salvando
    new.brand_colors := null;
    perform set_config('kumani.brand_sync', '1', true);
    perform public.brand_unfollow(new.user_id, 'bio');
    perform set_config('kumani.brand_sync', '', true);
  end if;
  return new;
end;
$$;
