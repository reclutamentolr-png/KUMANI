-- Convivio — fornitori KUMANI (professionisti Pro).
-- 1. Il Pro crea la sua scheda fornitore (attività + P.IVA, "Accetto ordini
--    di gruppo") e può pubblicare direttamente un'offerta di gruppo.
-- 2. Un capocordata può scegliere un fornitore KUMANI: il fornitore accetta,
--    rifiuta o propone un altro prezzo/soglia. Finché non conferma, il
--    Convivio non accetta adesioni e non può essere ordinato.
-- 3. Telefono condiviso con il fornitore (solo con consenso) e recensioni.

-- ---------------------------------------------------------------------------
-- Scheda fornitore
-- ---------------------------------------------------------------------------
create table if not exists public.convivio_suppliers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 120),
  vat_number text not null check (vat_number ~ '^[0-9]{11}$'),
  city text not null check (char_length(city) between 2 and 80),
  category text not null default 'food' check (category in ('food', 'tech', 'travel', 'energy', 'other')),
  description text not null default '' check (char_length(description) <= 500),
  accepts_group_orders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.convivio_suppliers enable row level security;

-- Fornitore attivo = scheda con "accetto ordini di gruppo" + piano Pro attivo.
create or replace function public.convivio_supplier_active(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.convivio_suppliers s
    join public.profiles p on p.id = s.user_id
    where s.user_id = p_uid and s.accepts_group_orders and not coalesce(p.is_blocked, false)
  ) and public.plan_of(p_uid) = 'pro';
$$;
revoke all on function public.convivio_supplier_active(uuid) from public, anon, authenticated;

create or replace function public.convivio_my_supplier()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_pro', public.plan_of(auth.uid()) = 'pro',
    'supplier', (select to_jsonb(s) - 'user_id' from public.convivio_suppliers s where s.user_id = auth.uid()),
    -- Dati dell'attività già inseriti in Preventivi, per precompilare
    'prefill', (select jsonb_build_object('business_name', q.company_name, 'vat_number', q.vat_number, 'city', q.city) from public.quote_issuer_profiles q where q.user_id = auth.uid())
  );
$$;
revoke all on function public.convivio_my_supplier() from public, anon;
grant execute on function public.convivio_my_supplier() to authenticated;

