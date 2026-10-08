-- Ricevute digitali: indicazione dell'IVA sul valore (+ IVA / IVA inclusa /
-- nessuna) e intestazione con logo e dati della Scheda attività di chi la
-- emette (si può togliere, es. per un prestito tra privati).

alter table public.digital_receipts add column if not exists vat_mode text not null default 'none';
alter table public.digital_receipts drop constraint if exists digital_receipts_vat_mode_check;
alter table public.digital_receipts add constraint digital_receipts_vat_mode_check check (vat_mode in ('plus', 'included', 'none'));
alter table public.digital_receipts add column if not exists show_issuer boolean not null default true;

-- Pagina pubblica della ricevuta: anche IVA e dati dell'azienda (solo se
-- chi la emette ha scelto di mostrarli)
drop function if exists public.get_digital_receipt_by_code(text);
create function public.get_digital_receipt_by_code(p_code text)
returns table(
  code text, template text, object_name text, serial_number text, recipient_name text, delivery_date date,
  reason text, notes text, quantity integer, declared_value numeric, expected_return_date date, photo_path text,
  confirmed_at timestamptz, returned_at timestamptz, vat_mode text,
  issuer_company text, issuer_vat text, issuer_address text, issuer_city text, issuer_postal_code text,
  issuer_province text, issuer_phone text, issuer_email text, issuer_logo_path text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    r.code, r.template, r.object_name, r.serial_number, r.recipient_name, r.delivery_date,
    r.reason, r.notes, r.quantity, r.declared_value, r.expected_return_date, r.photo_path,
    r.confirmed_at, r.returned_at, r.vat_mode,
    case when r.show_issuer then i.company_name end,
    case when r.show_issuer then i.vat_number end,
    case when r.show_issuer then i.address end,
    case when r.show_issuer then i.city end,
    case when r.show_issuer then i.postal_code end,
    case when r.show_issuer then i.province end,
    case when r.show_issuer then i.phone end,
    case when r.show_issuer then i.email end,
    case when r.show_issuer then i.logo_path end
  from public.digital_receipts r
  left join public.quote_issuer_profiles i on i.user_id = r.user_id
  where r.code = p_code
    and public.public_page_visible(r.user_id, 'digital-receipt')
  limit 1;
$function$;
grant execute on function public.get_digital_receipt_by_code(text) to anon, authenticated, service_role;
