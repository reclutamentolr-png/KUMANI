-- Spendly: addebito automatico delle spese fisse e delle bollette (es.
-- abbonamenti pagati con la carta). Vuoto = spento. Altrimenti è il primo
-- giorno ancora da registrare: le scadenze da quel giorno a oggi si segnano
-- pagate con l'importo previsto e il metodo della spesa, poi la data passa a
-- domani. Così un «Annulla» su una scadenza già registrata resta annullato.

alter table public.spendly_fixed_expenses
  add column if not exists auto_pay_from date;
