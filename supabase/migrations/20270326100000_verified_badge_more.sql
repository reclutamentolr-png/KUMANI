-- Segno «Kumano verificato» anche in Kordata (capocordata), Eventi
-- (organizzatore), Recensioni e Proposte (autore): le funzioni che danno questi
-- dati restituiscono in più solo sì/no (public.kumano_verified).
-- Recensioni e Proposte cambiano le colonne restituite: si ricreano con gli
-- stessi permessi di prima.

CREATE OR REPLACE FUNCTION public.convivio_card(p_group uuid, p_uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'category', g.category,
    'city', g.city,
    'supplier_name', coalesce(s.business_name, g.supplier_name),
    'supplier_kumani', g.supplier_id is not null,
    'supplier_status', g.supplier_status,
    'supplier_is_leader', g.supplier_id = g.leader_id,
    'supplier_rating', case when g.supplier_id is not null then public.convivio_rating(g.supplier_id) end,
    'unit_label', g.unit_label,
    'retail_price', g.retail_price,
    'group_price', g.group_price,
    'min_participants', g.min_participants,
    'max_participants', g.max_participants,
    'expires_at', g.expires_at,
    'status', public.convivio_status(g.id),
    'people', public.convivio_people(g.id),
    'quantity', (select coalesce(sum(quantity), 0) from public.convivio_pledges where group_id = g.id),
    'leader_name', p.first_name,
    'leader_verified', public.kumano_verified(g.leader_id),
    'leader_rating', public.convivio_rating(g.leader_id),
    'is_leader', g.leader_id = p_uid,
    'is_supplier', g.supplier_id = p_uid,
    'my_quantity', (select quantity from public.convivio_pledges where group_id = g.id and user_id = p_uid)
  )
  from public.convivio_groups g
  join public.profiles p on p.id = g.leader_id
  left join public.convivio_suppliers s on s.user_id = g.supplier_id
  where g.id = p_group;
$function$;

CREATE OR REPLACE FUNCTION public.event_card(p_event events)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'id', p_event.id,
    'title', p_event.title,
    'description', p_event.description,
    'type', p_event.type,
    'mode', p_event.mode,
    'starts_at', p_event.starts_at,
    'ends_at', p_event.ends_at,
    'timezone', p_event.timezone,
    'venue_name', p_event.venue_name,
    'city', p_event.city,
    'country_code', p_event.country_code,
    'languages', to_jsonb(p_event.languages),
    'capacity', p_event.capacity,
    'people', public.event_people(p_event.id),
    'waitlist', (select count(*) from public.event_participants w where w.event_id = p_event.id and w.status = 'waitlist'),
    'price', p_event.price,
    'currency', p_event.currency,
    'is_18plus', p_event.is_18plus,
    'kids_friendly', p_event.kids_friendly,
    'status', p_event.status,
    'ended', public.event_end(p_event) < now(),
    'organizer_name', (select coalesce(nullif(trim(first_name), ''), '—') from public.profiles where id = p_event.organizer_id),
    'organizer_verified', public.kumano_verified(p_event.organizer_id),
    'organizer_referral', (select referral_code from public.profiles where id = p_event.organizer_id),
    'organizer_trusted', public.event_organizer_trusted(p_event.organizer_id),
    'organizer_level', public.event_organizer_level(p_event.organizer_id),
    'organizer_rating', (select round(avg(r.rating)::numeric, 1) from public.event_reviews r where r.organizer_id = p_event.organizer_id),
    'organizer_reviews', (select count(*) from public.event_reviews r where r.organizer_id = p_event.organizer_id),
    'series_id', p_event.series_id,
    'fidelity_stamp', p_event.fidelity_stamp,
    'fidelity_business', case when p_event.fidelity_stamp
      then (select c.business_name from public.event_fidelity_card(p_event.organizer_id) c) end
  );
$function$;

drop function if exists public.list_public_reviews(text, text, integer);
CREATE OR REPLACE FUNCTION public.list_public_reviews(p_subject text DEFAULT NULL::text, p_locale text DEFAULT NULL::text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, subject text, rating smallint, title text, body text, locale text, display_name text, purchase_label text, created_at timestamp with time zone, author_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.subject, r.rating, r.title, r.body, r.locale, r.display_name, r.purchase_label, r.created_at, public.kumano_verified(r.user_id)
  from public.reviews r
  join public.profiles p on p.id = r.user_id and p.deleted_at is null
  where r.status = 'approved' and (p_subject is null or r.subject = p_subject)
  order by (r.locale = coalesce(p_locale, r.locale)) desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 200);
$function$;
revoke all on function public.list_public_reviews(text, text, integer) from public;
grant execute on function public.list_public_reviews(text, text, integer) to anon, authenticated, service_role;

drop function if exists public.proposals_feed(text, boolean, integer);
CREATE OR REPLACE FUNCTION public.proposals_feed(p_sort text DEFAULT 'top'::text, p_mine boolean DEFAULT false, p_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, title text, body text, topic text, tool_name text, status text, votes_count integer, staff_reply text, staff_note text, created_at timestamp with time zone, published_at timestamp with time zone, status_changed_at timestamp with time zone, author_name text, is_mine boolean, my_vote boolean, author_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.title, p.body, p.topic, p.tool_name, p.status, p.votes_count,
         p.staff_reply, case when p.author_id = auth.uid() then p.staff_note end, p.created_at, p.published_at, p.status_changed_at,
         public.proposal_author_name(p.author_id), p.author_id = auth.uid(),
         exists (select 1 from public.community_proposal_votes v where v.proposal_id = p.id and v.user_id = auth.uid()),
         public.kumano_verified(p.author_id)
  from public.community_proposals p
  where auth.uid() is not null and p.area = 'kumani'
    and (case when p_mine then p.author_id = auth.uid()
              when p_sort = 'done' then p.status = 'done'
              else p.status in ('open', 'review', 'planned') end)
  order by
    case when p_sort = 'top' and not p_mine then p.votes_count end desc nulls last,
    coalesce(p.published_at, p.created_at) desc
  limit least(greatest(p_limit, 1), 200);
$function$;
revoke all on function public.proposals_feed(text, boolean, integer) from public;
grant execute on function public.proposals_feed(text, boolean, integer) to authenticated, service_role;

drop function if exists public.proposal_get(uuid);
CREATE OR REPLACE FUNCTION public.proposal_get(p_id uuid)
 RETURNS TABLE(id uuid, title text, body text, topic text, tool_name text, status text, votes_count integer, staff_reply text, staff_note text, created_at timestamp with time zone, published_at timestamp with time zone, status_changed_at timestamp with time zone, author_name text, is_mine boolean, my_vote boolean, my_report boolean, author_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.id, p.title, p.body, p.topic, p.tool_name, p.status, p.votes_count,
         p.staff_reply, case when p.author_id = auth.uid() then p.staff_note end, p.created_at, p.published_at, p.status_changed_at,
         public.proposal_author_name(p.author_id), p.author_id = auth.uid(),
         exists (select 1 from public.community_proposal_votes v where v.proposal_id = p.id and v.user_id = auth.uid()),
         exists (select 1 from public.community_proposal_reports r where r.proposal_id = p.id and r.user_id = auth.uid()),
         public.kumano_verified(p.author_id)
  from public.community_proposals p
  where p.id = p_id and auth.uid() is not null
    and (p.status in ('open', 'review', 'planned', 'done', 'declined') or p.author_id = auth.uid());
$function$;
revoke all on function public.proposal_get(uuid) from public;
grant execute on function public.proposal_get(uuid) to authenticated, service_role;
