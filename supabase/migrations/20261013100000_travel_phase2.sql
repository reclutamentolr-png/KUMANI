-- KUMANI Travel — Fase 2: spese divise ("chi deve quanto a chi") e documenti
-- con le scadenze (solo tipo e data: nessun file, nessun numero di documento).

-- ---------------------------------------------------------------------------
-- Viaggio: valuta di riferimento e documenti richiesti dall'organizzatore
-- ---------------------------------------------------------------------------
alter table public.trips add column if not exists base_currency text not null default 'EUR'
  check (base_currency ~ '^[A-Z]{3}$');
alter table public.trips add column if not exists required_docs text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- Spese
-- ---------------------------------------------------------------------------
create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  paid_by uuid not null references public.trip_members(id),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Tasso verso la valuta del viaggio al momento della spesa (1 se uguale)
  rate_to_base numeric(14, 6) not null default 1 check (rate_to_base > 0),
  category text not null default 'other'
    check (category in ('transport', 'accommodation', 'food', 'activities', 'shopping', 'other')),
  description text not null check (char_length(description) between 1 and 120),
  spent_on date not null,
  split_between uuid[] not null check (cardinality(split_between) between 1 and 20),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_trip_exp on public.trip_expenses(trip_id, spent_on);

-- Rimborsi già fatti tra due persone (nella valuta del viaggio)
create table if not exists public.trip_settlements (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_member uuid not null references public.trip_members(id),
  to_member uuid not null references public.trip_members(id),
  amount numeric(12, 2) not null check (amount > 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (from_member <> to_member)
);
create index if not exists idx_trip_settlements on public.trip_settlements(trip_id);

-- Chi paga, chi divide e chi rimborsa devono essere membri dello stesso viaggio.
create or replace function public.trip_check_money_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refs uuid[];
begin
  if tg_table_name = 'trip_expenses' then
    v_refs := array_append(new.split_between, new.paid_by);
  else
    v_refs := array[new.from_member, new.to_member];
  end if;
  if exists (
    select 1 from unnest(v_refs) r
    where not exists (select 1 from public.trip_members m where m.id = r and m.trip_id = new.trip_id)
  ) then
    raise exception 'invalid_member' using errcode = 'P0001';
  end if;
  if tg_table_name = 'trip_expenses' then
    new.split_between := array(select distinct unnest(new.split_between));
  end if;
  return new;
end;
$$;

drop trigger if exists trip_expenses_refs on public.trip_expenses;
create trigger trip_expenses_refs before insert or update on public.trip_expenses
  for each row execute function public.trip_check_money_refs();
drop trigger if exists trip_settlements_refs on public.trip_settlements;
create trigger trip_settlements_refs before insert or update on public.trip_settlements
  for each row execute function public.trip_check_money_refs();

-- ---------------------------------------------------------------------------
-- Documenti (solo tipo e scadenza)
-- ---------------------------------------------------------------------------
create table if not exists public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  member_id uuid not null references public.trip_members(id) on delete cascade,
  doc_type text not null check (doc_type in ('passport', 'id_card', 'visa', 'insurance', 'vaccination', 'license', 'other')),
  label text check (char_length(label) <= 60),
  expires_on date,
  life_calendar_item_id uuid references public.life_calendar_items(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_trip_documents on public.trip_documents(trip_id, member_id);

create or replace function public.trip_is_owner(p_trip uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trips where id = p_trip and creator_id = p_user);
$$;

create or replace function public.trip_my_member(p_trip uuid, p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.trip_members where trip_id = p_trip and user_id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- Tempo reale
-- ---------------------------------------------------------------------------
drop trigger if exists trip_expenses_signal on public.trip_expenses;
create trigger trip_expenses_signal after insert or update or delete on public.trip_expenses
  for each row execute function public.trip_touch();
drop trigger if exists trip_settlements_signal on public.trip_settlements;
create trigger trip_settlements_signal after insert or update or delete on public.trip_settlements
  for each row execute function public.trip_touch();
drop trigger if exists trip_documents_signal on public.trip_documents;
create trigger trip_documents_signal after insert or update or delete on public.trip_documents
  for each row execute function public.trip_touch();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.trip_expenses enable row level security;
alter table public.trip_settlements enable row level security;
alter table public.trip_documents enable row level security;

-- Spese: tutti i membri le vedono e le aggiungono (ognuno registra ciò che
-- ha pagato); modifica e cancellazione a chi l'ha inserita o all'organizzatore.
drop policy if exists trip_expenses_select on public.trip_expenses;
create policy trip_expenses_select on public.trip_expenses for select to authenticated
  using (public.trip_is_member(trip_id, (select auth.uid())));
drop policy if exists trip_expenses_insert on public.trip_expenses;
create policy trip_expenses_insert on public.trip_expenses for insert to authenticated
  with check (public.trip_is_member(trip_id, (select auth.uid())) and created_by = (select auth.uid()));
drop policy if exists trip_expenses_update on public.trip_expenses;
create policy trip_expenses_update on public.trip_expenses for update to authenticated
  using (created_by = (select auth.uid()) or public.trip_is_owner(trip_id, (select auth.uid())))
  with check (public.trip_is_member(trip_id, (select auth.uid())));
drop policy if exists trip_expenses_delete on public.trip_expenses;
create policy trip_expenses_delete on public.trip_expenses for delete to authenticated
  using (created_by = (select auth.uid()) or public.trip_is_owner(trip_id, (select auth.uid())));

-- Rimborsi: li registra chi paga, chi riceve o l'organizzatore.
drop policy if exists trip_settlements_select on public.trip_settlements;
create policy trip_settlements_select on public.trip_settlements for select to authenticated
  using (public.trip_is_member(trip_id, (select auth.uid())));
drop policy if exists trip_settlements_insert on public.trip_settlements;
create policy trip_settlements_insert on public.trip_settlements for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.trip_my_member(trip_id, (select auth.uid())) in (from_member, to_member)
      or public.trip_is_owner(trip_id, (select auth.uid()))
    )
  );
drop policy if exists trip_settlements_delete on public.trip_settlements;
create policy trip_settlements_delete on public.trip_settlements for delete to authenticated
  using (created_by = (select auth.uid()) or public.trip_is_owner(trip_id, (select auth.uid())));

-- Documenti: ognuno gestisce i propri; l'organizzatore li vede tutti per
-- controllare che il gruppo sia in regola.
drop policy if exists trip_documents_select on public.trip_documents;
create policy trip_documents_select on public.trip_documents for select to authenticated
  using (
    member_id = public.trip_my_member(trip_id, (select auth.uid()))
    or public.trip_is_owner(trip_id, (select auth.uid()))
  );
drop policy if exists trip_documents_insert on public.trip_documents;
create policy trip_documents_insert on public.trip_documents for insert to authenticated
  with check (member_id = public.trip_my_member(trip_id, (select auth.uid())));
drop policy if exists trip_documents_update on public.trip_documents;
create policy trip_documents_update on public.trip_documents for update to authenticated
  using (member_id = public.trip_my_member(trip_id, (select auth.uid())))
  with check (member_id = public.trip_my_member(trip_id, (select auth.uid())));
drop policy if exists trip_documents_delete on public.trip_documents;
create policy trip_documents_delete on public.trip_documents for delete to authenticated
  using (member_id = public.trip_my_member(trip_id, (select auth.uid())));

grant select, insert, update, delete on public.trip_expenses to authenticated;
grant select, insert, delete on public.trip_settlements to authenticated;
grant select, insert, update, delete on public.trip_documents to authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni aggiornate
-- ---------------------------------------------------------------------------
create or replace function public.trip_detail(p_trip uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'destination', t.destination,
    'starts_on', t.starts_on,
    'ends_on', t.ends_on,
    'emoji', t.cover_emoji,
    'invite_code', t.invite_code,
    'members_can_edit', t.members_can_edit,
    'base_currency', t.base_currency,
    'required_docs', to_jsonb(t.required_docs),
    'is_owner', t.creator_id = auth.uid(),
    'can_edit', public.trip_can_edit(t.id, auth.uid()),
    'my_member_id', (select id from public.trip_members where trip_id = t.id and user_id = auth.uid()),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'name', coalesce(nullif(trim(p.first_name), ''), '—'),
        'role', m.role,
        'is_me', m.user_id = auth.uid()
      ) order by m.role desc, m.joined_at), '[]'::jsonb)
      from public.trip_members m join public.profiles p on p.id = m.user_id
      where m.trip_id = t.id
    )
  )
  from public.trips t
  where t.id = p_trip and public.trip_is_member(t.id, auth.uid());
$$;

-- Chi compare nelle spese non può uscire (i conti non tornerebbero più):
-- prima si sistemano o si eliminano le spese.
create or replace function public.trip_remove_member(p_member uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.trip_members%rowtype;
  v_owner uuid;
begin
  select * into v_member from public.trip_members where id = p_member;
  if not found then
    return 'not_found';
  end if;
  select creator_id into v_owner from public.trips where id = v_member.trip_id;
  if v_member.role = 'owner' then
    return 'owner';
  end if;
  if v_member.user_id <> v_uid and v_owner is distinct from v_uid then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.trip_expenses e where e.trip_id = v_member.trip_id and (e.paid_by = p_member or p_member = any(e.split_between)))
     or exists (select 1 from public.trip_settlements s where s.trip_id = v_member.trip_id and p_member in (s.from_member, s.to_member)) then
    return 'has_expenses';
  end if;
  delete from public.trip_members where id = p_member;
  return 'ok';
end;
$$;
