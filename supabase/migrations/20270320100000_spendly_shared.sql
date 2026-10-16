-- Spendly · Spese condivise: la casa (famiglia, coppia, coinquilini) con
-- invito, spese divise, spese fisse che si ripetono ogni mese (affitto,
-- bollette), «chi deve quanto a chi» e rimborsi. Stesso schema di KUMANI
-- Travel: creare un gruppo richiede l'accesso a Spendly (Base di default);
-- chi viene invitato partecipa anche solo registrato. Tutto è visibile solo
-- ai membri. Le spese personali di Spendly restano private: qui ci sono solo
-- quelle messe in comune, e ognuno può portare la sua quota nel suo Spendly.

-- ---------------------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------------------
create table if not exists public.spendly_groups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '🏠' check (char_length(emoji) <= 8),
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spendly_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.spendly_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists idx_spendly_group_members_user on public.spendly_group_members(user_id);

-- Spese fisse del gruppo: ogni mese, il giorno indicato, diventano una spesa
-- (next_period = primo mese ancora da registrare: una spesa cancellata a mano
-- non torna)
create table if not exists public.spendly_group_recurring (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.spendly_groups(id) on delete cascade,
  description text not null check (char_length(description) between 1 and 120),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 1000000),
  category text not null default 'casa'
    check (category in ('casa', 'bollette', 'spesa_alimentari', 'svago_ristoranti', 'trasporti', 'salute', 'figli', 'altro')),
  paid_by uuid not null references public.spendly_group_members(id),
  split_between uuid[] not null check (cardinality(split_between) between 1 and 12),
  day_of_month integer not null default 1 check (day_of_month between 1 and 31),
  next_period date not null check (extract(day from next_period) = 1),
  ends_on date,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spendly_group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.spendly_groups(id) on delete cascade,
  paid_by uuid not null references public.spendly_group_members(id),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 1000000),
  category text not null default 'altro'
    check (category in ('casa', 'bollette', 'spesa_alimentari', 'svago_ristoranti', 'trasporti', 'salute', 'figli', 'altro')),
  description text not null check (char_length(description) between 1 and 120),
  spent_on date not null,
  split_between uuid[] not null check (cardinality(split_between) between 1 and 12),
  -- Spesa nata da una spesa fissa (null = inserita a mano)
  recurring_id uuid references public.spendly_group_recurring(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_spendly_group_expenses on public.spendly_group_expenses(group_id, spent_on);

create table if not exists public.spendly_group_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.spendly_groups(id) on delete cascade,
  from_member uuid not null references public.spendly_group_members(id),
  to_member uuid not null references public.spendly_group_members(id),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 1000000),
  settled_on date not null default ((now() at time zone 'Europe/Rome')::date),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (from_member <> to_member)
);
create index if not exists idx_spendly_group_settlements on public.spendly_group_settlements(group_id);

-- ---------------------------------------------------------------------------
-- Aiutanti
-- ---------------------------------------------------------------------------
create or replace function public.spendly_group_is_member(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.spendly_group_members where group_id = p_group and user_id = p_user);
$$;
revoke all on function public.spendly_group_is_member(uuid, uuid) from public, anon;
grant execute on function public.spendly_group_is_member(uuid, uuid) to authenticated;

-- Chi ha pagato e tra chi si divide devono essere membri dello stesso gruppo
create or replace function public.spendly_group_check_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refs uuid[];
begin
  if tg_table_name = 'spendly_group_settlements' then
    v_refs := array[new.from_member, new.to_member];
  else
    v_refs := array_append(new.split_between, new.paid_by);
  end if;
  if exists (
    select 1 from unnest(v_refs) r
    where not exists (select 1 from public.spendly_group_members m where m.id = r and m.group_id = new.group_id)
  ) then
    raise exception 'invalid_member' using errcode = 'P0001';
  end if;
  if tg_table_name <> 'spendly_group_settlements' then
    new.split_between := array(select distinct unnest(new.split_between));
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke all on function public.spendly_group_check_refs() from public, anon, authenticated;

drop trigger if exists spendly_group_expenses_refs on public.spendly_group_expenses;
create trigger spendly_group_expenses_refs before insert or update on public.spendly_group_expenses
  for each row execute function public.spendly_group_check_refs();
