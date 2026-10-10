-- Preventivi: aliquota IVA. Con «+ IVA» o «IVA inclusa» il preventivo mostra
-- imponibile, IVA e totale, e il pagamento online addebita il totale con
-- l'IVA (prima con «+ IVA» si pagava solo l'imponibile). I preventivi vecchi
-- restano senza aliquota: con «+ IVA» e senza aliquota non si paga online
-- finché il venditore non la sceglie.

alter table public.quotes add column if not exists vat_rate numeric(4,1);
alter table public.quotes drop constraint if exists quotes_vat_rate_check;
alter table public.quotes add constraint quotes_vat_rate_check check (vat_rate is null or vat_rate in (4, 5, 10, 22));

create or replace function public.get_public_quote(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id, 'quote_number', q.quote_number, 'client_name', q.client_name, 'client_email', q.client_email,
      'client_phone', q.client_phone, 'client_address', q.client_address, 'client_city', q.client_city,
      'client_postal_code', q.client_postal_code, 'client_vat', q.client_vat, 'client_pec', q.client_pec,
      'issue_date', q.issue_date, 'valid_until', q.valid_until, 'items', q.items, 'notes', q.notes, 'total', q.total,
      'payment_info', q.payment_info, 'layout', q.layout, 'logo_position', q.logo_position, 'subject', q.subject,
      'intro', q.intro, 'closing', q.closing, 'sections', q.sections, 'show_total', q.show_total, 'vat_mode', q.vat_mode, 'vat_rate', q.vat_rate,
      'signature', q.signature, 'band_style', q.band_style,
      'payment_mode', q.payment_mode, 'deposit_percent', q.deposit_percent, 'accepted_at', q.accepted_at,
      'accepted_by_name', q.accepted_by_name, 'payment_status', q.payment_status, 'paid_amount', q.paid_amount, 'paid_at', q.paid_at
    ),
    'issuer', (
      select jsonb_build_object(
        'company_name', i.company_name, 'vat_number', i.vat_number, 'address', i.address, 'city', i.city,
        'postal_code', i.postal_code, 'province', i.province, 'pec', i.pec, 'email', i.email, 'phone', i.phone, 'logo_path', i.logo_path, 'accent', i.accent
      ) from public.quote_issuer_profiles i where i.user_id = q.user_id
    ),
    'can_charge', exists (select 1 from public.seller_stripe_accounts s where s.user_id = q.user_id and s.charges_enabled)
  )
  from public.quotes q
  where q.public_token = p_token
    and length(p_token) >= 16
    and public.public_page_visible(q.user_id, 'preventivi')
$$;
grant execute on function public.get_public_quote(text) to anon, authenticated, service_role;
