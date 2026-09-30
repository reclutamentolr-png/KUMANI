-- Pulizia notturna, terza parte: storici che crescevano senza limite.
-- Solo dati di dettaglio: totali, giacenze e saldi restano dove sono.
--   - clic dei QR Code PRO e di OfferMaker: 90 giorni (click_count resta);
--   - movimenti del Magazzino: 24 mesi (inventory_products.stock resta);
--   - timbri e premi della Kumi Card: 24 mesi (fidelity_members resta);
--   - QR usa-e-getta della cassa Kumi Card: 30 giorni dopo la scadenza.
-- Stessa programmazione notturna (kumani-nightly-cleanup): qui si aggiorna
-- solo la funzione. Si può rieseguire.

create index if not exists qr_pro_clicks_created_idx on public.qr_pro_clicks (created_at);
create index if not exists offermaker_clicks_created_idx on public.offermaker_clicks (created_at);
create index if not exists inventory_movements_created_idx on public.inventory_movements (created_at);
create index if not exists fidelity_events_created_idx on public.fidelity_events (created_at);
create index if not exists fidelity_claims_expires_idx on public.fidelity_claims (expires_at);

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
  v_qr_clicks int := 0;
  v_offer_clicks int := 0;
  v_movements int := 0;
  v_stamps int := 0;
  v_claims int := 0;
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

  -- Clic dei QR Code PRO e di OfferMaker oltre 90 giorni (i totali restano
  -- nel contatore click_count di ogni codice o campagna)
  begin
    delete from public.qr_pro_clicks where created_at < now() - interval '90 days';
    get diagnostics v_qr_clicks = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup qr clicks: %', sqlerrm;
  end;

  begin
    delete from public.offermaker_clicks where created_at < now() - interval '90 days';
    get diagnostics v_offer_clicks = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup offermaker clicks: %', sqlerrm;
  end;

  -- Movimenti del Magazzino oltre 24 mesi (la giacenza è nel prodotto)
  begin
    delete from public.inventory_movements where created_at < now() - interval '24 months';
    get diagnostics v_movements = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup inventory: %', sqlerrm;
  end;

  -- Timbri e premi della Kumi Card oltre 24 mesi (i saldi sono nella tessera
  -- del cliente) e QR usa-e-getta della cassa scaduti da oltre 30 giorni
  begin
    delete from public.fidelity_events where created_at < now() - interval '24 months';
    get diagnostics v_stamps = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup fidelity events: %', sqlerrm;
  end;

  begin
    delete from public.fidelity_claims where expires_at < now() - interval '30 days';
    get diagnostics v_claims = row_count;
  exception when others then
    raise warning 'kumani_nightly_cleanup fidelity claims: %', sqlerrm;
  end;

  return jsonb_build_object(
    'messages', v_messages, 'affinity_messages', v_affinity, 'convivio_messages', v_convivio,
    'timebank_messages', v_timebank, 'listings', v_listings, 'veritas_rooms', v_rooms,
    'tool_points', v_points, 'qr_clicks', v_qr_clicks, 'offermaker_clicks', v_offer_clicks,
    'inventory_movements', v_movements, 'fidelity_events', v_stamps, 'fidelity_claims', v_claims, 'at', now()
  );
end;
$$;
revoke all on function public.kumani_nightly_cleanup() from public, anon, authenticated;
