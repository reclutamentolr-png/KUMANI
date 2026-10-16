-- Ecosistema: KUMANI Casa → Spese condivise di Spendly.
--
-- Una bolletta di Casa (che è una spesa fissa di Spendly) si può «dividere
-- nel gruppo»: diventa una spesa fissa del gruppo con la stessa frequenza
-- (ogni 1, 2, 3, 6 o 12 mesi), pagata da chi ha la bolletta e divisa tra
-- tutti. Restano collegate:
-- - quando la bolletta si segna pagata con l'importo reale, la spesa del
--   gruppo di quel mese prende l'importo reale (e torna alla stima se il
--   pagamento si toglie);
-- - se cambiano importo previsto, giorno, frequenza o fine della bolletta,
--   cambia anche la spesa fissa del gruppo (per i mesi che verranno).
-- Chi ha la bolletta la vede già per intero nel suo Spendly: «Porta la mia
-- quota in Spendly» non gliela aggiunge una seconda volta.

alter table public.spendly_group_recurring
  add column if not exists spendly_fixed_id uuid references public.spendly_fixed_expenses(id) on delete set null,
  add column if not exists every_months integer not null default 1 check (every_months in (1, 2, 3, 6, 12));
create unique index if not exists spendly_group_recurring_bill_idx
  on public.spendly_group_recurring (group_id, spendly_fixed_id) where spendly_fixed_id is not null;

create or replace function public.spendly_bill_step(p_frequency text)
returns integer
language sql
immutable
as $$
  select case p_frequency when 'mensile' then 1 when 'bimestrale' then 2 when 'trimestrale' then 3 when 'semestrale' then 6 when 'annuale' then 12 end;
$$;