drop trigger if exists spendly_group_recurring_refs on public.spendly_group_recurring;
create trigger spendly_group_recurring_refs before insert or update on public.spendly_group_recurring
  for each row execute function public.spendly_group_check_refs();
drop trigger if exists spendly_group_settlements_refs on public.spendly_group_settlements;
create trigger spendly_group_settlements_refs before insert or update on public.spendly_group_settlements
  for each row execute function public.spendly_group_check_refs();

-- Limiti impostabili dall'Admin (Limiti e pulizia)
insert into public.app_limits (key, value, kind, section, label, sort) values
  ('spendly_groups', 5, 'count', 'Spendly', 'Spese condivise: gruppi creati per persona', 63),
  ('spendly_group_expenses', 20000, 'count', 'Spendly', 'Spese condivise: spese per gruppo', 64),
  ('spendly_group_recurring', 50, 'count', 'Spendly', 'Spese condivise: spese fisse per gruppo', 65)
on conflict (key) do nothing;
drop trigger if exists app_limit_check on public.spendly_groups;
create trigger app_limit_check before insert on public.spendly_groups
  for each row execute function public.enforce_app_limit('spendly_groups', 'creator_id');
drop trigger if exists app_limit_check on public.spendly_group_expenses;
create trigger app_limit_check before insert on public.spendly_group_expenses
  for each row execute function public.enforce_app_limit('spendly_group_expenses', 'group_id');
drop trigger if exists app_limit_check on public.spendly_group_recurring;
create trigger app_limit_check before insert on public.spendly_group_recurring
  for each row execute function public.enforce_app_limit('spendly_group_recurring', 'group_id');

-- ---------------------------------------------------------------------------
-- Regole di accesso: tutto solo ai membri del gruppo
-- ---------------------------------------------------------------------------
alter table public.spendly_groups enable row level security;
alter table public.spendly_group_members enable row level security;
alter table public.spendly_group_recurring enable row level security;
alter table public.spendly_group_expenses enable row level security;
alter table public.spendly_group_settlements enable row level security;

drop policy if exists spendly_groups_select on public.spendly_groups;
create policy spendly_groups_select on public.spendly_groups for select to authenticated
  using (public.spendly_group_is_member(id, (select auth.uid())));
drop policy if exists spendly_groups_update on public.spendly_groups;
create policy spendly_groups_update on public.spendly_groups for update to authenticated
  using (creator_id = (select auth.uid())) with check (creator_id = (select auth.uid()));
drop policy if exists spendly_groups_delete on public.spendly_groups;
create policy spendly_groups_delete on public.spendly_groups for delete to authenticated
  using (creator_id = (select auth.uid()));

drop policy if exists spendly_group_members_select on public.spendly_group_members;
create policy spendly_group_members_select on public.spendly_group_members for select to authenticated
  using (public.spendly_group_is_member(group_id, (select auth.uid())));

do $$
declare
  t text;
begin
  foreach t in array array['spendly_group_recurring', 'spendly_group_expenses', 'spendly_group_settlements'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.spendly_group_is_member(group_id, (select auth.uid())))', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.spendly_group_is_member(group_id, (select auth.uid())) and created_by = (select auth.uid()))', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.spendly_group_is_member(group_id, (select auth.uid())))', t || '_delete', t);
  end loop;
  foreach t in array array['spendly_group_recurring', 'spendly_group_expenses'] loop
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.spendly_group_is_member(group_id, (select auth.uid()))) with check (public.spendly_group_is_member(group_id, (select auth.uid())))', t || '_update', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funzioni per l'app
-- ---------------------------------------------------------------------------

