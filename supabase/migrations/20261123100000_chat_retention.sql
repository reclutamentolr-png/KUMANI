-- Cancellazione dopo 30 giorni anche per le chat di Affinity, Kordata e
-- Banca del Tempo (come la Bacheca). Nelle chat c'è un avviso ben visibile.
-- La pulizia notturna resta la stessa (kumani-nightly-cleanup, pg_cron):
-- qui si aggiorna solo la funzione che esegue. Si può rieseguire.
--
-- Banca del Tempo: i messaggi di uno scambio contestato restano finché la
-- contestazione è aperta, perché lo Staff può doverli leggere per decidere.

create index if not exists affinity_messages_created_idx on public.affinity_messages (created_at);
create index if not exists convivio_messages_created_idx on public.convivio_messages (created_at);
create index if not exists timebank_messages_created_idx on public.timebank_messages (created_at);

create or replace function public.kumani_nightly_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_messages int := 0;
  v_affinity int := 0;
  v_convivio int := 0;
  v_timebank int := 0;
  v_listings int := 0;
  v_rooms int := 0;
  v_points int := 0;
begin
  -- Chat della Bacheca
  begin
    delete from public.messages where created_at < now() - interval '30 days';
    get diagnostics v_messages = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup messages: %', sqlerrm;
  end;

  -- Chat di Affinity
  begin
    delete from public.affinity_messages where created_at < now() - interval '30 days';
    get diagnostics v_affinity = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup affinity: %', sqlerrm;
  end;

  -- Chat di Kordata
  begin
    delete from public.convivio_messages where created_at < now() - interval '30 days';
    get diagnostics v_convivio = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup convivio: %', sqlerrm;
  end;

  -- Chat della Banca del Tempo (non quelle degli scambi contestati)
  begin
    delete from public.timebank_messages m
    where m.created_at < now() - interval '30 days'
      and not exists (select 1 from public.timebank_exchanges e where e.id = m.exchange_id and e.status = 'disputed');
    get diagnostics v_timebank = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup timebank: %', sqlerrm;
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

  return jsonb_build_object(
    'messages', v_messages, 'affinity_messages', v_affinity, 'convivio_messages', v_convivio,
    'timebank_messages', v_timebank, 'listings', v_listings, 'veritas_rooms', v_rooms,
    'tool_points', v_points, 'at', now()
  );
end;
$$;
revoke all on function public.kumani_nightly_cleanup() from public, anon, authenticated;