create or replace function public.convivio_supplier_save(p_business text, p_vat text, p_city text, p_category text, p_description text, p_accepts boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vat text := regexp_replace(coalesce(p_vat, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null or public.plan_of(auth.uid()) <> 'pro' then
    return 'not_pro';
  end if;
  if v_vat !~ '^[0-9]{11}$' then
    return 'invalid_vat';
  end if;
  if char_length(trim(coalesce(p_business, ''))) < 2 or char_length(trim(coalesce(p_city, ''))) < 2 then
    return 'invalid';
  end if;
  insert into public.convivio_suppliers (user_id, business_name, vat_number, city, category, description, accepts_group_orders)
  values (auth.uid(), left(trim(p_business), 120), v_vat, left(trim(p_city), 80),
          case when p_category in ('food', 'tech', 'travel', 'energy', 'other') then p_category else 'other' end,
          left(trim(coalesce(p_description, '')), 500), coalesce(p_accepts, true))
  on conflict (user_id) do update set
    business_name = excluded.business_name, vat_number = excluded.vat_number, city = excluded.city,
    category = excluded.category, description = excluded.description,
    accepts_group_orders = excluded.accepts_group_orders, updated_at = now();
  return 'ok';
end;
$$;
revoke all on function public.convivio_supplier_save(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.convivio_supplier_save(text, text, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Collegamento Convivio ↔ fornitore, telefono condiviso, recensioni
-- ---------------------------------------------------------------------------
alter table public.convivio_groups
  add column if not exists supplier_id uuid references public.profiles(id) on delete set null,
  add column if not exists supplier_status text not null default 'none'
    check (supplier_status in ('none', 'pending', 'counter', 'confirmed', 'declined')),
  add column if not exists counter_price numeric(10, 2) check (counter_price is null or counter_price >= 0),
  add column if not exists counter_min integer check (counter_min is null or counter_min between 2 and 500);
create index if not exists convivio_groups_supplier_idx on public.convivio_groups(supplier_id);

alter table public.convivio_pledges add column if not exists share_phone boolean not null default false;

create table if not exists public.convivio_reviews (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.convivio_groups(id) on delete cascade,
  reviewer uuid not null references public.profiles(id) on delete cascade,
  target text not null check (target in ('supplier', 'leader')),
  target_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  unique (group_id, reviewer, target)
);
create index if not exists convivio_reviews_target_idx on public.convivio_reviews(target_id);
alter table public.convivio_reviews enable row level security;

create or replace function public.convivio_rating(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('avg', round(avg(rating)::numeric, 1), 'count', count(*))
  from public.convivio_reviews where target_id = p_uid;
$$;
revoke all on function public.convivio_rating(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni aggiornate
-- ---------------------------------------------------------------------------
-- Stato: in più 'awaiting_supplier' (fornitore KUMANI che non ha ancora
-- confermato) e 'declined' (fornitore che ha rifiutato).
create or replace function public.convivio_status(p_group uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when g.status <> 'open' then g.status
    when g.supplier_status = 'declined' then 'declined'
    when now() > g.expires_at then case when g.supplier_status in ('none', 'confirmed') and public.convivio_people(g.id) >= g.min_participants then 'reached' else 'failed' end
    when g.supplier_status in ('pending', 'counter') then 'awaiting_supplier'
    else 'open'
  end
  from public.convivio_groups g where g.id = p_group;
$$;

create or replace function public.convivio_is_member(p_group uuid, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.convivio_groups where id = p_group and (leader_id = p_uid or supplier_id = p_uid))
      or exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = p_uid);
$$;

create or replace function public.convivio_card(p_group uuid, p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'category', g.category,
    'city', g.city,
    'supplier_name', coalesce(s.business_name, g.supplier_name),
    'supplier_kumani', g.supplier_id is not null,
    'supplier_status', g.supplier_status,
    'supplier_is_leader', g.supplier_id = g.leader_id,
    'supplier_rating', case when g.supplier_id is not null then public.convivio_rating(g.supplier_id) end,
    'unit_label', g.unit_label,
    'retail_price', g.retail_price,
    'group_price', g.group_price,
    'min_participants', g.min_participants,
    'max_participants', g.max_participants,
    'expires_at', g.expires_at,
    'status', public.convivio_status(g.id),
    'people', public.convivio_people(g.id),
    'quantity', (select coalesce(sum(quantity), 0) from public.convivio_pledges where group_id = g.id),
    'leader_name', p.first_name,
    'leader_rating', public.convivio_rating(g.leader_id),
    'is_leader', g.leader_id = p_uid,
    'is_supplier', g.supplier_id = p_uid,
    'my_quantity', (select quantity from public.convivio_pledges where group_id = g.id and user_id = p_uid)
  )
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  left join public.convivio_suppliers s on s.user_id = g.supplier_id
  where g.id = p_group;
$$;

create or replace function public.convivio_list(p_filter text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.convivio_card(g.id, auth.uid()) order by g.expires_at), '[]'::jsonb)
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where auth.uid() is not null
    and not coalesce(p.is_blocked, false)
    and case
      when p_filter = 'mine' then public.convivio_is_member(g.id, auth.uid())
      when p_filter = 'supplier' then g.supplier_id = auth.uid()
      else g.status = 'open' and g.expires_at > now() and g.supplier_status in ('none', 'confirmed')
    end;
$$;

create or replace function public.convivio_detail(p_group uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.convivio_card(g.id, auth.uid()) || jsonb_build_object(
    'description', g.description,
    'pickup_info', g.pickup_info,
    'created_at', g.created_at,
    'leader_since', p.created_at,
    'counter_price', g.counter_price,
    'counter_min', g.counter_min,
    'is_member', public.convivio_is_member(g.id, auth.uid()),
    'my_note', (select note from public.convivio_pledges where group_id = g.id and user_id = auth.uid()),
    'my_share_phone', (select share_phone from public.convivio_pledges where group_id = g.id and user_id = auth.uid()),
    'my_reviews', (select coalesce(jsonb_agg(r.target), '[]'::jsonb) from public.convivio_reviews r where r.group_id = g.id and r.reviewer = auth.uid()),
    -- Partecipanti: capocordata e aderenti; il fornitore solo dopo aver
    -- confermato (e il telefono solo di chi lo ha condiviso).
    'participants', case when (g.leader_id = auth.uid() or exists (select 1 from public.convivio_pledges where group_id = g.id and user_id = auth.uid())
                              or (g.supplier_id = auth.uid() and g.supplier_status = 'confirmed')) then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', pp.first_name,
        'quantity', cp.quantity,
        'note', case when g.leader_id = auth.uid() or g.supplier_id = auth.uid() then cp.note end,
        'phone', case when cp.share_phone and (g.supplier_id = auth.uid() or g.leader_id = auth.uid()) then pp.phone end
      ) order by cp.created_at), '[]'::jsonb)
      from public.convivio_pledges cp join public.profiles pp on pp.id = cp.user_id
      where cp.group_id = g.id
    ) else '[]'::jsonb end
  )
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  where g.id = p_group and auth.uid() is not null;
$$;

-- Creazione: con p_supplier_id = me stesso è un'offerta del fornitore Pro
-- (basta la scheda fornitore attiva); con un altro fornitore KUMANI serve la
-- verifica del capocordata e parte la richiesta di conferma.
drop function if exists public.convivio_create(text, text, text, text, text, numeric, numeric, int, int, timestamptz, text);
create or replace function public.convivio_create(
  p_title text, p_description text, p_category text, p_supplier text, p_unit text,
  p_retail numeric, p_price numeric, p_min int, p_max int, p_expires timestamptz, p_pickup text,
  p_supplier_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_own_offer boolean := p_supplier_id is not null and p_supplier_id = auth.uid();
  v_supplier public.convivio_suppliers%rowtype;
  v_id uuid;
  v_limit int;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_verified');
  end if;
  if v_own_offer then
    if not public.convivio_supplier_active(v_uid) then
      return jsonb_build_object('error', 'not_supplier');
    end if;
  elsif not public.convivio_is_verified(v_uid) then
    return jsonb_build_object('error', 'not_verified');
  end if;
  if p_supplier_id is not null then
    if not public.convivio_supplier_active(p_supplier_id) then
      return jsonb_build_object('error', 'supplier_unavailable');
    end if;
    select * into v_supplier from public.convivio_suppliers where user_id = p_supplier_id;
  end if;
  v_limit := case when v_own_offer then 10 else 3 end;
  if (select count(*) from public.convivio_groups where leader_id = v_uid and status in ('open', 'ordered')) >= v_limit then
    return jsonb_build_object('error', 'too_many');
  end if;
  if p_expires < now() + interval '1 day' or p_expires > now() + interval '60 days' then
    return jsonb_build_object('error', 'bad_deadline');
  end if;
  if coalesce(p_price, -1) < 0 or coalesce(p_min, 0) < 2 or (p_max is not null and p_max < p_min) then
    return jsonb_build_object('error', 'invalid');
  end if;
  insert into public.convivio_groups (leader_id, title, description, category, supplier_name, unit_label, retail_price, group_price,
    min_participants, max_participants, expires_at, pickup_info, city, supplier_id, supplier_status)
  values (
    v_uid, left(trim(p_title), 100), left(trim(coalesce(p_description, '')), 2000),
    case when p_category in ('food', 'tech', 'travel', 'energy', 'other') then p_category else 'other' end,
    coalesce(v_supplier.business_name, left(trim(coalesce(p_supplier, '')), 120)), left(trim(coalesce(p_unit, '')), 40),
    p_retail, p_price, least(p_min, 500), p_max, p_expires, left(trim(coalesce(p_pickup, '')), 1000),
    coalesce(v_supplier.city, (select city from public.profiles where id = v_uid)),
    p_supplier_id,
    case when p_supplier_id is null then 'none' when v_own_offer then 'confirmed' else 'pending' end
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function public.convivio_create(text, text, text, text, text, numeric, numeric, int, int, timestamptz, text, uuid) from public, anon;
grant execute on function public.convivio_create(text, text, text, text, text, numeric, numeric, int, int, timestamptz, text, uuid) to authenticated;

-- Fornitori KUMANI attivi (per la scelta del capocordata)
create or replace function public.convivio_supplier_search(p_query text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.user_id, 'business_name', s.business_name, 'city', s.city, 'category', s.category,
    'description', s.description, 'rating', public.convivio_rating(s.user_id)
  ) order by s.business_name), '[]'::jsonb)
  from (
    select * from public.convivio_suppliers s
    where s.accepts_group_orders and s.user_id <> auth.uid()
      and (nullif(trim(coalesce(p_query, '')), '') is null
           or s.business_name ilike '%' || trim(p_query) || '%' or s.city ilike '%' || trim(p_query) || '%')
    limit 50
  ) s
  where auth.uid() is not null and public.convivio_supplier_active(s.user_id);
$$;
revoke all on function public.convivio_supplier_search(text) from public, anon;
grant execute on function public.convivio_supplier_search(text) to authenticated;

-- Risposta del fornitore: 'accept' | 'decline' | 'counter' (prezzo e/o minimo)
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
revoke all on function public.convivio_supplier_respond(uuid, text, numeric, int) from public, anon;
grant execute on function public.convivio_supplier_respond(uuid, text, numeric, int) to authenticated;

-- Il capocordata accetta (o rifiuta) la controproposta del fornitore.
create or replace function public.convivio_counter_answer(p_group uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
begin
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or v_group.leader_id <> auth.uid() or v_group.supplier_status <> 'counter' or v_group.status <> 'open' then
    return 'not_allowed';
  end if;
  if p_accept then
    update public.convivio_groups
    set group_price = coalesce(counter_price, group_price),
        min_participants = coalesce(counter_min, min_participants),
        max_participants = case when max_participants is not null and max_participants < coalesce(counter_min, min_participants) then coalesce(counter_min, min_participants) else max_participants end,
        supplier_status = 'confirmed', counter_price = null, counter_min = null, updated_at = now()
    where id = p_group;
  else
    update public.convivio_groups set supplier_status = 'declined', updated_at = now() where id = p_group;
  end if;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
revoke all on function public.convivio_counter_answer(uuid, boolean) from public, anon;
grant execute on function public.convivio_counter_answer(uuid, boolean) to authenticated;

-- Adesione con consenso a condividere il telefono con il fornitore.
drop function if exists public.convivio_join(uuid, int, text);
create or replace function public.convivio_join(p_group uuid, p_quantity int, p_note text, p_share_phone boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group public.convivio_groups%rowtype;
  v_member boolean;
begin
  if v_uid is null or coalesce((select is_blocked from public.profiles where id = v_uid), false) then
    return 'not_allowed';
  end if;
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found or public.convivio_status(p_group) <> 'open' then
    return 'closed';
  end if;
  if v_group.supplier_id = v_uid then
    return 'not_allowed';
  end if;
  v_member := exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = v_uid);
  if not v_member and v_group.max_participants is not null and public.convivio_people(p_group) >= v_group.max_participants then
    return 'full';
  end if;
  insert into public.convivio_pledges (group_id, user_id, quantity, note, share_phone)
  values (p_group, v_uid, least(greatest(coalesce(p_quantity, 1), 1), 50), nullif(left(trim(coalesce(p_note, '')), 200), ''), coalesce(p_share_phone, false))
  on conflict (group_id, user_id) do update set quantity = excluded.quantity, note = excluded.note, share_phone = excluded.share_phone, updated_at = now();
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;
revoke all on function public.convivio_join(uuid, int, text, boolean) from public, anon;
grant execute on function public.convivio_join(uuid, int, text, boolean) to authenticated;

-- Stato: il capocordata o il fornitore confermato possono segnare
-- "ordinato"/"consegnato"; con un fornitore KUMANI serve la sua conferma.
create or replace function public.convivio_set_status(p_group uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
  v_status text;
  v_is_leader boolean;
  v_is_supplier boolean;
begin
  select * into v_group from public.convivio_groups where id = p_group for update;
  if not found then
    return 'not_allowed';
  end if;
  v_is_leader := v_group.leader_id = auth.uid();
  v_is_supplier := v_group.supplier_id = auth.uid() and v_group.supplier_status = 'confirmed';
  if not (v_is_leader or v_is_supplier) then
    return 'not_allowed';
  end if;
  v_status := public.convivio_status(p_group);
  if p_status = 'ordered' then
    if v_group.supplier_id is not null and v_group.supplier_status <> 'confirmed' then
      return 'supplier_not_confirmed';
    end if;
    if not (v_status in ('open', 'reached') and public.convivio_people(p_group) >= v_group.min_participants) then
      return 'not_reached';
    end if;
  elsif p_status = 'completed' then
    if v_status <> 'ordered' then
      return 'not_ordered';
    end if;
  elsif p_status = 'cancelled' then
    if v_status in ('completed', 'cancelled') then
      return 'not_allowed';
    end if;
  else
    return 'not_allowed';
  end if;
  update public.convivio_groups set status = p_status, updated_at = now() where id = p_group;
  perform public.convivio_signal(p_group);
  return 'ok';
end;
$$;

-- Recensioni: solo chi ha aderito, a Convivio consegnato.
create or replace function public.convivio_review(p_group uuid, p_target text, p_rating int, p_comment text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.convivio_groups%rowtype;
  v_target uuid;
begin
  select * into v_group from public.convivio_groups where id = p_group;
  if not found or v_group.status <> 'completed' then
    return 'not_allowed';
  end if;
  if not exists (select 1 from public.convivio_pledges where group_id = p_group and user_id = auth.uid()) then
    return 'not_allowed';
  end if;
  v_target := case p_target when 'supplier' then v_group.supplier_id when 'leader' then v_group.leader_id end;
  if v_target is null or v_target = auth.uid() or coalesce(p_rating, 0) not between 1 and 5 then
    return 'invalid';
  end if;
  insert into public.convivio_reviews (group_id, reviewer, target, target_id, rating, comment)
  values (p_group, auth.uid(), p_target, v_target, p_rating, nullif(left(trim(coalesce(p_comment, '')), 300), ''))
  on conflict (group_id, reviewer, target) do update set rating = excluded.rating, comment = excluded.comment;
  return 'ok';
end;
$$;
revoke all on function public.convivio_review(uuid, text, int, text) from public, anon;
grant execute on function public.convivio_review(uuid, text, int, text) to authenticated;
