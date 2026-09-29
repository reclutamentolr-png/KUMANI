-- Passo 3 dell'alleggerimento del database: pulizia automatica ogni notte.
-- Si può eseguire più volte senza problemi (la programmazione si rinnova).
--
-- Cosa si cancella:
--   - messaggi della Bacheca dopo 30 giorni (avviso ben visibile nella chat
--     e nella pagina "I miei messaggi");
--   - annunci scaduti da oltre 90 giorni e senza più messaggi collegati;
--   - stanze di Veritas create da oltre 7 giorni (giocatori, risposte e voti
--     si cancellano con la stanza);
--   - storico dei punti KU giornalieri per strumento oltre 30 giorni (si
--     legge solo quello di oggi; i saldi punti non cambiano).
-- Ogni pulizia è separata: se una non riesce, le altre vanno avanti.

create index if not exists messages_created_idx on public.messages (created_at);
create index if not exists daily_tool_points_awarded_idx on public.daily_tool_points (awarded_on);
create index if not exists veritas_rooms_created_idx on public.veritas_rooms (created_at);

create or replace function public.kumani_nightly_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_messages int := 0;
  v_listings int := 0;
  v_rooms int := 0;
  v_points int := 0;
begin
  begin
    delete from public.messages where created_at < now() - interval '30 days';
    get diagnostics v_messages = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup messages: %', sqlerrm;
  end;

  begin
    delete from public.listings l
    where l.expires_at < now() - interval '90 days'
      and not exists (select 1 from public.messages m where m.listing_id = l.id);
    get diagnostics v_listings = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup listings: %', sqlerrm;
  end;

  begin
    delete from public.veritas_rooms where created_at < now() - interval '7 days';
    get diagnostics v_rooms = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup veritas: %', sqlerrm;
  end;

  begin
    delete from public.daily_tool_points where awarded_on < current_date - 30;
    get diagnostics v_points = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup points: %', sqlerrm;
  end;

  return jsonb_build_object('messages', v_messages, 'listings', v_listings, 'veritas_rooms', v_rooms, 'tool_points', v_points, 'at', now());
end;
$$;
-- Solo la programmazione notturna (e lo Staff dal SQL Editor) la esegue
revoke all on function public.kumani_nightly_cleanup() from public, anon, authenticated;

-- Programmazione: ogni notte alle 02:30 UTC (04:30 in Italia d'estate,
-- 03:30 d'inverno), con l'estensione pg_cron di Supabase.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'kumani-nightly-cleanup';
end $$;

select cron.schedule('kumani-nightly-cleanup', '30 2 * * *', 'select public.kumani_nightly_cleanup()');
