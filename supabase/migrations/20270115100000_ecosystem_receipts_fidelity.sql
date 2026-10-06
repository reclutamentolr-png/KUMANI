-- Ecosistema, collegamento n. 1: chi vende (Pro) e chi compra (Kumano) si parlano.
--
-- 1. Kumi Card Fidelity nel Wallet: quando un Kumano con l'accesso apre la
--    sua tessera fedeltà (link segreto /f/[token]), la tessera resta legata
--    al suo account e la ritrova nel Wallet su qualsiasi telefono. Il legame
--    sta in una tabella a parte senza policy: il negozio non vede chi è.
-- 2. Ricevuta digitale → Spendly: con un tocco l'importo dichiarato di una
--    ricevuta (vendita tra privati, pagamento dichiarato) entra in Spendly,
--    come spesa per chi la riceve e come entrata per chi l'ha fatta. Una
--    sola volta per ricevuta (colonna source).
-- 3. Ricevute confermate nei Documenti: chi conferma una ricevuta con
--    l'accesso la ritrova in Documenti → Doc Personali.

-- ---------------------------------------------------------------- 1. Fidelity
create table if not exists public.fidelity_member_users (
  member_id uuid primary key references public.fidelity_members(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now()
);
create index if not exists fidelity_member_users_user_idx on public.fidelity_member_users (user_id);
alter table public.fidelity_member_users enable row level security;
-- Nessuna policy: si legge e si scrive solo con le funzioni qui sotto.

-- Lega la tessera (token segreto) all'utente che la apre. Una tessera già
-- legata a un altro account resta sua.
create or replace function public.link_fidelity_member(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member uuid;
begin
  if auth.uid() is null or p_token !~ '^[A-Za-z0-9_-]{16,64}$' then
    return false;
  end if;
  select id into v_member from public.fidelity_members where token = p_token;
  if v_member is null then
    return false;
  end if;
  insert into public.fidelity_member_users (member_id, user_id) values (v_member, auth.uid())
  on conflict (member_id) do nothing;
  return exists (select 1 from public.fidelity_member_users where member_id = v_member and user_id = auth.uid());
end;
$$;
revoke all on function public.link_fidelity_member(text) from public, anon;
grant execute on function public.link_fidelity_member(text) to authenticated;

-- Le tessere fedeltà dell'utente, per il Wallet
create or replace function public.my_fidelity_cards()
returns table (
  token text,
  business_name text,
  prize text,
  stamps_needed integer,
  stamps_expire_days integer,
  stamps_count integer,
  last_stamp_at timestamptz,
  rewards_redeemed integer,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select m.token, c.business_name, c.prize, c.stamps_needed, c.stamps_expire_days,
         m.stamps_count, m.last_stamp_at, m.rewards_redeemed, c.is_active
  from public.fidelity_member_users u
  join public.fidelity_members m on m.id = u.member_id
  join public.fidelity_cards c on c.id = m.card_id
  where u.user_id = auth.uid()
  order by coalesce(m.last_stamp_at, u.linked_at) desc;
$$;
revoke all on function public.my_fidelity_cards() from public, anon;
grant execute on function public.my_fidelity_cards() to authenticated;

-- Toglie la tessera dal Wallet (la tessera resta valida col suo link)
create or replace function public.unlink_fidelity_member(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.fidelity_member_users u
  using public.fidelity_members m
  where m.id = u.member_id and m.token = p_token and u.user_id = auth.uid();
$$;
revoke all on function public.unlink_fidelity_member(text) from public, anon;
grant execute on function public.unlink_fidelity_member(text) to authenticated;

-- ---------------------------------------------------- 2. Ricevuta → Spendly
alter table public.spendly_variable_expenses add column if not exists source text;
alter table public.spendly_income add column if not exists source text;
create unique index if not exists spendly_variable_expenses_source_idx
  on public.spendly_variable_expenses (user_id, source) where source is not null;
create unique index if not exists spendly_income_source_idx
  on public.spendly_income (user_id, source) where source is not null;

-- Stato del collegamento per la pagina della ricevuta:
-- 'expense' / 'income' = si può aggiungere; 'added' = già in Spendly;
-- 'no_value' = ricevuta senza importo o di un tipo senza pagamento;
-- 'no_access' = Spendly non incluso nel piano; 'login' = serve l'accesso
create or replace function public.receipt_spendly_status(p_code text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_r public.digital_receipts;
  v_as text;
begin
  if auth.uid() is null then
    return 'login';
  end if;
  select * into v_r from public.digital_receipts where code = p_code;
  if v_r.id is null or coalesce(v_r.declared_value, 0) <= 0 or v_r.template not in ('private_sale', 'declared_payment') then
    return 'no_value';
  end if;
  v_as := case when v_r.user_id = auth.uid() then 'income' else 'expense' end;
  if not coalesce((select allowed from public.can_use_tool('spendly')), false) then
    return 'no_access';
  end if;
  if (v_as = 'expense' and exists (select 1 from public.spendly_variable_expenses where user_id = auth.uid() and source = 'receipt:' || p_code))
     or (v_as = 'income' and exists (select 1 from public.spendly_income where user_id = auth.uid() and source = 'receipt:' || p_code)) then
    return 'added';
  end if;
  return v_as;
end;
$$;
revoke all on function public.receipt_spendly_status(text) from public, anon;
grant execute on function public.receipt_spendly_status(text) to authenticated;

-- Aggiunge l'importo della ricevuta a Spendly (spesa o entrata, secondo chi
-- la chiede). Restituisce lo stesso stato di receipt_spendly_status dopo
-- l'operazione ('added' se è andata bene).
create or replace function public.receipt_to_spendly(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := public.receipt_spendly_status(p_code);
  v_r public.digital_receipts;
begin
  if v_status not in ('expense', 'income') then
    return v_status;
  end if;
  select * into v_r from public.digital_receipts where code = p_code;
  if v_status = 'expense' then
    insert into public.spendly_variable_expenses (user_id, description, amount, expense_date, category, notes, source)
    values (auth.uid(), left(v_r.object_name, 120), v_r.declared_value, v_r.delivery_date,
            case when v_r.template = 'private_sale' then 'shopping' else 'altro' end,
            'Ricevuta digitale ' || v_r.code, 'receipt:' || v_r.code)
    on conflict do nothing;
  else
    insert into public.spendly_income (user_id, description, amount, income_type, category, income_date, notes, source)
    values (auth.uid(), left(v_r.object_name, 120), v_r.declared_value, 'variabile',
            case when v_r.template = 'private_sale' then 'vendite' else 'altro' end,
            v_r.delivery_date, 'Ricevuta digitale ' || v_r.code, 'receipt:' || v_r.code)
    on conflict do nothing;
  end if;
  return 'added';
end;
$$;
revoke all on function public.receipt_to_spendly(text) from public, anon;
grant execute on function public.receipt_to_spendly(text) to authenticated;

-- ------------------------------------- 3. Ricevute confermate nei Documenti
alter table public.digital_receipts add column if not exists recipient_user_id uuid references auth.users(id) on delete set null;
create index if not exists digital_receipts_recipient_idx on public.digital_receipts (recipient_user_id) where recipient_user_id is not null;

-- Come la data di conferma, anche il destinatario collegato lo scrive solo
-- confirm_digital_receipt, mai l'autore della ricevuta
create or replace function public.digital_receipts_guard_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.confirmed_at := null;
      new.recipient_user_id := null;
    else
      new.confirmed_at := old.confirmed_at;
      new.recipient_user_id := old.recipient_user_id;
    end if;
  end if;
  return new;
end;
$$;

-- La conferma resta pubblica (anche senza account); se chi conferma ha
-- l'accesso e non è chi l'ha fatta, la ricevuta gli resta collegata.
create or replace function public.confirm_digital_receipt(p_code text)
returns table (code text, already_confirmed boolean, confirmed_at timestamptz)
security definer
set search_path = public
language plpgsql
as $$
declare
  v_id uuid;
  v_owner uuid;
  v_confirmed_at timestamptz;
begin
  select r.id, r.user_id, r.confirmed_at into v_id, v_owner, v_confirmed_at
  from public.digital_receipts r where r.code = p_code;
  if v_id is null then
    return;
  end if;
  if v_confirmed_at is not null then
    return query select p_code, true, v_confirmed_at;
    return;
  end if;
  update public.digital_receipts r
  set confirmed_at = now(),
      updated_at = now(),
      recipient_user_id = case when auth.uid() is not null and auth.uid() <> v_owner then auth.uid() else r.recipient_user_id end
  where r.id = v_id
  returning r.confirmed_at into v_confirmed_at;
  return query select p_code, false, v_confirmed_at;
end;
$$;
grant execute on function public.confirm_digital_receipt(text) to anon, authenticated;

-- Le ricevute che l'utente ha confermato (fatte da altri)
create or replace function public.my_received_receipts(p_limit integer default 50)
returns table (code text, object_name text, template text, delivery_date date, declared_value numeric, confirmed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.code, r.object_name, r.template, r.delivery_date, r.declared_value, r.confirmed_at
  from public.digital_receipts r
  where r.recipient_user_id = auth.uid()
  order by r.confirmed_at desc nulls last
  limit least(greatest(p_limit, 1), 200);
$$;
revoke all on function public.my_received_receipts(integer) from public, anon;
grant execute on function public.my_received_receipts(integer) to authenticated;
