-- Strumenti social con l'AI (LUMEN «Scrivi con l'AI», e i prossimi: didascalie,
-- calendario dei post, sottotitoli): un solo contatore giornaliero per tipo e
-- per utente, con il limite deciso in system_settings (<tipo>_ai_daily_runs).
create table if not exists public.social_ai_usage (
  kind text not null check (kind in ('lumen', 'captions', 'calendar', 'subtitles')),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  used_on date not null,
  runs integer not null default 0,
  primary key (kind, owner_id, used_on)
);
alter table public.social_ai_usage enable row level security;
revoke all on public.social_ai_usage from anon, authenticated;

insert into public.system_settings (key, value)
values ('lumen_ai_daily_runs', '10')
on conflict (key) do nothing;

CREATE OR REPLACE FUNCTION public.ai_quota_take(p_kind text, p_user uuid, p_limit integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_runs integer;
  v_day date := (now() at time zone 'utc')::date; -- come il resto del codice (data UTC)
begin
  if p_limit is null or p_limit <= 0 or p_user is null then
    return null;
  end if;
  if p_kind = 'offermaker' then
    insert into public.offermaker_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  elsif p_kind = 'menu' then
    insert into public.menu_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  elsif p_kind = 'landing' then
    insert into public.landing_ai_usage as u (owner_id, used_on, runs)
    values (p_user, v_day, 1)
    on conflict (owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  elsif p_kind in ('lumen', 'captions', 'calendar', 'subtitles') then
    insert into public.social_ai_usage as u (kind, owner_id, used_on, runs)
    values (p_kind, p_user, v_day, 1)
    on conflict (kind, owner_id, used_on) do update set runs = u.runs + 1 where u.runs < p_limit
    returning u.runs into v_runs;
  else
    raise exception 'unknown_kind';
  end if;
  return v_runs;
end;
$function$
;
revoke all on function public.ai_quota_take(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_quota_take(text, uuid, integer) to service_role;
