-- Ecosistema, collegamento n. 5: Viaggi → Spendly.
--
-- «Porta la tua parte in Spendly»: per ogni spesa del viaggio divisa anche
-- con me entra in Spendly (spese variabili) la mia quota, convertita nella
-- valuta del viaggio (solo viaggi in euro, Spendly è in euro). Si può
-- ripetere: aggiorna gli importi cambiati e toglie le spese cancellate o non
-- più divise con me. Il collegamento sta nella colonna source
-- ('trip:<viaggio>:<spesa>'), unica per utente.

-- Le mie quote del viaggio (solo se sono un partecipante)
create or replace function public.trip_my_shares(p_trip uuid)
returns table (expense_id uuid, description text, amount numeric, spent_on date, category text)
language sql
stable
security definer
set search_path = public
as $$
  select e.id,
         left(t.title || ' · ' || e.description, 120),
         round(e.amount * e.rate_to_base / cardinality(e.split_between), 2),
         e.spent_on,
         case e.category when 'transport' then 'trasporti' when 'food' then 'svago_ristoranti' when 'shopping' then 'shopping' else 'altro' end
  from public.trip_expenses e
  join public.trips t on t.id = e.trip_id
  join public.trip_members m on m.trip_id = e.trip_id and m.user_id = auth.uid()
  where e.trip_id = p_trip and m.id = any (e.split_between);
$$;
revoke all on function public.trip_my_shares(uuid) from public, anon, authenticated;

-- Stato per la pagina del viaggio:
-- {status:'ok'|'login'|'not_member'|'currency'|'no_access', shares, imported, total}
create or replace function public.trip_spendly_status(p_trip uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_trip public.trips%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'login');
  end if;
  select * into v_trip from public.trips where id = p_trip;
  if v_trip.id is null or not exists (select 1 from public.trip_members where trip_id = p_trip and user_id = auth.uid()) then
    return jsonb_build_object('status', 'not_member');
  end if;
  if v_trip.base_currency <> 'EUR' then
    return jsonb_build_object('status', 'currency');
  end if;
  if not coalesce((select allowed from public.can_use_tool('spendly')), false) then
    return jsonb_build_object('status', 'no_access');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'shares', (select count(*) from public.trip_my_shares(p_trip)),
    'total', (select coalesce(sum(amount), 0) from public.trip_my_shares(p_trip)),
    'imported', (select count(*) from public.spendly_variable_expenses
                 where user_id = auth.uid() and source like 'trip:' || p_trip || ':%')
  );
end;
$$;
revoke all on function public.trip_spendly_status(uuid) from public, anon;
grant execute on function public.trip_spendly_status(uuid) to authenticated;

-- Porta (o riallinea) le mie quote in Spendly; restituisce lo stato aggiornato
create or replace function public.trip_to_spendly(p_trip uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status jsonb := public.trip_spendly_status(p_trip);
  v_prefix text := 'trip:' || p_trip || ':';
begin
  if v_status ->> 'status' <> 'ok' then
    return v_status;
  end if;

  -- Spese cancellate o non più divise con me: via da Spendly
  delete from public.spendly_variable_expenses s
  where s.user_id = auth.uid() and s.source like v_prefix || '%'
    and not exists (select 1 from public.trip_my_shares(p_trip) q where v_prefix || q.expense_id = s.source);

  -- Quote nuove o cambiate
  update public.spendly_variable_expenses s
  set amount = q.amount, expense_date = q.spent_on, description = q.description, category = q.category, updated_at = now()
  from public.trip_my_shares(p_trip) q
  where s.user_id = auth.uid() and s.source = v_prefix || q.expense_id
    and (s.amount, s.expense_date, s.description, s.category) is distinct from (q.amount, q.spent_on, q.description, q.category);

  insert into public.spendly_variable_expenses (user_id, description, amount, expense_date, category, notes, source)
  select auth.uid(), q.description, q.amount, q.spent_on, q.category, 'Viaggi', v_prefix || q.expense_id
  from public.trip_my_shares(p_trip) q
  on conflict do nothing;

  return public.trip_spendly_status(p_trip);
end;
$$;
revoke all on function public.trip_to_spendly(uuid) from public, anon;
grant execute on function public.trip_to_spendly(uuid) to authenticated;
