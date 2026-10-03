-- Biglietto da visita KUMANI (Documenti → Doc Personali). Il QR del
-- biglietto apre /c/<codice invito>: nome e cognome del Kumano, i contatti
-- che ha scelto di mostrare e l'invito a iscriversi a KUMANI.
-- Telefono, WhatsApp ed email sono spenti finché il Kumano non li accende.

create table if not exists public.business_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  design text not null default 'A' check (design in ('A', 'B', 'C')),
  show_phone boolean not null default false,
  show_whatsapp boolean not null default false,
  show_email boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.business_cards enable row level security;
revoke all on public.business_cards from anon, authenticated;
grant select, insert, update on public.business_cards to authenticated;

drop policy if exists business_cards_own on public.business_cards;
create policy business_cards_own on public.business_cards
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pagina pubblica del biglietto: solo ciò che il titolare ha scelto di mostrare
create or replace function public.get_business_card(p_code text)
returns table (first_name text, last_name text, referral_code text, phone text, whatsapp text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.first_name::text, p.last_name::text, p.referral_code::text,
         case when c.show_phone then nullif(trim(p.phone), '') end,
         case when c.show_whatsapp then nullif(trim(p.phone), '') end,
         case when c.show_email then nullif(trim(p.email), '') end
  from public.profiles p
  left join public.business_cards c on c.user_id = p.id
  where p.referral_code = upper(trim(p_code))
    and not coalesce(p.is_blocked, false)
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.get_business_card(text) from public;
grant execute on function public.get_business_card(text) to anon, authenticated;
