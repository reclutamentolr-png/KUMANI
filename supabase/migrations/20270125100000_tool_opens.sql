-- Servizi più usati (Admin → Panoramica).
--
-- tool_opens: una riga per utente, servizio e giorno in cui l'ha aperto
-- (registrata dal sito una volta al giorno, vedi ToolOpenTracker). Insieme a
-- daily_tool_points (uso effettivo che dà i KU Karma) serve a contare quante
-- persone diverse usano ogni servizio. Nessun dato su cosa fa nel servizio.

create table if not exists public.tool_opens (
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  opened_on date not null default ((now() at time zone 'Europe/Rome')::date),
  primary key (user_id, tool_name, opened_on)
);
create index if not exists tool_opens_day_idx on public.tool_opens (opened_on, tool_name);

alter table public.tool_opens enable row level security;
-- Nessuna policy: si scrive solo con record_tool_open, si legge solo dal server.

create or replace function public.record_tool_open(p_tool text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not exists (select 1 from public.marketplace_settings where tool_name = p_tool) then
    return;
  end if;
  insert into public.tool_opens (user_id, tool_name)
  values (auth.uid(), p_tool)
  on conflict do nothing;
end;
$$;
revoke all on function public.record_tool_open(text) from public, anon;
grant execute on function public.record_tool_open(text) to authenticated;

-- Persone diverse che hanno usato ogni servizio negli ultimi p_days giorni
-- (aperture + uso con KU Karma) e giorni d'uso complessivi.
create or replace function public.admin_tool_usage(p_days int default 30)
returns table (tool_name text, users bigint, use_days bigint)
language sql
stable
security definer
set search_path = public
as $$
  with u as (
    select user_id, tool_name, opened_on as d
    from public.tool_opens
    where opened_on > ((now() at time zone 'Europe/Rome')::date - p_days)
    union
    select user_id, tool_name, awarded_on
    from public.daily_tool_points
    where awarded_on > ((now() at time zone 'Europe/Rome')::date - p_days)
  )
  select tool_name, count(distinct user_id), count(*)
  from u
  group by tool_name;
$$;
revoke all on function public.admin_tool_usage(int) from public, anon, authenticated;
grant execute on function public.admin_tool_usage(int) to service_role;

-- Pulizia: le aperture servono solo per le statistiche recenti
create or replace function public.cleanup_tool_opens()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.tool_opens where opened_on < ((now() at time zone 'Europe/Rome')::date - 400);
$$;
revoke all on function public.cleanup_tool_opens() from public, anon, authenticated;
select cron.schedule('kumani-tool-opens-cleanup', '45 2 * * *', 'select public.cleanup_tool_opens()');
