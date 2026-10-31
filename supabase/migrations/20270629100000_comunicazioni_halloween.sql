-- Grafica «Halloween» per le email delle Comunicazioni (la Rivista con zucca e notte)
alter table public.staff_communications drop constraint if exists staff_communications_email_layout_check;
alter table public.staff_communications add constraint staff_communications_email_layout_check check (email_layout in ('classic', 'rivista', 'lettera', 'halloween'));
