-- Kordata in vetrina in homepage: il capocordata o il fornitore KUMANI
-- confermato chiedono di mostrare il lotto ai visitatori; lo Staff approva.
-- In homepage al massimo 3 lotti, solo se ancora aperti e sotto il minimo.
-- In più: una foto per il lotto (anche nella pagina del lotto).

alter table public.convivio_groups
  add column if not exists photo_path text check (photo_path is null or char_length(photo_path) <= 300),
  add column if not exists showcase_status text not null default 'none'
    check (showcase_status in ('none', 'requested', 'approved', 'rejected', 'removed')),
  add column if not exists showcase_requested_at timestamptz,
  add column if not exists showcase_requested_by uuid references auth.users(id) on delete set null,
  add column if not exists showcase_reviewed_at timestamptz,
  add column if not exists showcase_reason text check (showcase_reason is null or char_length(showcase_reason) <= 300);
create index if not exists convivio_groups_showcase_idx on public.convivio_groups (showcase_status, showcase_reviewed_at desc);

-- Foto dei lotti (pubbliche, max 2 MB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('convivio-photos', 'convivio-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Può gestire foto e vetrina: il capocordata o il fornitore KUMANI confermato
create or replace function public.convivio_can_manage(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.convivio_groups g
    where g.id = p_group
      and auth.uid() is not null
      and (g.leader_id = auth.uid() or (g.supplier_id = auth.uid() and g.supplier_status = 'confirmed'))
  );
$$;
revoke all on function public.convivio_can_manage(uuid) from public, anon;
grant execute on function public.convivio_can_manage(uuid) to authenticated;

-- Lotto adatto alla vetrina: aperto, non scaduto, sotto il minimo, con
-- fornitore KUMANI confermato, capocordata non bloccato
create or replace function public.convivio_showcase_eligible(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.convivio_groups g
    where g.id = p_group
      and public.convivio_status(g.id) = 'open'
      and g.supplier_id is not null and g.supplier_status = 'confirmed'
      and public.convivio_people(g.id) < g.min_participants
      and not public.is_user_blocked(g.leader_id)
  );
$$;
revoke all on function public.convivio_showcase_eligible(uuid) from public, anon, authenticated;

-- Richiesta (o nuova richiesta dopo un rifiuto/ritiro)
create or replace function public.convivio_request_showcase(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  perform public.tool_require_online('convivio');
  if not public.convivio_can_manage(p_group) then
    raise exception 'not_allowed';
  end if;
  if not public.convivio_showcase_eligible(p_group) then
    raise exception 'not_eligible';
  end if;
  select showcase_status into v_status from public.convivio_groups where id = p_group;
  if v_status in ('requested', 'approved') then
    return v_status;
  end if;
  update public.convivio_groups
  set showcase_status = 'requested', showcase_requested_at = now(), showcase_requested_by = auth.uid(),
      showcase_reviewed_at = null, showcase_reason = null
  where id = p_group;
  return 'requested';
end;
$$;
revoke all on function public.convivio_request_showcase(uuid) from public, anon;
grant execute on function public.convivio_request_showcase(uuid) to authenticated;

-- Ritiro dalla vetrina da parte di chi gestisce il lotto
create or replace function public.convivio_cancel_showcase(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.convivio_can_manage(p_group) then
    raise exception 'not_allowed';
  end if;
  update public.convivio_groups
  set showcase_status = 'none', showcase_reason = null
  where id = p_group and showcase_status in ('requested', 'approved');
end;
$$;
revoke all on function public.convivio_cancel_showcase(uuid) from public, anon;
grant execute on function public.convivio_cancel_showcase(uuid) to authenticated;

-- Foto del lotto: il file è già nel bucket (caricato dal server nella
-- cartella di chi gestisce il lotto); qui si collega o si toglie (null).
-- Restituisce il percorso precedente, che il server poi cancella.
create or replace function public.convivio_set_photo(p_group uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  perform public.tool_require_online('convivio');
  if not public.convivio_can_manage(p_group) then
    raise exception 'not_allowed';
  end if;
  if p_path is not null and (p_path not like auth.uid()::text || '/%' or char_length(p_path) > 300) then
    raise exception 'bad_path';
  end if;
  select photo_path into v_old from public.convivio_groups where id = p_group for update;
  update public.convivio_groups set photo_path = p_path where id = p_group;
  return v_old;
end;
$$;
revoke all on function public.convivio_set_photo(uuid, text) from public, anon;
grant execute on function public.convivio_set_photo(uuid, text) to authenticated;

-- Stato della vetrina per la pagina del lotto (solo chi lo gestisce)
create or replace function public.convivio_showcase_info(p_group uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'can_manage', public.convivio_can_manage(g.id),
    'eligible', public.convivio_showcase_eligible(g.id),
    'status', g.showcase_status,
    'reason', g.showcase_reason,
    'photo_path', g.photo_path
  )
  from public.convivio_groups g
  where g.id = p_group and public.convivio_can_manage(g.id);
$$;
revoke all on function public.convivio_showcase_info(uuid) from public, anon;
grant execute on function public.convivio_showcase_info(uuid) to authenticated;

-- Foto del lotto per tutti quelli che vedono il lotto (anche la pagina pubblica)
create or replace function public.convivio_photo(p_group uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select photo_path from public.convivio_groups where id = p_group;
$$;
grant execute on function public.convivio_photo(uuid) to anon, authenticated;

-- Vetrina pubblica in homepage: i lotti approvati ancora adatti, i più recenti
-- approvati per primi, al massimo 3. Nessun dato dei partecipanti, solo il
-- conteggio; del capocordata solo il nome.
create or replace function public.convivio_showcase_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(card order by reviewed desc), '[]'::jsonb)
  from (
    select public.convivio_card(g.id, null)
             - 'is_leader' - 'is_supplier' - 'my_quantity' - 'supplier_status' - 'supplier_is_leader'
             || jsonb_build_object('photo_path', g.photo_path,
                                   'vat_valid', coalesce(s.vat_status = 'valid', false)) as card,
           g.showcase_reviewed_at as reviewed
    from public.convivio_groups g
    left join public.convivio_suppliers s on s.user_id = g.supplier_id
    where g.showcase_status = 'approved'
      and public.convivio_showcase_eligible(g.id)
      and public.tool_online('convivio')
    order by g.showcase_reviewed_at desc
    limit 3
  ) x;
$$;
grant execute on function public.convivio_showcase_list() to anon, authenticated;

-- Admin → Kordata → Vetrina: richieste e lotti in vetrina (solo server)
create or replace function public.convivio_showcase_admin_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row order by (row->>'showcase_status') = 'requested' desc, row->>'showcase_requested_at' desc), '[]'::jsonb)
  from (
    select public.convivio_card(g.id, null) || jsonb_build_object(
             'showcase_status', g.showcase_status,
             'showcase_reason', g.showcase_reason,
             'showcase_requested_at', g.showcase_requested_at,
             'showcase_reviewed_at', g.showcase_reviewed_at,
             'eligible', public.convivio_showcase_eligible(g.id),
             'photo_path', g.photo_path,
             'description', g.description,
             'leader_id', g.leader_id,
             'supplier_id', g.supplier_id,
             'leader_email', p.email,
             'leader_full_name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
             'requested_by_supplier', g.showcase_requested_by is not null and g.showcase_requested_by = g.supplier_id and g.supplier_id <> g.leader_id
           ) as row
    from public.convivio_groups g
    join public.profiles p on p.id = g.leader_id
    where g.showcase_status <> 'none'
    order by g.showcase_requested_at desc nulls last
    limit 200
  ) x;
$$;
revoke all on function public.convivio_showcase_admin_list() from public, anon, authenticated;
grant execute on function public.convivio_showcase_admin_list() to service_role;
