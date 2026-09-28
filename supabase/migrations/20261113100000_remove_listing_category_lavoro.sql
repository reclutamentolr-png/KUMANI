-- Bacheca: rimossa la categoria 'lavoro' (annunci di lavoro non ammessi,
-- per i rischi legali sugli annunci discriminatori). Resta la categoria
-- 'lavoro' del Marketplace (Preventivi, Magazzino, KUMANI CV), che è un'altra cosa.
--
-- Al momento della migrazione non esistono annunci 'lavoro'; se ne fosse
-- nato qualcuno nel frattempo, viene spostato in 'servizi' e disattivato.
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_category_check;

UPDATE listings SET category = 'servizi', is_active = false WHERE category = 'lavoro';

ALTER TABLE listings ADD CONSTRAINT listings_category_check
  CHECK (category = ANY (ARRAY[
    'veicoli', 'immobili', 'elettronica', 'moda', 'casa_persona', 'tempo_libero',
    'colf_badanti', 'agricoltura', 'animali', 'impresa', 'servizi'
  ]::text[]));
