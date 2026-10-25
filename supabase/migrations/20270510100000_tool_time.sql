-- Tempo passato dentro ogni servizio (Admin → Attività del giorno): una riga
-- per utente, servizio e giorno (ora di Roma) con i secondi attivi. Si
-- aggiunge con lo stesso segnale delle sessioni (session_ping): il browser
-- manda quale servizio era aperto dall'ultimo segnale, solo con la pagina in
-- primo piano. Lo Staff non viene contato. Nessun dato su cosa si fa dentro.

create table if not exists public.tool_time (
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_name text not null,
  day date not null default ((now() at time zone 'Europe/Rome')::date),
  active_seconds integer not null default 0,
  primary key (user_id, tool_name, day)
);
create index if not exists tool_time_day_idx on public.tool_time (day);
alter table public.tool_time enable row level security;
-- Nessuna regola: si scrive solo con session_ping, si legge solo dall'Admin (chiave di servizio)

drop function if exists public.session_ping(text);

create or replace function public.session_ping(p_device text default 'desktop', p_tool text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.user_sessions%rowtype;
  v_delta integer;
begin
  if v_uid is null or public.admin_is_staff(v_uid) then
    return;
  end if;
  -- Segnali contemporanei dello stesso utente (pagina che si chiude e pagina
  -- che si apre) uno alla volta: altrimenti nascerebbero due sessioni
  perform pg_advisory_xact_lock(hashtext('session_ping:' || v_uid::text));
  select * into v_session
  from public.user_sessions
  where user_id = v_uid and last_active_at > now() - interval '30 minutes'
  order by last_active_at desc
  limit 1
  for update;
  if not found then
    insert into public.user_sessions (user_id, device)
    values (v_uid, case when p_device = 'mobile' then 'mobile' else 'desktop' end);
    return;
  end if;
  -- Più schede aperte mandano segnali vicini: si conta solo il tempo davvero passato
  if now() - v_session.last_active_at < interval '15 seconds' then
    return;
  end if;
  -- Al massimo 2 minuti per segnale: un buco più lungo non è tempo d'uso
  v_delta := least(extract(epoch from now() - v_session.last_active_at)::integer, 120);
  update public.user_sessions
  set last_active_at = now(),
      active_seconds = active_seconds + v_delta,
      pings = pings + 1
  where id = v_session.id;
  -- Lo stesso tempo va al servizio che era aperto (solo servizi esistenti)
  if p_tool is not null and p_tool ~ '^[a-z0-9-]{2,40}$'
     and exists (select 1 from public.marketplace_settings where tool_name = p_tool) then
    insert into public.tool_time (user_id, tool_name, active_seconds)
    values (v_uid, p_tool, v_delta)
    on conflict (user_id, tool_name, day) do update
      set active_seconds = public.tool_time.active_seconds + excluded.active_seconds;
  end if;
end;
$$;
revoke all on function public.session_ping(text, text) from public, anon;
grant execute on function public.session_ping(text, text) to authenticated;

-- Pulizia notturna (stessa operazione delle sessioni): anche il tempo per servizio dopo 13 mesi
create or replace function public.user_sessions_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_sessions where started_at < now() - interval '13 months';
  delete from public.tool_time where day < (now() - interval '13 months')::date;
$$;
revoke all on function public.user_sessions_cleanup() from public, anon, authenticated;
