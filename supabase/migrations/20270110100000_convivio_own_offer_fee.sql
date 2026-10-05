-- Commissione KUMANI anche sulle offerte create dal fornitore stesso.
-- Prima la percentuale si fissava solo quando un fornitore confermava la
-- proposta di un capocordata (aggiornamento): le offerte proprie nascono già
-- confermate (inserimento), restavano senza percentuale e quindi senza
-- commissione quando diventavano ordinate. Ora la percentuale si fissa anche
-- all'inserimento di una Kordata con fornitore già confermato.

create or replace function public.convivio_fee_percent_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.supplier_id is not null and new.supplier_status = 'confirmed'
     and (tg_op = 'INSERT' or old.supplier_status is distinct from 'confirmed') then
    new.fee_percent := coalesce(nullif(public.setting_text('convivio_fee_percent'), '')::numeric, 3);
  end if;
  return new;
end;
$$;

drop trigger if exists convivio_fee_percent_on_confirm on public.convivio_groups;
create trigger convivio_fee_percent_on_confirm before insert or update on public.convivio_groups
  for each row execute function public.convivio_fee_percent_on_confirm();

-- Offerte proprie già esistenti e non ancora ordinate: percentuale attuale
-- (quelle già ordinate o chiuse restano come sono)
update public.convivio_groups
set fee_percent = coalesce(nullif(public.setting_text('convivio_fee_percent'), '')::numeric, 3)
where supplier_id is not null and supplier_status = 'confirmed' and fee_percent is null and status = 'open';