-- Spese fisse arrivate (come prima, più la frequenza e l'importo reale della
-- bolletta collegata, se per quel mese è già segnata pagata)
create or replace function public.spendly_group_run_recurring(p_group uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Europe/Rome')::date;
  v_r record;
  v_due date;
  v_amount numeric;
  v_added integer := 0;
begin
  if not public.spendly_group_is_member(p_group, auth.uid()) then
    return 0;
  end if;
  for v_r in
    select * from public.spendly_group_recurring where group_id = p_group and next_period <= v_today for update
  loop
    loop
      v_due := v_r.next_period + (least(v_r.day_of_month, extract(day from (v_r.next_period + interval '1 month - 1 day'))::int) - 1);
      exit when v_due > v_today or (v_r.ends_on is not null and v_r.next_period > v_r.ends_on) or v_added >= 240;
      v_amount := coalesce(
        (select p.amount from public.spendly_fixed_payments p where p.expense_id = v_r.spendly_fixed_id and p.period = v_r.next_period),
        v_r.amount);
      insert into public.spendly_group_expenses (group_id, paid_by, amount, category, description, spent_on, split_between, recurring_id, created_by)
      values (v_r.group_id, v_r.paid_by, v_amount, v_r.category, v_r.description, v_due, v_r.split_between, v_r.id, v_r.created_by);
      v_r.next_period := (v_r.next_period + make_interval(months => v_r.every_months))::date;
      v_added := v_added + 1;
    end loop;
    update public.spendly_group_recurring set next_period = v_r.next_period where id = v_r.id;
  end loop;
  return v_added;
end;
$$;

-- Dividi una mia bolletta nel gruppo: da chi la paga (io) tra tutti i membri.
-- Parte dalla prossima scadenza a partire da questo mese (se è già passata,
-- quella di questo mese entra subito).
create or replace function public.spendly_group_link_bill(p_group uuid, p_fixed uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bill public.spendly_fixed_expenses%rowtype;
  v_me uuid;
  v_step integer;
  v_start date;
  v_cur date := date_trunc('month', (now() at time zone 'Europe/Rome')::date)::date;
  v_diff integer;
  v_next date;
  v_id uuid;
begin
  if v_uid is null or not public.spendly_group_is_member(p_group, v_uid) then
    return jsonb_build_object('error', 'not_member');
  end if;
  select * into v_bill from public.spendly_fixed_expenses where id = p_fixed and user_id = v_uid;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  v_step := public.spendly_bill_step(v_bill.frequency);
  if v_step is null then
    return jsonb_build_object('error', 'one_off');
  end if;
  if exists (select 1 from public.spendly_group_recurring where group_id = p_group and spendly_fixed_id = p_fixed) then
    return jsonb_build_object('error', 'already_linked');
  end if;
  select id into v_me from public.spendly_group_members where group_id = p_group and user_id = v_uid;

  v_start := date_trunc('month', v_bill.start_date)::date;
  v_diff := (extract(year from v_cur)::int * 12 + extract(month from v_cur)::int) - (extract(year from v_start)::int * 12 + extract(month from v_start)::int);
  v_next := case when v_diff <= 0 then v_start else (v_start + make_interval(months => ceil(v_diff::numeric / v_step)::int * v_step))::date end;

  insert into public.spendly_group_recurring
    (group_id, description, amount, category, paid_by, split_between, day_of_month, next_period, ends_on, spendly_fixed_id, every_months, created_by)
  values
    (p_group, left(v_bill.description, 120), v_bill.amount, 'bollette', v_me,
     array(select id from public.spendly_group_members where group_id = p_group order by joined_at),
     coalesce(v_bill.billing_day, extract(day from v_bill.start_date)::int), v_next, v_bill.end_date, p_fixed, v_step, v_uid)
  returning id into v_id;

  perform public.spendly_group_run_recurring(p_group);
  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function public.spendly_group_link_bill(uuid, uuid) from public, anon;
grant execute on function public.spendly_group_link_bill(uuid, uuid) to authenticated;

-- Bolletta segnata pagata (o pagamento tolto): la spesa del gruppo di quel
-- mese prende l'importo reale (o torna alla stima)
create or replace function public.spendly_bill_payment_to_groups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.spendly_fixed_payments%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;
  update public.spendly_group_expenses e
  set amount = case when tg_op = 'DELETE' then r.amount else v_row.amount end
  from public.spendly_group_recurring r
  where r.spendly_fixed_id = v_row.expense_id
    and e.recurring_id = r.id
    and e.spent_on >= v_row.period
    and e.spent_on < (v_row.period + interval '1 month')::date
    and v_row.amount > 0;
  return null;
end;
$$;
revoke all on function public.spendly_bill_payment_to_groups() from public, anon, authenticated;
drop trigger if exists spendly_bill_payment_to_groups on public.spendly_fixed_payments;
create trigger spendly_bill_payment_to_groups after insert or update or delete on public.spendly_fixed_payments
  for each row execute function public.spendly_bill_payment_to_groups();

-- Bolletta modificata in Spendly: la spesa fissa del gruppo la segue (mesi futuri)
create or replace function public.spendly_bill_change_to_groups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.spendly_group_recurring r
  set amount = new.amount,
      description = left(new.description, 120),
      day_of_month = coalesce(new.billing_day, extract(day from new.start_date)::int),
      every_months = coalesce(public.spendly_bill_step(new.frequency), r.every_months),
      ends_on = case when public.spendly_bill_step(new.frequency) is null then (now() at time zone 'Europe/Rome')::date else new.end_date end,
      updated_at = now()
  where r.spendly_fixed_id = new.id;
  return null;
end;
$$;
revoke all on function public.spendly_bill_change_to_groups() from public, anon, authenticated;
drop trigger if exists spendly_bill_change_to_groups on public.spendly_fixed_expenses;
create trigger spendly_bill_change_to_groups
  after update of amount, description, billing_day, start_date, frequency, end_date on public.spendly_fixed_expenses
  for each row execute function public.spendly_bill_change_to_groups();

-- Le mie quote: senza le spese che vengono da una mia bolletta (sono già per
-- intero tra le mie spese fisse di Spendly)
create or replace function public.spendly_group_my_shares(p_group uuid)
returns table (expense_id uuid, description text, amount numeric, spent_on date, category text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id,
         left(g.name || ' · ' || e.description, 120),
         round(e.amount / cardinality(e.split_between), 2),
         e.spent_on,
         case e.category
           when 'casa' then 'casa' when 'bollette' then 'casa' when 'spesa_alimentari' then 'spesa_alimentari'
           when 'svago_ristoranti' then 'svago_ristoranti' when 'trasporti' then 'trasporti' when 'salute' then 'salute'
           else 'altro' end
  from public.spendly_group_expenses e
  join public.spendly_groups g on g.id = e.group_id
  join public.spendly_group_members m on m.group_id = e.group_id and m.user_id = auth.uid()
  left join public.spendly_group_recurring r on r.id = e.recurring_id
  left join public.spendly_fixed_expenses f on f.id = r.spendly_fixed_id
  where e.group_id = p_group and m.id = any (e.split_between)
    and (f.id is null or f.user_id <> auth.uid());
$$;
revoke all on function public.spendly_group_my_shares(uuid) from public, anon, authenticated;
