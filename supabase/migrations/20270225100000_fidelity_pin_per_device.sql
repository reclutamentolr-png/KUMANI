-- Kumi Card, PIN della cassa: i tentativi sbagliati si contano per
-- dispositivo (impronta dell'indirizzo IP), non per tessera. Prima chi
-- conosceva il link della cassa poteva sbagliare il PIN apposta ogni 15
-- minuti e tenere bloccata la cassa del negozio; ora blocca solo sé stesso.
-- Resta un tetto generale per tessera (100 errori l'ora da qualsiasi
-- dispositivo) perché il PIN non si possa indovinare provando tutte le
-- combinazioni da tanti indirizzi.

create table if not exists public.fidelity_pin_attempts (
  card_id uuid not null references public.fidelity_cards(id) on delete cascade,
  client_key text not null check (char_length(client_key) <= 64),
  failed integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (card_id, client_key)
);
alter table public.fidelity_pin_attempts enable row level security;
-- Solo il server (service role) la usa: nessuna regola per gli utenti

create or replace function public.fidelity_pin_attempt_device(p_card uuid, p_client text, p_max integer, p_lock_minutes integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_recent integer;
begin
  perform 1 from public.fidelity_cards where id = p_card;
  if not found then
    return 'notfound';
  end if;
  -- Tetto generale per tessera
  select coalesce(sum(failed), 0) into v_recent
  from public.fidelity_pin_attempts where card_id = p_card and updated_at > now() - interval '1 hour';
  if v_recent >= 100 then
    return 'locked';
  end if;

  insert into public.fidelity_pin_attempts (card_id, client_key) values (p_card, left(coalesce(p_client, 'unknown'), 64))
  on conflict (card_id, client_key) do nothing;
  select failed, locked_until into v_row
  from public.fidelity_pin_attempts where card_id = p_card and client_key = left(coalesce(p_client, 'unknown'), 64) for update;
  if v_row.locked_until is not null and v_row.locked_until > now() then
    return 'locked';
  end if;
  if v_row.failed + 1 > p_max then
    update public.fidelity_pin_attempts
    set failed = 0, locked_until = now() + make_interval(mins => p_lock_minutes), updated_at = now()
    where card_id = p_card and client_key = left(coalesce(p_client, 'unknown'), 64);
    return 'locked';
  end if;
  update public.fidelity_pin_attempts set failed = failed + 1, updated_at = now()
  where card_id = p_card and client_key = left(coalesce(p_client, 'unknown'), 64);
  return 'try';
end;
$$;
revoke all on function public.fidelity_pin_attempt_device(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.fidelity_pin_attempt_device(uuid, text, integer, integer) to service_role;

-- PIN giusto: azzera i tentativi di quel dispositivo
create or replace function public.fidelity_pin_success(p_card uuid, p_client text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.fidelity_pin_attempts where card_id = p_card and client_key = left(coalesce(p_client, 'unknown'), 64);
$$;
revoke all on function public.fidelity_pin_success(uuid, text) from public, anon, authenticated;
grant execute on function public.fidelity_pin_success(uuid, text) to service_role;

-- Le tessere bloccate col vecchio sistema si sbloccano subito
update public.fidelity_cards set pin_failed_attempts = 0, pin_locked_until = null where pin_locked_until is not null or pin_failed_attempts > 0;

-- Pulizia: righe ferme da più di un giorno
create or replace function public.fidelity_pin_attempts_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.fidelity_pin_attempts where updated_at < now() - interval '1 day';
$$;
revoke all on function public.fidelity_pin_attempts_cleanup() from public, anon, authenticated;
grant execute on function public.fidelity_pin_attempts_cleanup() to service_role;
