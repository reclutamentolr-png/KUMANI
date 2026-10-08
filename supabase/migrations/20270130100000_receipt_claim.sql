-- Ricevute digitali per chi le riceve (anche Free): «Salva tra le mie
-- ricevute» collega la ricevuta al proprio account anche se era stata
-- confermata senza accesso; chi l'ha salvata la vede sempre (anche dopo la
-- fine del piano di chi l'ha emessa). Una ricevuta resta di una sola persona.

create or replace function public.claim_digital_receipt(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_owner uuid;
  v_recipient uuid;
begin
  if auth.uid() is null then
    return 'login';
  end if;
  select r.id, r.user_id, r.recipient_user_id into v_id, v_owner, v_recipient
  from public.digital_receipts r where r.code = p_code;
  if v_id is null then
    return 'missing';
  end if;
  if v_owner = auth.uid() then
    return 'owner';
  end if;
  if v_recipient = auth.uid() then
    return 'saved';
  end if;
  if v_recipient is not null then
    return 'taken';
  end if;
  update public.digital_receipts set recipient_user_id = auth.uid(), updated_at = now()
  where id = v_id and recipient_user_id is null;
  return 'saved';
end;
$$;
revoke all on function public.claim_digital_receipt(text) from public, anon;
grant execute on function public.claim_digital_receipt(text) to authenticated;

-- Pagina pubblica: visibile anche a chi l'ha salvata (sempre), con lo stato
-- del salvataggio per chi la guarda e la data di emissione (per il PDF)
drop function if exists public.get_digital_receipt_by_code(text);
create function public.get_digital_receipt_by_code(p_code text)
returns table(
  code text, template text, object_name text, serial_number text, recipient_name text, delivery_date date,
  reason text, notes text, quantity integer, declared_value numeric, expected_return_date date, photo_path text,
  confirmed_at timestamptz, returned_at timestamptz, vat_mode text,
  issuer_company text, issuer_vat text, issuer_address text, issuer_city text, issuer_postal_code text,
  issuer_province text, issuer_phone text, issuer_email text, issuer_logo_path text,
  created_at timestamptz, saved_by_me boolean, can_save boolean
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
    case when r.show_issuer then i.logo_path end,
    r.created_at,
    auth.uid() is not null and r.recipient_user_id = auth.uid(),
    auth.uid() is not null and r.recipient_user_id is null and r.user_id <> auth.uid()
  from public.digital_receipts r
  left join public.quote_issuer_profiles i on i.user_id = r.user_id
  where r.code = p_code
    and (public.public_page_visible(r.user_id, 'digital-receipt') or (auth.uid() is not null and r.recipient_user_id = auth.uid()))
  limit 1;
$function$;
grant execute on function public.get_digital_receipt_by_code(text) to anon, authenticated, service_role;
