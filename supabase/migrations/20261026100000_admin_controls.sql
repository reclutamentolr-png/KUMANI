-- Controllo Admin ↔ servizi.
--
-- 1. QR Code Pro e OfferMaker: le policy restrittive sul piano chiamavano
--    tool_access(), che gli utenti non possono eseguire (revocata in
--    20260928100000_plans_base_pro.sql): ogni salvataggio falliva con
--    "permission denied for function tool_access", anche per chi ha il Pro.
--    can_use_tool() fa lo stesso controllo per l'utente collegato ed è
--    eseguibile dagli utenti.
drop policy if exists "qr_pro_requires_plan_insert" on public.qr_pro_codes;
create policy "qr_pro_requires_plan_insert" on public.qr_pro_codes as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('qr-code-pro') t where t.allowed));
drop policy if exists "qr_pro_requires_plan_update" on public.qr_pro_codes;
create policy "qr_pro_requires_plan_update" on public.qr_pro_codes as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('qr-code-pro') t where t.allowed));
drop policy if exists "offermaker_requires_plan_insert" on public.offermaker_campaigns;
create policy "offermaker_requires_plan_insert" on public.offermaker_campaigns as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('offermaker') t where t.allowed));
drop policy if exists "offermaker_requires_plan_update" on public.offermaker_campaigns;
create policy "offermaker_requires_plan_update" on public.offermaker_campaigns as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('offermaker') t where t.allowed));

-- 2. Events: gli eventi di un organizzatore bloccato dallo Staff spariscono
--    dal calendario (come già per le Kordate).
create or replace function public.event_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.event_card(e) order by e.starts_at), '[]'::jsonb)
  from (
    select ev.* from public.events ev
    join public.profiles p on p.id = ev.organizer_id
    where ev.status = 'published' and coalesce(ev.ends_at, ev.starts_at + interval '3 hours') > now()
      and not coalesce(p.is_blocked, false)
    order by ev.starts_at
    limit 300
  ) e;
$$;

-- 3. Cancellazione account: oltre alle tessere Kumi Card degli eventi, anche
--    le uscite dai viaggi, il nome usato nelle partite Veritas e i controlli
--    QR di SVAT.
create or replace function public.profiles_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.fidelity_members where user_id = new.id;
  delete from public.trip_exits where user_id = new.id;
  update public.veritas_players set nickname = 'Kumano' where user_id = new.id;
  delete from public.svat_qc_reports where user_id = new.id;
  return new;
end;
$$;