-- Nuovo gruppo: serve l'accesso a Spendly; chi lo crea è il primo membro
create or replace function public.spendly_group_create(p_name text, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group uuid;
  v_code text;
begin
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  if not exists (select 1 from public.tool_access(v_uid, 'spendly') t where t.allowed) then
    return jsonb_build_object('error', 'plan_required');
  end if;
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('error', 'invalid');
  end if;
  loop
    v_code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    exit when not exists (select 1 from public.spendly_groups where invite_code = v_code);
  end loop;
  insert into public.spendly_groups (creator_id, name, emoji, invite_code)
  values (v_uid, left(trim(p_name), 60), coalesce(nullif(left(trim(coalesce(p_emoji, '')), 8), ''), '🏠'), v_code)
  returning id into v_group;
  insert into public.spendly_group_members (group_id, user_id, role) values (v_group, v_uid, 'owner');
  return jsonb_build_object('id', v_group);
end;
$$;

-- Entrare con il codice: basta essere registrati (al massimo 12 persone)
create or replace function public.spendly_group_join(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.spendly_groups%rowtype;
begin
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return jsonb_build_object('error', 'not_allowed');
  end if;
  select * into v_group from public.spendly_groups where invite_code = upper(trim(coalesce(p_code, ''))) for update;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if public.spendly_group_is_member(v_group.id, v_uid) then
    return jsonb_build_object('id', v_group.id);
  end if;
  if (select count(*) from public.spendly_group_members where group_id = v_group.id) >= 12 then
    return jsonb_build_object('error', 'full');
  end if;
  if (select count(*) from public.spendly_group_members where user_id = v_uid) >= 10 then
    return jsonb_build_object('error', 'too_many');
  end if;
  insert into public.spendly_group_members (group_id, user_id, role) values (v_group.id, v_uid, 'member')
  on conflict (group_id, user_id) do nothing;
  return jsonb_build_object('id', v_group.id);
end;
$$;

-- Anteprima del codice invito (solo nome del gruppo e di chi l'ha creato)
create or replace function public.spendly_group_preview(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'name', g.name,
    'emoji', g.emoji,
    'creator_name', coalesce(nullif(trim(p.first_name), ''), '—'),
    'members', (select count(*) from public.spendly_group_members m where m.group_id = g.id),
    'is_member', public.spendly_group_is_member(g.id, auth.uid())
  )
  from public.spendly_groups g
  left join public.profiles p on p.id = g.creator_id
  where g.invite_code = upper(trim(coalesce(p_code, '')));
$$;

-- I miei gruppi
create or replace function public.spendly_group_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'emoji', g.emoji,
    'is_owner', g.creator_id = auth.uid(),
    'members', (select count(*) from public.spendly_group_members x where x.group_id = g.id)
  ) order by g.created_at), '[]'::jsonb)
  from public.spendly_groups g
  join public.spendly_group_members m on m.group_id = g.id and m.user_id = auth.uid();
$$;

-- Dettaglio: gruppo e membri (nome di battesimo, come in Travel)
create or replace function public.spendly_group_detail(p_group uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'emoji', g.emoji,
    'invite_code', g.invite_code,
    'is_owner', g.creator_id = auth.uid(),
    'my_member_id', (select id from public.spendly_group_members where group_id = g.id and user_id = auth.uid()),
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'name', coalesce(nullif(trim(p.first_name), ''), '—'),
        'role', m.role,
        'is_me', m.user_id = auth.uid()
      ) order by m.role desc, m.joined_at), '[]'::jsonb)
      from public.spendly_group_members m join public.profiles p on p.id = m.user_id
      where m.group_id = g.id
    )
  )
  from public.spendly_groups g
  where g.id = p_group and public.spendly_group_is_member(g.id, auth.uid());
$$;

