-- «Scrivi cosa ti serve» con l'IA quando la ricerca nei testi non basta:
-- un limite giornaliero per persona (need_ai_daily_runs, 30) sullo stesso
-- contatore degli altri strumenti, e una memoria delle risposte (la stessa
-- richiesta nella stessa lingua non chiede di nuovo all'IA per 30 giorni).

alter table public.social_ai_usage drop constraint if exists social_ai_usage_kind_check;
alter table public.social_ai_usage add constraint social_ai_usage_kind_check check (kind in ('lumen', 'captions', 'calendar', 'subtitles', 'need'));

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
  elsif p_kind in ('lumen', 'captions', 'calendar', 'subtitles', 'need') then
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

insert into public.system_settings (key, value) values ('need_ai_daily_runs', '30') on conflict (key) do nothing;

-- Risposte già date dall'IA (solo testo della richiesta, lingua e servizi scelti)
create table if not exists public.need_search_cache (
  query_norm text not null,
  locale text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (query_norm, locale)
);
alter table public.need_search_cache enable row level security;
