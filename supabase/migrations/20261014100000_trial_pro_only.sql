-- Prova Pro gratuita: apre solo gli strumenti Pro (e quelli gratuiti), non
-- quelli del piano Base. Chi paga il Pro continua ad avere tutto (il Pro
-- include il Base); chi ha il Base pagato e prova il Pro tiene il suo Base.

-- Vero se l'utente ha soltanto la prova Pro, senza un abbonamento pagato attivo.
create or replace function public.is_trial_only(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.pro_trial_ends_at is not null
       and p.pro_trial_ends_at > now()
       and not (
         p.subscription_status = 'active'
         and (p.subscription_expires_at is null or p.subscription_expires_at > now())
       )
    from public.profiles p
    where p.id = p_user_id
  ), false);
$$;
revoke all on function public.is_trial_only(uuid) from public, anon, authenticated;

-- Per l'interfaccia (schede del marketplace e della dashboard).
create or replace function public.my_trial_only()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_trial_only(auth.uid());
$$;
revoke all on function public.my_trial_only() from public, anon;
grant execute on function public.my_trial_only() to authenticated;

create or replace function public.tool_access(p_user_id uuid, p_tool text)
returns table(allowed boolean, required_plan text, known boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_enabled boolean;
  v_required text;
  v_known boolean;
  v_plan text := coalesce(public.plan_of(p_user_id), 'none');
  v_trial_only boolean := public.is_trial_only(p_user_id);
begin
  select s.is_enabled, s.required_plan into v_enabled, v_required
  from public.marketplace_settings s where s.tool_name = p_tool;
  v_known := found;
  v_enabled := coalesce(v_enabled, true);
  v_required := coalesce(v_required, 'base');

  return query select
    v_enabled and (
      v_required = 'free'
      or (v_required = 'base' and v_plan in ('base', 'pro') and not v_trial_only)
      or (v_required = 'pro' and v_plan = 'pro')
    ),
    v_required,
    v_known;
end;
$$;