-- Uscire dal gruppo (o, per chi l'ha creato, togliere qualcuno). Chi ha spese
-- o rimborsi nel gruppo non si può togliere: i conti non tornerebbero più.
create or replace function public.spendly_group_remove_member(p_member uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_member public.spendly_group_members%rowtype;
  v_owner uuid;
begin
  select * into v_member from public.spendly_group_members where id = p_member;
  if not found then
    return 'not_found';
  end if;
  select creator_id into v_owner from public.spendly_groups where id = v_member.group_id;
  if v_member.role = 'owner' then
    return 'owner';
  end if;
  if v_member.user_id <> v_uid and v_owner is distinct from v_uid then
    return 'not_allowed';
  end if;
  if exists (select 1 from public.spendly_group_expenses e where e.group_id = v_member.group_id and (e.paid_by = p_member or p_member = any (e.split_between)))
     or exists (select 1 from public.spendly_group_recurring r where r.group_id = v_member.group_id and (r.paid_by = p_member or p_member = any (r.split_between)))
     or exists (select 1 from public.spendly_group_settlements s where s.group_id = v_member.group_id and (s.from_member = p_member or s.to_member = p_member)) then
    return 'has_expenses';
  end if;
  delete from public.spendly_group_members where id = p_member;
  return 'ok';
end;
$$;

-- Spese fisse arrivate: per ogni mese da next_period a oggi (giorno di Roma),
-- quando è arrivato il giorno, si registra la spesa. Da chiamare prima di
-- leggere le spese; si può ripetere senza doppioni.
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
      insert into public.spendly_group_expenses (group_id, paid_by, amount, category, description, spent_on, split_between, recurring_id, created_by)
      values (v_r.group_id, v_r.paid_by, v_r.amount, v_r.category, v_r.description, v_due, v_r.split_between, v_r.id, v_r.created_by);
      v_r.next_period := (v_r.next_period + interval '1 month')::date;
      v_added := v_added + 1;
    end loop;
    update public.spendly_group_recurring set next_period = v_r.next_period where id = v_r.id;
  end loop;
  return v_added;
end;
$$;

-- Le mie quote nel gruppo (spese divise anche con me), nelle categorie di Spendly
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
  where e.group_id = p_group and m.id = any (e.split_between);
$$;
revoke all on function public.spendly_group_my_shares(uuid) from public, anon, authenticated;

-- Stato del collegamento con il mio Spendly:
-- {status:'ok'|'login'|'not_member'|'no_access', shares, total, imported}
create or replace function public.spendly_group_spendly_status(p_group uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'login');
  end if;
  if not public.spendly_group_is_member(p_group, auth.uid()) then
    return jsonb_build_object('status', 'not_member');
  end if;
  if not coalesce((select allowed from public.can_use_tool('spendly')), false) then
    return jsonb_build_object('status', 'no_access');
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'shares', (select count(*) from public.spendly_group_my_shares(p_group)),
    'total', (select coalesce(sum(amount), 0) from public.spendly_group_my_shares(p_group)),
    'imported', (select count(*) from public.spendly_variable_expenses
                 where user_id = auth.uid() and source like 'casa:' || p_group || ':%')
  );
end;
$$;

-- Porta (o riallinea) le mie quote nelle spese variabili del mio Spendly
create or replace function public.spendly_group_to_spendly(p_group uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status jsonb := public.spendly_group_spendly_status(p_group);
  v_prefix text := 'casa:' || p_group || ':';
begin
  if v_status ->> 'status' <> 'ok' then
    return v_status;
  end if;

  delete from public.spendly_variable_expenses s
  where s.user_id = auth.uid() and s.source like v_prefix || '%'
    and not exists (select 1 from public.spendly_group_my_shares(p_group) q where v_prefix || q.expense_id = s.source);

  update public.spendly_variable_expenses s
  set amount = q.amount, expense_date = q.spent_on, description = q.description, category = q.category, updated_at = now()
  from public.spendly_group_my_shares(p_group) q
  where s.user_id = auth.uid() and s.source = v_prefix || q.expense_id
    and (s.amount, s.expense_date, s.description, s.category) is distinct from (q.amount, q.spent_on, q.description, q.category);

  insert into public.spendly_variable_expenses (user_id, description, amount, expense_date, category, notes, source)
  select auth.uid(), q.description, q.amount, q.spent_on, q.category, 'Spese condivise', v_prefix || q.expense_id
  from public.spendly_group_my_shares(p_group) q
  on conflict do nothing;

  return public.spendly_group_spendly_status(p_group);
end;
$$;

revoke all on function public.spendly_group_create(text, text) from public, anon;
revoke all on function public.spendly_group_join(text) from public, anon;
revoke all on function public.spendly_group_preview(text) from public, anon;
revoke all on function public.spendly_group_list() from public, anon;
revoke all on function public.spendly_group_detail(uuid) from public, anon;
revoke all on function public.spendly_group_remove_member(uuid) from public, anon;
revoke all on function public.spendly_group_run_recurring(uuid) from public, anon;
revoke all on function public.spendly_group_spendly_status(uuid) from public, anon;
revoke all on function public.spendly_group_to_spendly(uuid) from public, anon;
grant execute on function public.spendly_group_create(text, text) to authenticated;
grant execute on function public.spendly_group_join(text) to authenticated;
grant execute on function public.spendly_group_preview(text) to authenticated;
grant execute on function public.spendly_group_list() to authenticated;
grant execute on function public.spendly_group_detail(uuid) to authenticated;
grant execute on function public.spendly_group_remove_member(uuid) to authenticated;
grant execute on function public.spendly_group_run_recurring(uuid) to authenticated;
grant execute on function public.spendly_group_spendly_status(uuid) to authenticated;
grant execute on function public.spendly_group_to_spendly(uuid) to authenticated;
