-- Admin → Comunicazioni: grafica dell'email e destinatari.
-- email_layout: 'classic' (testo semplice, come finora), 'rivista' o 'lettera'
-- (testo a blocchi, src/lib/emailBlocks.ts).
-- audience: 'all' (tutti gli iscritti) o 'subscribers' (solo chi ha un piano
-- attivo: esclude chi non ha l'abbonamento, ad esempio per messaggi che parlano
-- della licenza). Vale per email, notifica e campanella.
alter table public.staff_communications
  add column if not exists email_layout text not null default 'classic',
  add column if not exists audience text not null default 'all';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'staff_communications_email_layout_check') then
    alter table public.staff_communications add constraint staff_communications_email_layout_check check (email_layout in ('classic', 'rivista', 'lettera'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'staff_communications_audience_check') then
    alter table public.staff_communications add constraint staff_communications_audience_check check (audience in ('all', 'subscribers'));
  end if;
end $$;

notify pgrst, 'reload schema';
