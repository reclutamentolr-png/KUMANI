-- KUMANI Casa: un apparecchio può indicare dove si trova usando le
-- posizioni di Findo (casa > stanza > mobile). Se la posizione viene tolta
-- in Findo, l'apparecchio resta senza posizione.
alter table public.casa_appliances
  add column if not exists findo_location_id uuid references public.findo_locations(id) on delete set null;
