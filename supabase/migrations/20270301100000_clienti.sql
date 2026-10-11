-- KUMANI PRO «Clienti e Lavori» (fase 1): i clienti sono quelli che i
-- Preventivi già salvano (quote_clients), con in più note e «prossimo passo».
-- Ogni preventivo punta al suo cliente (client_id), così la scheda cliente
-- somma preventivi accettati, incassi e quanto resta da incassare.

-- Servizio PRO
insert into public.marketplace_settings (tool_name, is_enabled, required_plan, description)
values ('clienti', true, 'pro', 'Clienti e Lavori – schede clienti, prossimi passi e conti')
on conflict (tool_name) do nothing;

insert into public.ku_activity_points (key, label, points, sort_order)
values ('clienti', 'Clienti e Lavori', 1, 10)
on conflict (key) do nothing;

-- Campi nuovi della scheda cliente
alter table public.quote_clients add column if not exists notes text;
alter table public.quote_clients add column if not exists next_step text;
alter table public.quote_clients add column if not exists next_step_due date;
alter table public.quote_clients add column if not exists contact_name text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quote_clients_crm_limits_check') then
    alter table public.quote_clients add constraint quote_clients_crm_limits_check check (
      char_length(name) <= 200 and char_length(coalesce(notes, '')) <= 3000
      and char_length(coalesce(next_step, '')) <= 200 and char_length(coalesce(contact_name, '')) <= 120
      and char_length(coalesce(email, '')) <= 200 and char_length(coalesce(phone, '')) <= 60
      and char_length(coalesce(address, '')) <= 300 and char_length(coalesce(city, '')) <= 120
    ) not valid;
  end if;
end $$;

-- Salvare i clienti: con i Preventivi oppure con Clienti e Lavori
drop policy if exists quote_clients_plan_insert on public.quote_clients;
create policy quote_clients_plan_insert on public.quote_clients as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed)
           or exists (select 1 from public.can_use_tool('clienti') t where t.allowed));
drop policy if exists quote_clients_plan_update on public.quote_clients;
create policy quote_clients_plan_update on public.quote_clients as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('preventivi') t where t.allowed)
      or exists (select 1 from public.can_use_tool('clienti') t where t.allowed));

-- Preventivo → cliente (solo un cliente proprio)
alter table public.quotes add column if not exists client_id uuid references public.quote_clients(id) on delete set null;
create index if not exists quotes_client_idx on public.quotes (client_id) where client_id is not null;
drop trigger if exists quotes_own_client on public.quotes;
create trigger quotes_own_client before insert or update of client_id on public.quotes
  for each row execute function public.check_own_reference('client_id', 'quote_clients');

-- Preventivi già fatti: collegati al cliente con lo stesso nome
update public.quotes q
set client_id = c.id
from (
  select distinct on (user_id, lower(trim(name))) id, user_id, lower(trim(name)) as key
  from public.quote_clients
  order by user_id, lower(trim(name)), created_at
) c
where q.client_id is null and q.user_id = c.user_id and lower(trim(q.client_name)) = c.key;

-- Riepilogo dei clienti di chi chiama: preventivi, accettati (con IVA,
-- esclusi i rimborsati), incassato online e quanto resta
create or replace function public.my_clients_overview()
returns table (
  id uuid, name text, contact_name text, email text, phone text, city text,
  next_step text, next_step_due date, updated_at timestamptz,
  quotes_count integer, accepted_total numeric, paid_total numeric, owed numeric, last_quote_at date
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select
      client_id,
      count(*)::integer as quotes_count,
      coalesce(sum(case when (accepted_at is not null or payment_status = 'paid') and payment_status <> 'refunded' then
        round(case when vat_mode = 'plus' and coalesce(vat_rate, 0) > 0 then total * (1 + vat_rate / 100) else total end, 2)
      end), 0) as accepted_total,
      coalesce(sum(case when payment_status = 'paid' then paid_amount end), 0) as paid_total,
      max(issue_date) as last_quote_at
    from public.quotes
    where user_id = auth.uid() and client_id is not null
    group by client_id
  )
  select c.id, c.name, c.contact_name, c.email, c.phone, c.city, c.next_step, c.next_step_due, c.updated_at,
         coalesce(q.quotes_count, 0), coalesce(q.accepted_total, 0), coalesce(q.paid_total, 0),
         greatest(coalesce(q.accepted_total, 0) - coalesce(q.paid_total, 0), 0), q.last_quote_at
  from public.quote_clients c
  left join q on q.client_id = c.id
  where c.user_id = auth.uid()
  order by c.name;
$$;
revoke all on function public.my_clients_overview() from public, anon;
grant execute on function public.my_clients_overview() to authenticated;

-- KU Karma per il nuovo servizio
CREATE OR REPLACE FUNCTION public.award_tool_point_for(p_user uuid, p_tool_name text)
 RETURNS TABLE(awarded boolean, new_balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_rows int;
  v_balance int;
  v_ku int;
begin
  if p_user is null then
    return;
  end if;

  if p_tool_name not in (
    'link-in-bio', 'memolife', 'neurobalance', 'svat',
    'offermaker', 'qr-code-pro', 'life-calendar', 'findo', 'digital-receipt',
    'spendly', 'fidelity', 'kumani-cv', 'preventivi', 'menu', 'veritas', 'travel', 'events', 'verifoto', 'timebank', 'magazzino', 'mosaic', 'fabula',
    'checkmail', 'oxygen',
    'documento-sicuro', 'verifica-iban', 'firma-email', 'calcolatrici', 'focus',
    'landing-page', 'garage', 'mandala', 'scudo-dati', 'casa', 'nexus', 'clienti'
  ) then
    return;
  end if;

  if not exists (select 1 from public.tool_access(p_user, p_tool_name) t where t.allowed) then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  insert into daily_tool_points (user_id, tool_name, awarded_on)
  values (p_user, p_tool_name, v_today)
  on conflict (user_id, tool_name, awarded_on) do nothing;

  get diagnostics v_rows = row_count;

  v_ku := public.ku_points_for(p_tool_name);
  if v_rows = 0 or v_ku = 0 then
    select daily_points into v_balance from profiles where id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  update profiles
  set daily_points = coalesce(daily_points, 0) + v_ku,
      ku_earned_total = coalesce(ku_earned_total, 0) + v_ku
  where id = p_user
  returning daily_points into v_balance;

  return query select true, v_balance;
end;
$function$;
