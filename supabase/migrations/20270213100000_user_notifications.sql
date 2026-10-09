-- Centro avvisi: ogni notifica (le stesse delle notifiche push) resta anche
-- nell'app, nella campanella in alto e in «Novità per te» in dashboard,
-- anche per chi non ha attivato le notifiche sul telefono.
-- I testi sono salvati già pronti in tutte le lingue (texts: { it: { title,
-- body, url }, en: … }), così si leggono nella lingua scelta in quel momento.
-- Li scrive solo il server; chi li riceve li legge e li segna letti.
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('network', 'expiry', 'events', 'staff', 'messages')),
  kind text,
  texts jsonb not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists user_notifications_user_idx on public.user_notifications (user_id, created_at desc);
create index if not exists user_notifications_unread_idx on public.user_notifications (user_id) where read_at is null;

alter table public.user_notifications enable row level security;
drop policy if exists user_notifications_own_read on public.user_notifications;
create policy user_notifications_own_read on public.user_notifications for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.user_notifications to authenticated;

-- Segna letti i propri avvisi (tutti, o quelli indicati)
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language sql
security definer
set search_path = public
as $$
  with updated as (
    update public.user_notifications
    set read_at = now()
    where user_id = auth.uid() and read_at is null and (p_ids is null or id = any(p_ids))
    returning 1
  )
  select count(*)::integer from updated;
$$;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- Pulizia: gli avvisi più vecchi di 90 giorni si cancellano da soli
create or replace function public.user_notifications_cleanup()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_notifications where created_at < now() - interval '90 days';
$$;
revoke all on function public.user_notifications_cleanup() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'kumani-notifications-cleanup';
  perform cron.schedule('kumani-notifications-cleanup', '40 3 * * *', 'select public.user_notifications_cleanup()');
end;
$$;
