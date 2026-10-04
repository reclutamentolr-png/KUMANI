-- KU Points per i Pass: chi compra un singolo servizio (Pass di un anno)
-- fa guadagnare a chi lo ha invitato (sponsor diretto) i KU Points decisi
-- dall'Admin per quel servizio (0 = nessun punto). Solo al primo acquisto
-- del Pass di quel servizio (il rinnovo "Aggiungi un anno" non ne dà, come
-- i rinnovi degli abbonamenti). Un rimborso li toglie.

alter table public.marketplace_settings
  add column if not exists pass_ku_points integer not null default 0 check (pass_ku_points between 0 and 10000);

alter table public.network_point_awards drop constraint if exists network_point_awards_kind_check;
alter table public.network_point_awards add constraint network_point_awards_kind_check
  check (kind in ('activation_base', 'activation_pro', 'upgrade_pro', 'matrix', 'tool_pass'));
alter table public.network_point_awards add column if not exists tool text;

-- p_ref: riferimento unico del pagamento ('pass:<payment_intent>')
create or replace function public.award_pass_points(p_ref text, p_customer uuid, p_tool text)
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
  if p_ref is null or p_customer is null or p_tool is null then
    return query select false, null::uuid, 0;
    return;
  end if;

  select p.sponsor_id into v_sponsor from public.profiles p where p.id = p_customer;
  if v_sponsor is null or v_sponsor::text = coalesce(v_house, '') then
    return query select false, v_sponsor, 0;
    return;
  end if;

  select coalesce(ms.pass_ku_points, 0) into v_points from public.marketplace_settings ms where ms.tool_name = p_tool;
  if coalesce(v_points, 0) <= 0 then
    return query select false, v_sponsor, 0;
    return;
  end if;

  -- Solo il primo Pass di questo servizio per questo cliente
  if exists (
    select 1 from public.network_point_awards a
    where a.kind = 'tool_pass' and a.source_user_id = p_customer and a.tool = p_tool and a.reversed_at is null
  ) then
    return query select false, v_sponsor, 0;
    return;
  end if;

  insert into public.network_point_awards (user_id, source_user_id, kind, points, stripe_invoice_id, tool)
  values (v_sponsor, p_customer, 'tool_pass', v_points, p_ref, p_tool)
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
revoke all on function public.award_pass_points(text, uuid, text) from public, anon, authenticated;
grant execute on function public.award_pass_points(text, uuid, text) to service_role;
