-- Data di inizio dell'abbonamento attivo (per il requisito "abbonato da
-- almeno 30 giorni" del capocordata di Convivio). Si imposta da sola quando
-- l'abbonamento diventa attivo e si azzera quando non lo è più; i rinnovi
-- (abbonamento già attivo) non la cambiano.
alter table public.profiles add column if not exists subscription_started_at timestamptz;

-- Abbonamenti già attivi: tutti annuali, quindi inizio = scadenza - 1 anno
-- (se manca la scadenza, la data di iscrizione).
update public.profiles
set subscription_started_at = coalesce(subscription_expires_at - interval '1 year', created_at)
where subscription_status = 'active' and subscription_started_at is null;

create or replace function public.profiles_track_subscription_start()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.subscription_status = 'active' then
    if tg_op = 'INSERT' or old.subscription_status is distinct from 'active' or new.subscription_started_at is null then
      new.subscription_started_at := coalesce(case when tg_op = 'UPDATE' and old.subscription_status = 'active' then old.subscription_started_at end, now());
    end if;
  else
    new.subscription_started_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_track_subscription_start on public.profiles;
create trigger profiles_track_subscription_start
  before insert or update of subscription_status on public.profiles
  for each row execute function public.profiles_track_subscription_start();

-- Requisito del capocordata: abbonamento attivo da almeno 30 giorni (prima
-- era l'iscrizione alla piattaforma). La chiave resta 'account_age' per le
-- pagine già esistenti.
create or replace function public.convivio_leader_checks(p_uid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'account_age', p.subscription_status = 'active' and p.subscription_started_at is not null
                   and p.subscription_started_at <= now() - interval '30 days',
    'subscription', p.subscription_status = 'active' and (p.subscription_expires_at is null or p.subscription_expires_at > now()),
    'profile', p.date_of_birth is not null and p.date_of_birth <> '2000-01-01'
               and nullif(trim(coalesce(p.city, '')), '') is not null
               and nullif(trim(coalesce(p.phone, '')), '') is not null,
    'tax_code', p.tax_code is not null,
    'terms', p.convivio_terms_at is not null,
    'blocked', coalesce(p.is_blocked, false),
    'days_left', case
      when p.subscription_status <> 'active' or p.subscription_started_at is null then 30
      else greatest(0, 30 - floor(extract(epoch from now() - p.subscription_started_at) / 86400)::int)
    end
  )
  from public.profiles p where p.id = p_uid;
$$;
revoke all on function public.convivio_leader_checks(uuid) from public, anon, authenticated;
