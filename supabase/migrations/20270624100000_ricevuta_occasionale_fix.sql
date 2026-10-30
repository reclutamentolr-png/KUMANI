-- RICEVUTA PER PRESTAZIONE OCCASIONALE – correzioni dopo il controllo
-- (idempotente: si può rieseguire).
--
-- 1) Cliente collegato: una ricevuta può puntare solo a un cliente della
--    stessa persona. Prima la chiave esterna accettava anche l'id di un
--    cliente di un altro utente (chiamando l'API direttamente).
-- 2) Eliminazione dell'ultima ricevuta e nuova ricevuta nello stesso momento
--    (due dispositivi): l'eliminazione non prendeva il lucchetto della
--    numerazione, quindi poteva restare un buco (eliminata la n. 5 mentre
--    nasceva la n. 6). Ora l'eliminazione prende lo stesso lucchetto e
--    ricontrolla di essere davvero l'ultima. Non vale per le cancellazioni a
--    cascata (account eliminato) né per lo Staff con la chiave di servizio.

create or replace function public.occasional_receipts_number()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.year := extract(year from new.issue_date)::smallint;
    perform pg_advisory_xact_lock(hashtextextended('occasional_receipts:' || new.user_id::text || ':' || new.year::text, 0));
    if (select count(*) from public.occasional_receipts where user_id = new.user_id and year = new.year) >= 5000 then
      raise exception 'ro_limit';
    end if;
    select coalesce(max(number), 0) + 1 into new.number
      from public.occasional_receipts
      where user_id = new.user_id and year = new.year;
    new.created_at := now();
    new.updated_at := now();
    if new.client_id is not null and not exists (
      select 1 from public.occasional_receipt_clients c where c.id = new.client_id and c.user_id = new.user_id
    ) then
      raise exception 'ro_client';
    end if;
    return new;
  end if;
  new.user_id := old.user_id;
  new.year := old.year;
  new.number := old.number;
  new.created_at := old.created_at;
  new.updated_at := now();
  if extract(year from new.issue_date)::smallint <> old.year then
    raise exception 'ro_year_change';
  end if;
  if new.client_id is not null and new.client_id is distinct from old.client_id and not exists (
    select 1 from public.occasional_receipt_clients c where c.id = new.client_id and c.user_id = new.user_id
  ) then
    raise exception 'ro_client';
  end if;
  return new;
end;
$$;

create or replace function public.occasional_receipts_delete_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Solo eliminazioni chieste dall'utente (non a cascata, non dallo Staff)
  if pg_trigger_depth() = 1 and (select auth.uid()) is not null then
    perform pg_advisory_xact_lock(hashtextextended('occasional_receipts:' || old.user_id::text || ':' || old.year::text, 0));
    if exists (
      select 1 from public.occasional_receipts o
      where o.user_id = old.user_id and o.year = old.year and o.number > old.number
    ) then
      raise exception 'ro_not_last';
    end if;
  end if;
  return old;
end;
$$;
drop trigger if exists occasional_receipts_delete_guard on public.occasional_receipts;
create trigger occasional_receipts_delete_guard before delete on public.occasional_receipts
  for each row execute function public.occasional_receipts_delete_guard();
