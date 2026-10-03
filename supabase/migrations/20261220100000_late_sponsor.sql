-- Invito indicato dopo la registrazione. Chi si è iscritto senza codice
-- (signup_source 'direct', sotto l'account KUMANI) può indicare entro 15
-- giorni il codice di chi lo ha invitato: passa nella stella di quel Kumano.
-- Lo Staff può farlo anche dopo i 15 giorni (su richiesta del Kumano).
-- Regole: una sola volta; solo se sotto di lui non c'è ancora nessuno;
-- non se stesso, non l'account KUMANI, non un account bloccato o disattivo.
-- I KU Points di un'attivazione già pagata li assegna poi il server
-- (award_activation_points, una volta per fattura).

alter table public.profiles add column if not exists late_sponsor_at timestamptz;

insert into public.system_settings (key, value)
values ('late_sponsor_days', '15')
on conflict (key) do nothing;

-- Stato per la persona: può ancora indicare l'invitante? Entro quando?
create or replace function public.late_sponsor_status(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_house text := public.setting_text('house_account_id');
  v_days int := public.setting_int('late_sponsor_days', 15);
  v_profile record;
  v_node uuid;
begin
  select signup_source, sponsor_id, created_at, late_sponsor_at into v_profile from public.profiles where id = p_user;
  if not found or v_profile.signup_source <> 'direct' or v_profile.sponsor_id::text is distinct from v_house or v_profile.late_sponsor_at is not null then
    return jsonb_build_object('eligible', false);
  end if;
  select id into v_node from public.matrix_nodes where user_id = p_user;
  if v_node is not null and exists (select 1 from public.matrix_nodes where parent_id = v_node) then
    return jsonb_build_object('eligible', false, 'reason', 'has_team');
  end if;
  return jsonb_build_object(
    'eligible', v_profile.created_at > now() - make_interval(days => v_days),
    'until', v_profile.created_at + make_interval(days => v_days)
  );
end;
$$;

-- Esiti: ok · not_direct · already · expired · has_team · invalid_code · self
create or replace function public.assign_late_sponsor(p_user uuid, p_code text, p_ignore_deadline boolean default false)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house text := public.setting_text('house_account_id');
  v_days int := public.setting_int('late_sponsor_days', 15);
  v_code text := upper(trim(coalesce(p_code, '')));
  v_profile record;
  v_sponsor uuid;
  v_node uuid;
begin
  -- Stesso blocco del posizionamento in matrice: niente operazioni sovrapposte
  perform pg_advisory_xact_lock(hashtext('kumani_matrix_placement'));

  select signup_source, sponsor_id, created_at, late_sponsor_at into v_profile from public.profiles where id = p_user for update;
  if not found or v_profile.signup_source <> 'direct' or v_profile.sponsor_id::text is distinct from v_house then
    return 'not_direct';
  end if;
  if v_profile.late_sponsor_at is not null then
    return 'already';
  end if;
  if not p_ignore_deadline and v_profile.created_at <= now() - make_interval(days => v_days) then
    return 'expired';
  end if;

  select id into v_sponsor from public.profiles
  where referral_code = v_code and coalesce(is_active, true) = true and not coalesce(is_blocked, false);
  if v_sponsor is null or v_sponsor::text = coalesce(v_house, '') or not exists (select 1 from public.matrix_nodes where user_id = v_sponsor) then
    return 'invalid_code';
  end if;
  if v_sponsor = p_user then
    return 'self';
  end if;

  select id into v_node from public.matrix_nodes where user_id = p_user;
  if v_node is not null and exists (select 1 from public.matrix_nodes where parent_id = v_node) then
    return 'has_team';
  end if;

  -- Fuori dalla struttura KUMANI, dentro la stella di chi ha invitato
  delete from public.matrix_nodes where user_id = p_user;
  update public.profiles
  set sponsor_id = v_sponsor, signup_source = 'invite', activity_thanks_to = null, late_sponsor_at = now()
  where id = p_user;
  perform public.place_in_matrix(p_user, v_sponsor);
  return 'ok';
end;
$$;

revoke all on function public.late_sponsor_status(uuid) from public, anon, authenticated;
revoke all on function public.assign_late_sponsor(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.late_sponsor_status(uuid) to service_role;
grant execute on function public.assign_late_sponsor(uuid, text, boolean) to service_role;
