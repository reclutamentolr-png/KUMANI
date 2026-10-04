-- Passaggio da Pass a piano (Base o Pro) senza pagare due volte:
-- 1. il valore non ancora usato dei Pass inclusi nel nuovo piano viene
--    scalato dal primo pagamento e quei Pass terminano (converted_at);
-- 2. i KU Points dell'attivazione sono proporzionali a quanto il cliente paga
--    davvero (sconto del credito, o qualsiasi altro sconto): p_scale è la
--    parte pagata rispetto al prezzo pieno (da 0 a 1).

alter table public.tool_passes add column if not exists converted_at timestamptz;

drop function if exists public.award_activation_points(text, uuid, text);
create or replace function public.award_activation_points(p_invoice_id text, p_customer uuid, p_kind text, p_scale numeric default 1)
returns table (awarded boolean, sponsor_id uuid, points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sponsor uuid;
  v_points int;
  v_house text := public.setting_text('house_account_id');
  v_id uuid;
begin
  if p_kind not in ('activation_base', 'activation_pro', 'upgrade_pro') or p_invoice_id is null then
    return query select false, null::uuid, 0;
    return;
  end if;

  select p.sponsor_id into v_sponsor from public.profiles p where p.id = p_customer;
  if v_sponsor is null or v_sponsor::text = coalesce(v_house, '') then
    return query select false, v_sponsor, 0;
    return;
  end if;

  v_points := case p_kind
    when 'activation_base' then public.setting_int('network_points_activation_base', 49)
    when 'activation_pro' then public.setting_int('network_points_activation_pro', 122)
    else public.setting_int('network_points_upgrade_pro', 60)
  end;
  -- In proporzione a quanto è stato pagato davvero
  v_points := round(v_points * least(greatest(coalesce(p_scale, 1), 0), 1));
  if v_points <= 0 then
    return query select false, v_sponsor, 0;
    return;
  end if;

  insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id)
  values (v_sponsor, p_customer, p_kind, v_points, p_invoice_id)
  on conflict (stripe_invoice_id) do nothing
  returning id into v_id;

  if v_id is null then
    return query select false, v_sponsor, 0;
    return;
  end if;

  update public.profiles
  set network_points = coalesce(network_points, 0) + v_points,
      network_points_earned_total = coalesce(network_points_earned_total, 0) + v_points
  where id = v_sponsor;

  perform public.record_network_badges(v_sponsor);
  return query select true, v_sponsor, v_points;
end;
$$;
revoke all on function public.award_activation_points(text, uuid, text, numeric) from public, anon, authenticated;
grant execute on function public.award_activation_points(text, uuid, text, numeric) to service_role;
