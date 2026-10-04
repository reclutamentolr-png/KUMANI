-- Recensioni verificate: le scrive solo chi ha davvero acquistato
-- (abbonamento Base/Pro attivo pagato con carta o voucher, oppure il Pass di
-- un servizio pagato con carta), dopo almeno 7 giorni. Le approva lo Staff,
-- ma solo per motivi oggettivi (insulti, dati personali, pubblicità, fuori
-- tema): non si scartano le recensioni perché negative (Codice del Consumo,
-- recensioni dei consumatori). Nessun premio per chi recensisce.
-- subject = 'kumani' (KUMANI in generale) oppure il nome di un servizio.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (subject ~ '^[a-z0-9-]{2,40}$'),
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(title) <= 80),
  body text not null check (char_length(body) between 20 and 600),
  locale text not null check (locale in ('it', 'en', 'fr', 'es', 'pt', 'de', 'ru')),
  -- Nome mostrato: nome e iniziale del cognome ("Marco C.")
  display_name text not null check (char_length(display_name) between 1 and 60),
  -- Cosa ha acquistato: piano Base, Pro o il Pass del servizio
  purchase_label text not null check (purchase_label in ('base', 'pro', 'pass')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text check (reject_reason is null or reject_reason in ('offensive', 'personal_data', 'advertising', 'off_topic', 'not_genuine', 'other')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subject)
);
create index if not exists reviews_public_idx on public.reviews (status, subject, created_at desc);

alter table public.reviews enable row level security;
-- La persona vede e cancella le proprie; scrive solo con submit_review()
drop policy if exists reviews_own_select on public.reviews;
create policy reviews_own_select on public.reviews for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists reviews_own_delete on public.reviews;
create policy reviews_own_delete on public.reviews for delete to authenticated using (user_id = (select auth.uid()));

