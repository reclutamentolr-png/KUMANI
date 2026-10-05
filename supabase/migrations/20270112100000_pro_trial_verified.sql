-- Prova Pro gratuita solo con un dato fiscale verificato: Partita IVA
-- (cifra di controllo + VIES) oppure, per chi lavora senza Partita IVA,
-- codice fiscale coerente con nome, cognome e data di nascita del profilo.
-- Una sola prova per Partita IVA o codice fiscale, per sempre: aprire un
-- altro account con un'altra email non basta più per ricominciare la prova.
-- Le verifiche le fa il server (src/app/actions/proTrial.ts), che poi chiama
-- grant_pro_trial(); start_pro_trial() non si può più chiamare dal browser.

create table if not exists public.pro_trial_ids (
  id_type text not null check (id_type in ('vat', 'tax_code')),
  id_value text not null check (char_length(id_value) between 4 and 40),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (id_type, id_value)
);
alter table public.pro_trial_ids enable row level security;
-- Nessuna policy: si legge e si scrive solo dal server.

revoke execute on function public.start_pro_trial() from authenticated;

create or replace function public.grant_pro_trial(p_user uuid, p_type text, p_value text)
returns table (status text, trial_ends_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_profile public.profiles%rowtype;
  v_days int;
  v_end timestamptz;
begin
  select * into v_profile from public.profiles where id = p_user for update;
  if not found or coalesce(v_profile.is_blocked, false) then
    return query select 'not_allowed'::text, null::timestamptz;
    return;
  end if;
  if public.plan_of(p_user) = 'pro' then
    return query select 'already_pro'::text, v_profile.pro_trial_ends_at;
    return;
  end if;
  if v_profile.pro_trial_ends_at is not null then
    return query select 'already_used'::text, v_profile.pro_trial_ends_at;
    return;
  end if;

  insert into public.pro_trial_ids (id_type, id_value, user_id) values (p_type, upper(p_value), p_user)
  on conflict (id_type, id_value) do nothing;
  if not found then
    return query select 'id_used'::text, null::timestamptz;
    return;
  end if;

  v_days := coalesce(nullif(public.setting_text('pro_trial_days'), '')::int, 15);
  v_end := now() + make_interval(days => greatest(v_days, 1));
  update public.profiles set pro_trial_ends_at = v_end where id = p_user;
  return query select 'ok'::text, v_end;
end;
$$;
revoke all on function public.grant_pro_trial(uuid, text, text) from public, anon, authenticated;
grant execute on function public.grant_pro_trial(uuid, text, text) to service_role;
