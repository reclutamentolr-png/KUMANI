-- Bonus Accoglienza ceduto dallo sponsor (non più pagato da KUMANI).
-- Dal 6° invitato attivato in poi (impostabile), una parte dei KU Points
-- dell'attivazione passa dallo sponsor a chi accoglie la persona nella
-- propria stella (il titolare del posto in matrice, se è un altro Kumano):
-- Base 49 → 44 allo sponsor + 5 di Bonus Accoglienza; Pro 122 → 112 + 10.
-- Il vecchio Bonus Accoglienza pagato da KUMANI (5 punti fissi per ogni
-- posto occupato da invitati di altri) si spegne: sarebbe un doppio bonus.

insert into public.system_settings (key, value) values
  ('welcome_bonus_base', '5'),
  ('welcome_bonus_pro', '10'),
  ('welcome_bonus_from_direct', '6')
on conflict (key) do nothing;

update public.system_settings set value = '0' where key = 'matrix_spillover_bonus_points';

drop function if exists public.award_activation_points(text, uuid, text, numeric);
create or replace function public.award_activation_points(p_invoice_id text, p_customer uuid, p_kind text, p_scale numeric default 1)
returns table (awarded boolean, sponsor_id uuid, points integer, welcome_user uuid, welcome_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor uuid;
  v_points int;
  v_scale numeric := least(greatest(coalesce(p_scale, 1), 0), 1);
  v_house text := public.setting_text('house_account_id');
  v_id uuid;
  v_previous int;
  v_receiver uuid;
  v_welcome int := 0;
begin
  if p_kind not in ('activation_base', 'activation_pro', 'upgrade_pro') or p_invoice_id is null then
    return query select false, null::uuid, 0, null::uuid, 0;
    return;
  end if;

  select p.sponsor_id into v_sponsor from public.profiles p where p.id = p_customer;
  if v_sponsor is null or v_sponsor::text = coalesce(v_house, '') then
    return query select false, v_sponsor, 0, null::uuid, 0;
    return;
  end if;

  v_points := case p_kind
    when 'activation_base' then public.setting_int('network_points_activation_base', 49)
    when 'activation_pro' then public.setting_int('network_points_activation_pro', 122)
    else public.setting_int('network_points_upgrade_pro', 60)
  end;
  -- In proporzione a quanto è stato pagato davvero
  v_points := round(v_points * v_scale);
  if v_points <= 0 then
    return query select false, v_sponsor, 0, null::uuid, 0;
    return;
  end if;

  -- Bonus Accoglienza: solo per le attivazioni, dal N° invitato attivato in
  -- poi, se la persona è nella stella di un altro Kumano
  if p_kind in ('activation_base', 'activation_pro') then
    select count(*) into v_previous
    from public.network_point_awards a
    where a.user_id = v_sponsor and a.kind in ('activation_base', 'activation_pro') and a.reversed_at is null
      and a.stripe_invoice_id is distinct from p_invoice_id;
    if v_previous + 1 >= public.setting_int('welcome_bonus_from_direct', 6) then
      select parent.user_id into v_receiver
      from public.matrix_nodes child
      join public.matrix_nodes parent on parent.id = child.parent_id
      where child.user_id = p_customer;
      if v_receiver is not null and v_receiver <> v_sponsor and v_receiver::text <> coalesce(v_house, '')
         and not public.is_user_blocked(v_receiver) then
        v_welcome := round(public.setting_int(case when p_kind = 'activation_pro' then 'welcome_bonus_pro' else 'welcome_bonus_base' end,
                                              case when p_kind = 'activation_pro' then 10 else 5 end) * v_scale);
        v_welcome := least(greatest(v_welcome, 0), v_points);
      else
        v_receiver := null;
      end if;
    end if;
  end if;

  insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id)
  values (v_sponsor, p_customer, p_kind, greatest(v_points - v_welcome, 1), p_invoice_id)
  on conflict (stripe_invoice_id) do nothing
  returning id into v_id;

  if v_id is null then
    return query select false, v_sponsor, 0, null::uuid, 0;
    return;
  end if;

  -- Allo sponsor: i punti meno la parte ceduta come Bonus Accoglienza
  update public.profiles
  set network_points = coalesce(network_points, 0) + greatest(v_points - v_welcome, 1),
      network_points_earned_total = coalesce(network_points_earned_total, 0) + greatest(v_points - v_welcome, 1)
  where id = v_sponsor;
  perform public.record_network_badges(v_sponsor);

  -- A chi accoglie: la parte ceduta (tolta con lo stesso rimborso)
  if v_welcome > 0 and v_receiver is not null then
    insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id)
    values (v_receiver, p_customer, 'matrix', v_welcome, 'welcome:' || p_invoice_id)
    on conflict (stripe_invoice_id) do nothing;
    update public.profiles
    set network_points = coalesce(network_points, 0) + v_welcome,
        network_points_earned_total = coalesce(network_points_earned_total, 0) + v_welcome
    where id = v_receiver;
    perform public.record_network_badges(v_receiver);
  else
    v_welcome := 0;
    v_receiver := null;
  end if;

  return query select true, v_sponsor, greatest(v_points - v_welcome, 1), v_receiver, v_welcome;
end;
$$;
revoke all on function public.award_activation_points(text, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.award_activation_points(text, uuid, text, numeric) to service_role;

-- Regole del Bonus Accoglienza per il Wallet (testi "Come guadagni i KU Points")
create or replace function public.network_welcome_rules()
returns table (base integer, pro integer, from_direct integer)
language sql
stable
security definer
set search_path = public
as $$
  select public.setting_int('welcome_bonus_base', 5), public.setting_int('welcome_bonus_pro', 10), public.setting_int('welcome_bonus_from_direct', 6);
$$;
revoke all on function public.network_welcome_rules() from public, anon;
grant execute on function public.network_welcome_rules() to authenticated;
