-- Promozione di lancio: fuori dai 50 anche chi ha un regalo dell'Admin
-- (Base o Pro) ancora da attivare (es. Salvatore Calogero, 21/10/2026)
create or replace function public.founders_claim(p_user uuid, p_check_enabled boolean)
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_limit int := public.setting_int('founders_limit', 50);
  v_next int;
begin
  if p_check_enabled and public.setting_text('founders_enabled') is distinct from 'true' then
    return null;
  end if;
  lock table public.founder_members in share row exclusive mode;
  if exists (select 1 from public.founder_members where user_id = p_user) then
    return null;
  end if;
  -- Persona vera, senza abbonamento attivo né regalo dell'Admin da attivare;
  -- non ospite, bloccata, Staff, account KUMANI o agente
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user and p.guest_until is null and not coalesce(p.is_blocked, false)
      and not public.admin_is_staff(p.id) and p.id::text is distinct from public.setting_text('house_account_id')
      and coalesce(p.occupation, '') <> 'Agente KUMANI'
      and not (p.subscription_status = 'active' and (p.subscription_expires_at is null or p.subscription_expires_at > now()))
  ) or exists (
    select 1 from public.subscription_vouchers v where v.holder_id = p_user and v.prize_key = 'admin_gift' and v.status = 'active'
  ) then
    return null;
  end if;
  select coalesce(max(number), 0) + 1 into v_next from public.founder_members where counted;
  if v_next > v_limit then
    return null;
  end if;
  insert into public.founder_members (user_id, number, counted) values (p_user, v_next, true);
  perform public.founder_activate(p_user);
  return v_next;
end;
$function$;
revoke execute on function public.founders_claim(uuid, boolean) from public, anon, authenticated;
