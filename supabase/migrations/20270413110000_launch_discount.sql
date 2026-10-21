-- Promozione di lancio «Early Bird» (21/10/2026): sconto commerciale del 100%
-- sul Piano Base per 12 mesi ai primi 50 utenti in ordine cronologico di
-- registrazione (art. 6 c.1 lett. c DPR 430/2001: riduzione di prezzo, non
-- premio). Lo sconto si applica da solo al completamento dell'iscrizione
-- (profilo creato) e il Base si attiva subito, senza rinnovo automatico.
-- Gli iscritti di prima senza abbonamento attivo entrano nei 50 (in ordine di
-- iscrizione) con founders_include_existing(); chi è già attivo resta fuori.

alter table public.founder_members add column if not exists notified_at timestamptz;

-- Attiva il Base per 12 mesi (voucher dall'account KUMANI, già riscattato)
create or replace function public.founder_activate(p_user uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_code text;
begin
  v_code := public.create_prize_voucher(p_user, 'base', 'founder', true);
  if v_code is null then
    return null;
  end if;
  update public.subscription_vouchers
  set status = 'redeemed', redeemed_by = p_user, redeemed_at = now(), campaign = 'launch_discount'
  where code = v_code;
  update public.profiles
  set subscription_status = 'active', subscription_expires_at = now() + interval '1 year', subscription_source = 'voucher', subscription_plan = 'base'
  where id = p_user;
  update public.founder_members set voucher_code = v_code where user_id = p_user;
  return v_code;
end;
$function$;

-- Un posto tra i primi 50 (atomico). p_check_enabled = false solo per gli
-- iscritti di prima (inclusi dall'Admin prima di accendere la promozione).
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
  -- Persona vera, senza abbonamento attivo; non ospite, bloccata, Staff,
  -- account KUMANI o agente
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user and p.guest_until is null and not coalesce(p.is_blocked, false)
      and not public.admin_is_staff(p.id) and p.id::text is distinct from public.setting_text('house_account_id')
      and coalesce(p.occupation, '') <> 'Agente KUMANI'
      and not (p.subscription_status = 'active' and (p.subscription_expires_at is null or p.subscription_expires_at > now()))
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

-- Iscrizione completata (profilo creato): lo sconto si applica da solo.
-- Mai bloccare l'iscrizione per un errore della promozione.
create or replace function public.founders_on_signup()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  begin
    perform public.founders_claim(new.id, true);
  exception when others then
    raise warning 'founders_on_signup: %', sqlerrm;
  end;
  return new;
end;
$function$;
drop trigger if exists founders_on_signup on public.profiles;
create trigger founders_on_signup after insert on public.profiles for each row execute function public.founders_on_signup();

-- Iscritti di prima senza abbonamento attivo: entrano nei 50 in ordine di iscrizione
create or replace function public.founders_include_existing()
 returns int
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record;
  v_count int := 0;
begin
  for r in select id from public.profiles where guest_until is null order by created_at loop
    if public.founders_claim(r.id, false) is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$function$;

-- Il vecchio meccanismo («dopo un servizio usato») non serve più
drop function if exists public.claim_founder_slot(uuid);
delete from public.system_settings where key = 'founders_since';

revoke execute on function public.founder_activate(uuid) from public, anon, authenticated;
revoke execute on function public.founders_claim(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.founders_on_signup() from public, anon, authenticated;
revoke execute on function public.founders_include_existing() from public, anon, authenticated;
