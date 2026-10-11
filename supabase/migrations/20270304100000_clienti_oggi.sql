-- KUMANI PRO «Clienti e Lavori» (fase 4): la sezione «Oggi».
-- Il lavoro ricorda quando è stato consegnato (delivered_at), così si sa da
-- quanti giorni aspetta il saldo. my_clients_today() raccoglie in una
-- chiamata: chi sentire oggi, lavori consegnati ancora da incassare, lavori
-- che iniziano o vanno consegnati oggi e il numero di lavori aperti.

alter table public.client_jobs add column if not exists delivered_at timestamptz;

create or replace function public.client_jobs_delivered()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.stage in ('done', 'paid') then
    if tg_op = 'INSERT' or old.stage not in ('done', 'paid') or new.delivered_at is null then
      new.delivered_at := coalesce(case when tg_op = 'UPDATE' and old.stage in ('done', 'paid') then old.delivered_at end, now());
    end if;
  else
    new.delivered_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists client_jobs_delivered on public.client_jobs;
create trigger client_jobs_delivered before insert or update of stage on public.client_jobs
  for each row execute function public.client_jobs_delivered();

update public.client_jobs set delivered_at = updated_at where stage in ('done', 'paid') and delivered_at is null;

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
      coalesce(j.amount, round(case when q.vat_mode = 'plus' and coalesce(q.vat_rate, 0) > 0 then q.total * (1 + q.vat_rate / 100) else q.total end, 2)) as price,
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
