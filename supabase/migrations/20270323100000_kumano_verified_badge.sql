-- Segno «Kumano verificato» accanto al nome, visibile agli altri iscritti.
-- Verificato = identità controllata (codice fiscale o documento approvato
-- dallo Staff) + profilo completo (dati confermati) + account non bloccato.
-- È più semplice dei requisiti di Kordata/Eventi (che chiedono anche
-- abbonamento e 30 giorni): qui conta solo che la persona sia vera.

create or replace function public.kumano_verified(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.profile_completed_at is not null and not coalesce(p.is_blocked, false) from public.profiles p where p.id = p_uid)
    and public.kumano_identity_ok(p_uid),
    false);
$$;
revoke all on function public.kumano_verified(uuid) from public, anon, authenticated;

-- Quali tra gli utenti indicati sono verificati (solo sì/no, nessun altro dato).
create or replace function public.verified_kumani(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct id from unnest(p_ids[1:300]) as id where public.kumano_verified(id);
$$;
revoke all on function public.verified_kumani(uuid[]) from public, anon;
grant execute on function public.verified_kumani(uuid[]) to authenticated;

-- Stato della propria verifica, nella forma della finestra di verifica
-- (abbonamento, anzianità e regole non servono: risultano già a posto).
create or replace function public.my_kumano_verification()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'verified', public.kumano_verified(p.id),
    'subscription', true,
    'account_age', true,
    'terms', true,
    'days_left', 0,
    'profile', p.profile_completed_at is not null,
    'tax_code', public.kumano_identity_ok(p.id),
    'has_tax_code', p.tax_code is not null,
    'blocked', coalesce(p.is_blocked, false),
    'identity_pending', exists (select 1 from public.identity_verifications v where v.user_id = p.id and v.status = 'pending'),
    'identity_rejected_note', (select v.review_note from public.identity_verifications v where v.user_id = p.id order by v.created_at desc limit 1),
    'identity_last_status', (select v.status from public.identity_verifications v where v.user_id = p.id order by v.created_at desc limit 1)
  )
  from public.profiles p where p.id = auth.uid();
$$;
revoke all on function public.my_kumano_verification() from public, anon;
grant execute on function public.my_kumano_verification() to authenticated;
