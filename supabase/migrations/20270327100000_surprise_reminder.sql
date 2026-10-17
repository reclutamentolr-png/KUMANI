-- Sorprese: promemoria per l'invio. Chi regala sceglie data e ora (e, se
-- vuole, il numero WhatsApp di chi la riceve); a quell'ora riceve una notifica
-- e un'email con il messaggio WhatsApp già pronto (un tocco su «Invia»).
-- Il controllo gira ogni 5 minuti (pg_cron + pg_net chiamano
-- /api/cron/surprise-reminders con il segreto in Vault «kumani_cron_secret»).

alter table public.surprise_gifts add column if not exists remind_at timestamptz;
alter table public.surprise_gifts add column if not exists remind_phone text check (remind_phone is null or remind_phone ~ '^\+[0-9]{6,15}$');
alter table public.surprise_gifts add column if not exists remind_sent_at timestamptz;
create index if not exists surprise_gifts_remind_due on public.surprise_gifts (remind_at) where remind_at is not null and remind_sent_at is null;

-- Come prima, più: il promemoria già inviato lo segna solo il server; chi
-- cambia data e ora lo riarma
create or replace function public.surprise_gifts_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    new.updated_at := now();
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.public_token := null;
    new.paid_at := null;
    new.amount_cents := null;
    new.stripe_session_id := null;
    new.stripe_payment_intent := null;
    new.refunded_at := null;
    new.opened_at := null;
    new.link_opened_at := null;
    new.paid_with := null;
    new.points_spent := null;
    new.plan_credit := null;
    new.remind_sent_at := null;
  else
    new.status := old.status;
    new.public_token := old.public_token;
    new.paid_at := old.paid_at;
    new.amount_cents := old.amount_cents;
    new.stripe_session_id := old.stripe_session_id;
    new.stripe_payment_intent := old.stripe_payment_intent;
    new.refunded_at := old.refunded_at;
    new.opened_at := old.opened_at;
    new.link_opened_at := old.link_opened_at;
    new.paid_with := old.paid_with;
    new.points_spent := old.points_spent;
    new.plan_credit := old.plan_credit;
    new.user_id := old.user_id;
    if new.remind_at is distinct from old.remind_at then
      new.remind_sent_at := null;
    else
      new.remind_sent_at := old.remind_sent_at;
    end if;
    if old.status = 'active' then
      new.kind := old.kind;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create extension if not exists pg_net;

-- Ogni 5 minuti, solo se c'è un promemoria scaduto e non ancora inviato
do $$
begin
  perform cron.unschedule('kumani-surprise-reminders') where exists (select 1 from cron.job where jobname = 'kumani-surprise-reminders');
  perform cron.schedule('kumani-surprise-reminders', '*/5 * * * *', $job$
    select net.http_get(
      url := 'https://kumani.io/api/cron/surprise-reminders',
      headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'kumani_cron_secret')),
      timeout_milliseconds := 30000
    )
    where exists (select 1 from public.surprise_gifts where remind_at <= now() and remind_sent_at is null)
  $job$);
end
$$;
