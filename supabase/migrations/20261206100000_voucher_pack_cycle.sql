-- Pacchetti voucher a ciclo: un pacchetto riscattato non si può riscattare
-- di nuovo finché non sono stati riscattati anche tutti gli altri; poi il
-- ciclo ricomincia (tornano disponibili tutti).
-- my_network_wallet restituisce anche i pacchetti già presi nel ciclo e i
-- punti assegnati per attivazione, mostrati nel Portafoglio.

alter table public.profiles
  add column if not exists voucher_packs_redeemed smallint[] not null default '{}';

-- Mai impostabile dal browser (in modifica la protegge la whitelist di
-- profiles_guard_privileged_columns)
create or replace function public.profiles_guard_network_wallet()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.network_points_earned_total := 0;
    new.voucher_credit_cents := 0;
    new.voucher_packs_redeemed := '{}';
  end if;
  return new;
end;
$$;

create or replace function public.redeem_voucher_pack(p_index integer)
returns table (success boolean, reason text, new_network_points integer, new_credit_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_packs jsonb := public.voucher_packs();
  v_pack jsonb;
  v_points int;
  v_cents int;
  v_spend record;
  v_credit int;
  v_redeemed smallint[];
begin
  if auth.uid() is null then
    return;
  end if;
  v_pack := v_packs -> p_index;
  if v_pack is null then
    return query select false, 'not_found', coalesce((select network_points from profiles where id = auth.uid()), 0), coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  select coalesce(voucher_packs_redeemed, '{}') into v_redeemed from profiles where id = auth.uid() for update;
  if p_index = any(v_redeemed) then
    return query select false, 'already_redeemed', coalesce((select network_points from profiles where id = auth.uid()), 0), coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  v_points := (v_pack ->> 'points')::int;
  v_cents := (v_pack ->> 'credit_eur')::int * 100;

  select * into v_spend from public.spend_network_points(v_points);
  if not v_spend.success then
    return query select false, 'insufficient_points', v_spend.new_network_points, coalesce((select voucher_credit_cents from profiles where id = auth.uid()), 0);
    return;
  end if;

  -- Pacchetto preso; presi tutti → il ciclo ricomincia
  v_redeemed := array_append(v_redeemed, p_index::smallint);
  if cardinality(v_redeemed) >= jsonb_array_length(v_packs) then
    v_redeemed := '{}';
  end if;

  update profiles
  set voucher_credit_cents = coalesce(voucher_credit_cents, 0) + v_cents,
      voucher_packs_redeemed = v_redeemed
  where id = auth.uid()
  returning voucher_credit_cents into v_credit;

  insert into public.voucher_credit_movements (user_id, kind, points_spent, cents) values (auth.uid(), 'pack', v_points, v_cents);
  return query select true, null::text, v_spend.new_network_points, v_credit;
end;
$$;
grant execute on function public.redeem_voucher_pack(integer) to authenticated;

drop function if exists public.my_network_wallet();
create function public.my_network_wallet()
returns table (
  network_points integer,
  earned_total integer,
  voucher_credit_cents integer,
  packs jsonb,
  voucher_value_base_eur integer,
  voucher_value_pro_eur integer,
  packs_redeemed smallint[],
  points_activation_base integer,
  points_activation_pro integer,
  points_upgrade_pro integer,
  points_spillover integer
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.network_points, 0), coalesce(p.network_points_earned_total, 0), coalesce(p.voucher_credit_cents, 0),
         public.voucher_packs(),
         public.setting_int('voucher_value_base_eur', 49),
         public.setting_int('voucher_value_pro_eur', 149),
         coalesce(p.voucher_packs_redeemed, '{}'),
         public.setting_int('network_points_activation_base', 49),
         public.setting_int('network_points_activation_pro', 122),
         public.setting_int('network_points_upgrade_pro', 60),
         public.setting_int('matrix_spillover_bonus_points', 5)
  from public.profiles p
  where p.id = auth.uid();
$$;
grant execute on function public.my_network_wallet() to authenticated;

-- Pacchetti già riscattati prima di questa modifica: si ricavano dai
-- movimenti del credito (punti spesi = pacchetto). Se risultano presi tutti,
-- il ciclo riparte da zero.
with taken as (
  select m.user_id, array_agg(distinct (p.ord - 1)::smallint order by (p.ord - 1)::smallint) as idx
  from public.voucher_credit_movements m
  join lateral jsonb_array_elements(public.voucher_packs()) with ordinality as p(pack, ord)
    on (p.pack ->> 'points')::int = m.points_spent
  where m.kind = 'pack'
  group by m.user_id
)
update public.profiles pr
set voucher_packs_redeemed = case when cardinality(t.idx) >= jsonb_array_length(public.voucher_packs()) then '{}' else t.idx end
from taken t
where pr.id = t.user_id;
