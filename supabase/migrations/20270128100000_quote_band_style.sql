-- Preventivi: aspetto della «Fascia» del logo (colore della fascia, colore
-- della riga sotto e altezza), per preventivo; l'ultima scelta resta nel
-- profilo azienda e si ripropone nei preventivi nuovi.
-- { "band": "#969696", "line": "#f0a830", "height": 30 }
alter table public.quotes add column if not exists band_style jsonb;
alter table public.quote_issuer_profiles add column if not exists quote_band_style jsonb;
