-- Controllo di sicurezza, giro 1 (doc/controllo-sicurezza-giro-1.md).
--
-- 3) Le vecchie regole del database davano a QUALSIASI membro dello Staff
--    (una riga in admin_users, con qualunque ruolo) la scrittura diretta di
--    system_settings e marketplace_settings e la modifica dei profili altrui,
--    saltando i permessi del ruolo e i controlli del pannello. Il pannello
--    scrive sempre con la chiave di servizio: le regole e i permessi di
--    scrittura dal browser si tolgono. Le proposte della community si
--    gestiscono solo con il permesso listings.write (come nel pannello).
-- 5) Un codice Pass creato da uno Staff con permessi limitati non si attiva
--    sul suo stesso account (come i voucher dello Staff).
-- 7) Una Landing Page sospesa dallo Staff non si può cancellare e ricreare
--    per tornare online (e cancellare le segnalazioni).

-- Permesso di un ruolo dello Staff, la stessa regola di verifyAdmin:
-- profiles.is_admin, oppure un ruolo con quel permesso o con '*'.
create or replace function public.admin_has_permission(p_uid uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_uid and is_admin)
      or exists (
        select 1 from public.admin_users u join public.admin_roles r on r.id = u.role_id
        where u.user_id = p_uid and (r.permissions ? '*' or r.permissions ? p_perm)
      );
$$;
revoke all on function public.admin_has_permission(uuid, text) from public, anon, authenticated;

-- 3) Scrittura diretta delle impostazioni e dei profili altrui da parte dello Staff
drop policy if exists admin_manage_system_settings on public.system_settings;
drop policy if exists admin_manage_marketplace_settings on public.marketplace_settings;
drop policy if exists admin_can_update_profiles on public.profiles;
revoke insert, update, delete, truncate on public.system_settings from anon, authenticated;
revoke insert, update, delete, truncate on public.marketplace_settings from anon, authenticated;

create or replace function public.proposal_staff_set(p_id uuid, p_status text, p_reply text, p_note text)
returns table(author_id uuid, title text, old_status text, new_status text, rewarded_ku integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  p record;
  v_ku integer := 0;
begin
  if not public.admin_has_permission(auth.uid(), 'listings.write') then raise exception 'not_staff'; end if;
  if p_status not in ('changes', 'rejected', 'open', 'review', 'planned', 'done', 'declined') then raise exception 'invalid'; end if;
  select * into p from public.community_proposals where id = p_id for update;
  if p.id is null then raise exception 'not_found'; end if;

  update public.community_proposals
     set status = p_status,
         staff_reply = case when p_reply is null then staff_reply else left(nullif(trim(p_reply), ''), 1000) end,
         staff_note = case when p_status in ('changes', 'rejected') then left(nullif(trim(p_note), ''), 300) else null end,
         published_at = case when published_at is null and p_status in ('open', 'review', 'planned', 'done', 'declined') then now() else published_at end,
         status_changed_at = case when status is distinct from p_status then now() else status_changed_at end,
         updated_at = now()
   where id = p_id;

  if p_status = 'done' and not p.rewarded and p.author_id is not null then
    v_ku := coalesce(public.ku_points_for('proposal_done'), 0);
    if v_ku > 0 then
      update public.profiles set daily_points = coalesce(daily_points, 0) + v_ku, ku_earned_total = coalesce(ku_earned_total, 0) + v_ku where id = p.author_id;
    end if;
    update public.community_proposals set rewarded = true where id = p_id;
  end if;

  return query select p.author_id, p.title, p.status, p_status, v_ku;
end;
$$;

-- 5) Codice Pass attivato da chi l'ha creato: solo un amministratore completo
create or replace function public.redeem_tool_pass_code(p_code text)
returns table(success boolean, reason text, tool text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row public.tool_pass_codes%rowtype;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated', null::text, null::timestamptz;
    return;
  end if;
  select * into v_row from public.tool_pass_codes where code = upper(trim(p_code)) for update;
  if not found then
    return query select false, 'not_found', null::text, null::timestamptz;
    return;
  end if;
  if v_row.redeemed_at is not null then
    return query select false, 'already_used', v_row.tool, null::timestamptz;
    return;
  end if;
  if v_row.created_by = auth.uid() and not public.admin_has_permission(auth.uid(), '*') then
    return query select false, 'self_redemption', v_row.tool, null::timestamptz;
    return;
  end if;
  if not exists (select 1 from public.marketplace_settings s where s.tool_name = v_row.tool) then
    return query select false, 'unknown_tool', v_row.tool, null::timestamptz;
    return;
  end if;
  update public.tool_pass_codes set redeemed_by = auth.uid(), redeemed_at = now() where code = v_row.code;
  -- Il coupon nel Wallet di chi l'aveva ricevuto risulta usato
  update public.wallet_coupons set redeemed_at = now() where code = v_row.code and redeemed_at is null;
  v_expires := public.grant_tool_pass(auth.uid(), v_row.tool, v_row.days, 'code', null, null, 0, v_row.code);
  return query select true, null::text, v_row.tool, v_expires;
end;
$$;
revoke all on function public.redeem_tool_pass_code(text) from public, anon;
grant execute on function public.redeem_tool_pass_code(text) to authenticated;

-- 7) Landing Page sospesa: il titolare non la cancella (lo Staff sì, col pannello)
drop policy if exists landing_pages_own_delete on public.landing_pages;
create policy landing_pages_own_delete on public.landing_pages
  for delete to authenticated
  using (owner_id = (select auth.uid()) and suspended = false);
revoke delete on public.landing_pages from anon;
