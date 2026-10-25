-- Quante email partono con Resend, giorno per giorno: l'Admin avvisa quando si
-- arriva al 90% dei limiti del piano gratuito (100 al giorno, 3.000 al mese),
-- così lo Staff può controllare e, se serve, passare al piano a pagamento.
-- I limiti si cambiano in system_settings (resend_daily_limit, resend_monthly_limit).

create table if not exists public.email_usage (
  day date primary key,
  sent integer not null default 0
);
alter table public.email_usage enable row level security;

-- Somma le email partite oggi (ora italiana). Solo chiave di servizio.
create or replace function public.email_usage_add(p_n integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.email_usage (day, sent)
  values ((now() at time zone 'Europe/Rome')::date, greatest(p_n, 0))
  on conflict (day) do update set sent = public.email_usage.sent + excluded.sent;
$$;
revoke all on function public.email_usage_add(integer) from public, anon, authenticated;

insert into public.system_settings (key, value) values
  ('resend_daily_limit', '100'),
  ('resend_monthly_limit', '3000')
on conflict (key) do nothing;