-- Cosa ha acquistato l'utente che gli permette di recensire l'argomento
-- ('base' | 'pro' | 'pass'), oppure null se non può
create or replace function public.review_purchase_label(p_uid uuid, p_subject text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p record;
  v_paid boolean;
  v_plan text;
  v_required text;
begin
  select subscription_status, subscription_source, subscription_plan, subscription_expires_at, subscription_started_at, deleted_at
    into p from public.profiles where id = p_uid;
  if not found or p.deleted_at is not null then
    return null;
  end if;
  v_plan := coalesce(p.subscription_plan, 'base');
  v_paid := p.subscription_status = 'active'
    and p.subscription_source in ('stripe', 'voucher')
    and (p.subscription_expires_at is null or p.subscription_expires_at > now())
    and coalesce(p.subscription_started_at, now()) <= now() - interval '7 days';

  if p_subject = 'kumani' then
    return case when v_paid then v_plan end;
  end if;

  select required_plan into v_required from public.marketplace_settings where tool_name = p_subject and is_enabled;
  if v_required is null or v_required not in ('base', 'pro') then
    return null;
  end if;
  if v_paid and (v_required = 'base' or v_plan = 'pro') then
    return v_plan;
  end if;
  if exists (
    select 1 from public.tool_passes
    where user_id = p_uid and tool = p_subject and revoked_at is null
      and source = 'stripe' and coalesce(amount_cents, 0) > 0
      and starts_at <= now() - interval '7 days'
  ) then
    return 'pass';
  end if;
  return null;
end;
$$;
revoke all on function public.review_purchase_label(uuid, text) from public, anon, authenticated;

-- Argomenti che l'utente può recensire (KUMANI e i servizi acquistati) e le
-- sue recensioni già scritte, anche se non più acquistabili
create or replace function public.my_review_options()
returns table (subject text, purchase_label text, review jsonb)
language sql
stable
security definer
set search_path = public
as $$
  with subjects as (
    select 'kumani'::text as subject
    union
    select tool_name from public.marketplace_settings where is_enabled and required_plan in ('base', 'pro')
    union
    select r.subject from public.reviews r where r.user_id = auth.uid()
  )
  select s.subject,
         public.review_purchase_label(auth.uid(), s.subject),
         (select jsonb_build_object('id', r.id, 'rating', r.rating, 'title', r.title, 'body', r.body, 'status', r.status,
                                    'reject_reason', r.reject_reason, 'purchase_label', r.purchase_label, 'updated_at', r.updated_at)
            from public.reviews r where r.user_id = auth.uid() and r.subject = s.subject)
  from subjects s
  where auth.uid() is not null
    and (public.review_purchase_label(auth.uid(), s.subject) is not null
         or exists (select 1 from public.reviews r where r.user_id = auth.uid() and r.subject = s.subject));
$$;
revoke all on function public.my_review_options() from public, anon;
grant execute on function public.my_review_options() to authenticated;

-- Scrive o modifica la propria recensione: torna in attesa di approvazione
create or replace function public.submit_review(p_subject text, p_rating int, p_title text, p_body text, p_locale text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_label text;
  v_first text;
  v_last text;
  v_name text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_logged_in';
  end if;
  v_label := public.review_purchase_label(v_uid, p_subject);
  if v_label is null then
    raise exception 'not_eligible';
  end if;
  select nullif(trim(first_name), ''), nullif(trim(last_name), '') into v_first, v_last from public.profiles where id = v_uid;
  v_name := coalesce(initcap(v_first), 'Kumano') || coalesce(' ' || upper(left(v_last, 1)) || '.', '');

  insert into public.reviews (user_id, subject, rating, title, body, locale, display_name, purchase_label, status, consent_at)
  values (v_uid, p_subject, p_rating, nullif(trim(p_title), ''), trim(p_body), p_locale, v_name, v_label, 'pending', now())
  on conflict (user_id, subject) do update
    set rating = excluded.rating,
        title = excluded.title,
        body = excluded.body,
        locale = excluded.locale,
        display_name = excluded.display_name,
        purchase_label = excluded.purchase_label,
        status = 'pending',
        reject_reason = null,
        reviewed_at = null,
        reviewed_by = null,
        consent_at = now(),
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_review(text, int, text, text, text) from public, anon;
grant execute on function public.submit_review(text, int, text, text, text) to authenticated;

-- Recensioni approvate, per tutti (anche senza accesso): prima quelle nella
-- lingua del visitatore, poi le più recenti. Niente id utente.
create or replace function public.list_public_reviews(p_subject text default null, p_locale text default null, p_limit int default 20)
returns table (id uuid, subject text, rating smallint, title text, body text, locale text, display_name text, purchase_label text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.subject, r.rating, r.title, r.body, r.locale, r.display_name, r.purchase_label, r.created_at
  from public.reviews r
  join public.profiles p on p.id = r.user_id and p.deleted_at is null
  where r.status = 'approved' and (p_subject is null or r.subject = p_subject)
  order by (r.locale = coalesce(p_locale, r.locale)) desc, r.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 200);
$$;
revoke all on function public.list_public_reviews(text, text, int) from public;
grant execute on function public.list_public_reviews(text, text, int) to anon, authenticated, service_role;

-- Media e numero delle recensioni approvate (di tutto o di un argomento) e
-- quante per ogni argomento
create or replace function public.public_review_stats(p_subject text default null)
returns table (subject text, reviews int, average numeric)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(r.subject, 'all'), count(*)::int, round(avg(r.rating)::numeric, 1)
  from public.reviews r
  join public.profiles p on p.id = r.user_id and p.deleted_at is null
  where r.status = 'approved' and (p_subject is null or r.subject = p_subject)
  group by grouping sets ((r.subject), ());
$$;
revoke all on function public.public_review_stats(text) from public;
grant execute on function public.public_review_stats(text) to anon, authenticated, service_role;

-- Cancellazione dell'account (GDPR): via anche le recensioni
create or replace function public.reviews_profile_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reviews where user_id = new.id;
  return new;
end;
$$;
revoke all on function public.reviews_profile_deleted_cleanup() from public, anon, authenticated;

drop trigger if exists reviews_profile_deleted_cleanup on public.profiles;
create trigger reviews_profile_deleted_cleanup
  after update of deleted_at on public.profiles
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.reviews_profile_deleted_cleanup();
