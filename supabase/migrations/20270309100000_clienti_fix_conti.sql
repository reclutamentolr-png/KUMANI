-- Clienti e Lavori: una sola regola per i conti, uguale ovunque (elenco,
-- scheda, «Oggi», notifica del mattino).
-- Concordato = per ogni lavoro il suo prezzo (quello del lavoro, altrimenti il
-- preventivo collegato con IVA) + i preventivi accettati senza lavoro.
-- I preventivi rimborsati non contano. Incassato = pagamenti online dei
-- preventivi + pagamenti registrati a mano.
-- Shop: il cliente si riconosce solo da email o telefono, mai dal solo nome.

create or replace function public.quote_gross(p_total numeric, p_vat_mode text, p_vat_rate numeric)
returns numeric
language sql
immutable
as $$
  select round(case when p_vat_mode = 'plus' and coalesce(p_vat_rate, 0) > 0 then p_total * (1 + p_vat_rate / 100) else p_total end, 2);
$$;

drop function if exists public.my_clients_overview();
create function public.my_clients_overview()
returns table (
  id uuid, name text, contact_name text, email text, phone text, city text,
  next_step text, next_step_due date, updated_at timestamptz,
  quotes_count integer, open_jobs integer, accepted_total numeric, paid_total numeric, owed numeric, last_quote_at date
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
      -- preventivi accettati che non hanno un lavoro (quelli con lavoro contano nel lavoro)
      coalesce(sum(public.quote_gross(total, vat_mode, vat_rate)) filter (
        where (accepted_at is not null or payment_status = 'paid') and payment_status <> 'refunded'
          and not exists (select 1 from public.client_jobs j where j.quote_id = quotes.id and j.user_id = auth.uid())
      ), 0) as quotes_total,
      coalesce(sum(paid_amount) filter (where payment_status = 'paid'), 0) as paid_online,
      max(issue_date) as last_quote_at
    from public.quotes
    where user_id = auth.uid() and client_id is not null
    group by client_id
  ),
  j as (
    select
      j.client_id,
      count(*) filter (where j.stage in ('todo', 'doing'))::integer as open_jobs,
      coalesce(sum(coalesce(j.amount, case when qq.payment_status is distinct from 'refunded' then public.quote_gross(qq.total, qq.vat_mode, qq.vat_rate) end)), 0) as jobs_total
    from public.client_jobs j
    left join public.quotes qq on qq.id = j.quote_id
    where j.user_id = auth.uid()
    group by j.client_id
  ),
  p as (
    select client_id, coalesce(sum(amount), 0) as paid_manual
    from public.client_payments
    where user_id = auth.uid()
    group by client_id
  )
  select c.id, c.name, c.contact_name, c.email, c.phone, c.city, c.next_step, c.next_step_due, c.updated_at,
         coalesce(q.quotes_count, 0),
         coalesce(j.open_jobs, 0),
         coalesce(q.quotes_total, 0) + coalesce(j.jobs_total, 0),
         coalesce(q.paid_online, 0) + coalesce(p.paid_manual, 0),
         greatest(coalesce(q.quotes_total, 0) + coalesce(j.jobs_total, 0) - coalesce(q.paid_online, 0) - coalesce(p.paid_manual, 0), 0),
         q.last_quote_at
  from public.quote_clients c
  left join q on q.client_id = c.id
  left join j on j.client_id = c.id
  left join p on p.client_id = c.id
  where c.user_id = auth.uid()
  order by c.name;
$$;
revoke all on function public.my_clients_overview() from public, anon;
grant execute on function public.my_clients_overview() to authenticated;

create or replace function public.my_clients_today(p_today date default null)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with today as (
    select coalesce(p_today, (now() at time zone 'Europe/Rome')::date) as d
  ),
  jobs as (
    select
      j.id, j.title, j.stage, j.client_id, j.start_date, j.due_date, j.delivered_at,
      c.name as client_name, c.phone as client_phone,
      coalesce(j.amount, case when q.payment_status is distinct from 'refunded' then public.quote_gross(q.total, q.vat_mode, q.vat_rate) end) as price,
      coalesce((select sum(p.amount) from public.client_payments p where p.job_id = j.id and p.user_id = auth.uid()), 0)
        + coalesce(case when q.payment_status = 'paid' then q.paid_amount end, 0) as paid
    from public.client_jobs j
    join public.quote_clients c on c.id = j.client_id
    left join public.quotes q on q.id = j.quote_id
    where j.user_id = auth.uid()
  )
  select jsonb_build_object(
    'today', (select d from today),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'step', c.next_step, 'due', c.next_step_due) order by c.next_step_due, c.name)
      from public.quote_clients c, today
      where c.user_id = auth.uid() and c.next_step is not null and c.next_step_due <= today.d
    ), '[]'::jsonb),
    'toCollect', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'clientId', j.client_id, 'clientName', j.client_name, 'phone', j.client_phone,
        'left', round(j.price - j.paid, 2), 'days', greatest(0, today.d - (j.delivered_at at time zone 'Europe/Rome')::date)
      ) order by j.delivered_at)
      from jobs j, today
      where j.stage = 'done' and j.price is not null and j.price - j.paid > 0.009
    ), '[]'::jsonb),
    'agenda', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id, 'title', j.title, 'clientName', j.client_name,
        'kind', case when j.start_date = today.d then 'start' else 'due' end
      ) order by j.client_name)
      from jobs j, today
      where j.stage in ('todo', 'doing') and (j.start_date = today.d or j.due_date = today.d)
    ), '[]'::jsonb),
    'lateDue', coalesce((
      select jsonb_agg(jsonb_build_object('id', j.id, 'title', j.title, 'clientName', j.client_name, 'due', j.due_date) order by j.due_date)
      from jobs j, today
      where j.stage in ('todo', 'doing') and j.due_date < today.d
    ), '[]'::jsonb),
    'openJobs', (select count(*) from jobs where stage in ('todo', 'doing'))
  );
$$;
revoke all on function public.my_clients_today(date) from public, anon;
grant execute on function public.my_clients_today(date) to authenticated;

-- Shop: cliente riconosciuto solo da email o telefono (due persone con lo
-- stesso nome non si mescolano); i contatti mancanti si completano soltanto
create or replace function public.shop_order_link_client(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  v_client uuid;
  v_phone text;
begin
  select id, owner_id, customer_name, customer_email, customer_phone, client_id, paid_at
    into o from public.shop_orders where id = p_order;
  if o.id is null or o.paid_at is null or o.client_id is not null then
    return;
  end if;
  if not exists (select 1 from public.tool_access(o.owner_id, 'clienti') x where x.allowed) then
    return;
  end if;

  select id into v_client from public.quote_clients
   where user_id = o.owner_id and email is not null and lower(email) = lower(o.customer_email)
   order by created_at limit 1;
  v_phone := right(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g'), 9);
  if v_client is null and length(v_phone) >= 6 then
    select id into v_client from public.quote_clients
     where user_id = o.owner_id and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = v_phone
     order by created_at limit 1;
  end if;

  if v_client is null then
    insert into public.quote_clients (user_id, name, email, phone)
    values (o.owner_id, left(trim(o.customer_name), 200), left(o.customer_email, 200), left(o.customer_phone, 60))
    returning id into v_client;
  else
    update public.quote_clients
       set email = coalesce(email, left(o.customer_email, 200)),
           phone = coalesce(phone, left(o.customer_phone, 60))
     where id = v_client;
  end if;

  update public.shop_orders set client_id = v_client where id = o.id;
exception when others then
  return;
end;
$$;
revoke all on function public.shop_order_link_client(uuid) from public, anon, authenticated;
