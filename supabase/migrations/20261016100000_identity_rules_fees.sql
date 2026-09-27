-- Verifica d'identità anche per chi non ha il codice fiscale italiano
-- (documento controllato dallo Staff), regole separate per Kordata ed Events,
-- commissione KUMANI sulle Kordate a carico del fornitore Pro.

-- ---------------------------------------------------------------------------
-- 1. Identità: codice fiscale OPPURE documento approvato dallo Staff
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists events_terms_at timestamptz;

create table if not exists public.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('passport', 'id_card', 'driving_license', 'residence_permit')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  -- Foto nel bucket privato; cancellata dopo la decisione dello Staff
  file_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create unique index if not exists identity_verifications_one_pending on public.identity_verifications(user_id) where status = 'pending';
create index if not exists identity_verifications_user on public.identity_verifications(user_id, created_at desc);

alter table public.identity_verifications enable row level security;
drop policy if exists identity_verifications_own on public.identity_verifications;
create policy identity_verifications_own on public.identity_verifications for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.identity_verifications to authenticated;

-- Bucket privato: nessuna policy per gli utenti, lo usa solo il server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('identity-docs', 'identity-docs', false, 6291456, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create or replace function public.kumano_identity_ok(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_uid and tax_code is not null)
      or exists (select 1 from public.identity_verifications where user_id = p_uid and status = 'approved');
$$;
revoke all on function public.kumano_identity_ok(uuid) from public, anon, authenticated;

-- Controlli del Kumano Verificato: 'tax_code' ora significa "identità
-- verificata" (codice fiscale o documento approvato); 'terms' sono le regole
-- di Kordata (Events le sostituisce con le sue).
create or replace function public.convivio_leader_checks(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'account_age', p.subscription_status = 'active' and p.subscription_started_at is not null
                   and p.subscription_started_at <= now() - interval '30 days',
    'subscription', p.subscription_status = 'active' and (p.subscription_expires_at is null or p.subscription_expires_at > now()),
    'profile', p.date_of_birth is not null and p.date_of_birth <> '2000-01-01'
               and nullif(trim(coalesce(p.city, '')), '') is not null
               and nullif(trim(coalesce(p.phone, '')), '') is not null,
    'tax_code', public.kumano_identity_ok(p_uid),
    'has_tax_code', p.tax_code is not null,
    'identity_pending', exists (select 1 from public.identity_verifications v where v.user_id = p_uid and v.status = 'pending'),
    'identity_rejected_note', (select v.review_note from public.identity_verifications v where v.user_id = p_uid order by v.created_at desc limit 1),
    'identity_last_status', (select v.status from public.identity_verifications v where v.user_id = p_uid order by v.created_at desc limit 1),
    'terms', p.convivio_terms_at is not null,
    'blocked', coalesce(p.is_blocked, false),
    'days_left', case
      when p.subscription_status <> 'active' or p.subscription_started_at is null then 30
      else greatest(0, 30 - floor(extract(epoch from now() - p.subscription_started_at) / 86400)::int)
    end
  )
  from public.profiles p where p.id = p_uid;
$$;
revoke all on function public.convivio_leader_checks(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Events: stessa verifica, ma con le regole dell'organizzatore
-- ---------------------------------------------------------------------------
create or replace function public.event_is_verified(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((c ->> 'account_age')::boolean and (c ->> 'subscription')::boolean and (c ->> 'profile')::boolean
    and (c ->> 'tax_code')::boolean and not (c ->> 'blocked')::boolean, false)
    and exists (select 1 from public.profiles where id = p_uid and events_terms_at is not null)
  from (select public.convivio_leader_checks(p_uid) as c) x;
$$;
revoke all on function public.event_is_verified(uuid) from public, anon, authenticated;

create or replace function public.event_organizer_status(p_uid uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.events_settle_fees(p_uid);
  return public.convivio_leader_checks(p_uid) || jsonb_build_object(
    'terms', exists (select 1 from public.profiles where id = p_uid and events_terms_at is not null),
    'verified', public.event_is_verified(p_uid),
    'plan', exists (select 1 from public.tool_access(p_uid, 'events') t where t.allowed),
    'trusted', public.event_organizer_trusted(p_uid),
    'fees_due', coalesce((select sum(amount) from public.event_fees where organizer_id = p_uid and status = 'due'), 0),
    'fee_percent', coalesce(nullif(public.setting_text('events_fee_percent'), '')::numeric, 5)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Kordata: commissione a carico del fornitore Pro
-- ---------------------------------------------------------------------------
alter table public.convivio_groups add column if not exists fee_percent numeric(5, 2);

insert into public.system_settings (key, value)
values ('convivio_fee_percent', '"3"')
on conflict (key) do nothing;

create table if not exists public.convivio_fees (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.convivio_groups(id) on delete cascade,
  supplier_id uuid not null references auth.users(id) on delete cascade,
  quantity int not null,
  price numeric(10, 2) not null,
  percent numeric(5, 2) not null,
  amount numeric(10, 2) not null,
  status text not null default 'due' check (status in ('due', 'paid', 'waived')),
  stripe_session_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_convivio_fees_supplier on public.convivio_fees(supplier_id, status);
alter table public.convivio_fees enable row level security;
drop policy if exists convivio_fees_select on public.convivio_fees;
create policy convivio_fees_select on public.convivio_fees for select to authenticated
  using (supplier_id = (select auth.uid()));
grant select on public.convivio_fees to authenticated;

-- La percentuale si fissa quando il fornitore conferma (così la conosce prima);
-- la commissione nasce quando la Kordata diventa "ordinata" (acquisto confermato).
create or replace function public.convivio_fee_percent_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.supplier_id is not null and new.supplier_status = 'confirmed' and old.supplier_status is distinct from 'confirmed' then
    new.fee_percent := coalesce(nullif(public.setting_text('convivio_fee_percent'), '')::numeric, 3);
  end if;
  return new;
end;
$$;
drop trigger if exists convivio_fee_percent_on_confirm on public.convivio_groups;
create trigger convivio_fee_percent_on_confirm before update on public.convivio_groups
  for each row execute function public.convivio_fee_percent_on_confirm();

create or replace function public.convivio_fee_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quantity int;
begin
  if new.status = 'ordered' and old.status is distinct from 'ordered'
     and new.supplier_id is not null and new.supplier_status = 'confirmed'
     and coalesce(new.fee_percent, 0) > 0 and new.group_price > 0 then
    select coalesce(sum(quantity), 0) into v_quantity from public.convivio_pledges where group_id = new.id;
    if v_quantity > 0 then
      insert into public.convivio_fees (group_id, supplier_id, quantity, price, percent, amount)
      values (new.id, new.supplier_id, v_quantity, new.group_price, new.fee_percent,
              round(new.group_price * v_quantity * new.fee_percent / 100, 2))
      on conflict (group_id) do nothing;
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists convivio_fee_on_order on public.convivio_groups;
create trigger convivio_fee_on_order after update on public.convivio_groups
  for each row execute function public.convivio_fee_on_order();

create or replace function public.convivio_my_fees()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'percent', coalesce(nullif(public.setting_text('convivio_fee_percent'), '')::numeric, 3),
    'fees', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'group_id', f.group_id, 'title', g.title, 'quantity', f.quantity, 'price', f.price,
                                          'percent', f.percent, 'amount', f.amount, 'status', f.status, 'created_at', f.created_at)
                       order by f.created_at desc)
      from public.convivio_fees f join public.convivio_groups g on g.id = f.group_id
      where f.supplier_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.convivio_my_fees() from public, anon;
grant execute on function public.convivio_my_fees() to authenticated;

-- Il fornitore con commissioni arretrate (da 0,50 €) non accetta nuove Kordate.
create or replace function public.convivio_supplier_respond(p_group uuid, p_action text, p_price numeric default null, p_min int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
begin
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or v_group.supplier_id is distinct from auth.uid() or v_group.status <> 'open' then
    return 'not_allowed';
  end if;
  if v_group.supplier_status not in ('pending', 'counter') then
    return 'already_answered';
  end if;
  if p_action in ('accept', 'counter')
     and coalesce((select sum(amount) from public.convivio_fees where supplier_id = auth.uid() and status = 'due'), 0) >= 0.5 then
    return 'fees_due';
  end if;
  if p_action = 'accept' then
    update public.convivio_groups set supplier_status = 'confirmed', counter_price = null, counter_min = null, updated_at = now() where id = p_group;
  elsif p_action = 'decline' then
    update public.convivio_groups set supplier_status = 'declined', updated_at = now() where id = p_group;
  elsif p_action = 'counter' then
    if coalesce(p_price, v_group.group_price) < 0 or coalesce(p_min, v_group.min_participants) < 2 then
      return 'invalid';
    end if;
    update public.convivio_groups
    set supplier_status = 'counter', counter_price = coalesce(p_price, group_price), counter_min = coalesce(p_min, min_participants), updated_at = now()
    where id = p_group;
  else
    return 'not_allowed';
  end if;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
