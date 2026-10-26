-- «Solo Staff» con tester: oltre allo Staff, l'Admin può aprire un servizio in
-- anteprima a singoli iscritti scelti per provarlo. Valgono solo mentre il
-- servizio è «Solo Staff»: acceso lo vedono tutti, spento nessuno.
-- La tabella si legge e si scrive solo dal server (chiave di servizio).
create table if not exists public.tool_testers (
  tool_name text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users (id) on delete set null,
  primary key (tool_name, user_id)
);
alter table public.tool_testers enable row level security;

create or replace function public.is_tool_tester(p_user uuid, p_tool text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.tool_testers t where t.user_id = p_user and t.tool_name = p_tool);
$$;
revoke all on function public.is_tool_tester(uuid, text) from public, anon, authenticated;

-- Acceso per chi lo guarda: in anteprima per lo Staff e per i suoi tester
create or replace function public.tool_online(p_tool text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce((
    select s.is_enabled or (s.staff_preview and auth.uid() is not null and (public.admin_is_staff(auth.uid()) or public.is_tool_tester(auth.uid(), p_tool)))
    from public.marketplace_settings s where s.tool_name = p_tool
  ), true);
$$;

-- In anteprima lo Staff e i tester lo usano senza limiti di piano; gli altri no
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

  if not v_enabled and coalesce(v_preview, false) and p_user_id is not null
     and (public.admin_is_staff(p_user_id) or public.is_tool_tester(p_user_id, p_tool)) then
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
