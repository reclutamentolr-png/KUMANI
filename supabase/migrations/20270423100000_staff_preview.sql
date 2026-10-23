-- «Solo Staff»: un servizio spento per gli iscritti (is_enabled = false) ma
-- aperto ad amministratori e Staff, per provarlo prima di annunciarlo.
-- Tre posizioni in Admin: Acceso (true, false), Spento (false, false),
-- Solo Staff (false, true).

alter table public.marketplace_settings
  add column if not exists staff_preview boolean not null default false;

-- Acceso per chi lo guarda: per lo Staff anche in anteprima
create or replace function public.tool_online(p_tool text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce((
    select s.is_enabled or (s.staff_preview and auth.uid() is not null and public.admin_is_staff(auth.uid()))
    from public.marketplace_settings s where s.tool_name = p_tool
  ), true);
$$;

-- In anteprima lo Staff lo usa senza limiti di piano; gli iscritti no
create or replace function public.tool_access(p_user_id uuid, p_tool text)
returns table(allowed boolean, required_plan text, known boolean)
language plpgsql
stable security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_enabled boolean;
  v_preview boolean;
  v_required text;
  v_known boolean;
  v_plan text := coalesce(public.plan_of(p_user_id), 'none');
  v_trial_only boolean := public.is_trial_only(p_user_id);
  v_guest boolean := public.is_guest(p_user_id);
begin
  select s.is_enabled, s.staff_preview, s.required_plan into v_enabled, v_preview, v_required
  from public.marketplace_settings s where s.tool_name = p_tool;
  v_known := found;
  v_enabled := coalesce(v_enabled, true);
  v_required := coalesce(v_required, 'base');

  if not v_enabled and coalesce(v_preview, false) and p_user_id is not null and public.admin_is_staff(p_user_id) then
    return query select true, v_required, v_known;
    return;
  end if;

  if v_guest then
    return query select
      v_enabled and auth.uid() = p_user_id and public.has_tool_pass(p_user_id, p_tool),
      v_required,
      v_known;
    return;
  end if;

  return query select
    v_enabled and (
      v_required = 'free'
      or (v_required = 'base' and v_plan in ('base', 'pro') and not v_trial_only)
      or (v_required = 'pro' and v_plan = 'pro')
      or public.has_tool_pass(p_user_id, p_tool)
    ),
    v_required,
    v_known;
end;
$$;

-- I servizi nuovi in prova: pronti ma non ancora annunciati
update public.marketplace_settings set staff_preview = true
where tool_name in ('lumen', 'vox', 'captio', 'diarium', 'imago', 'forma', 'tutela') and is_enabled = false;
