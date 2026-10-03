-- Notifiche push dello Staff anche a una sola persona (scelta con la ricerca)
alter table public.push_campaigns add column if not exists target_user_id uuid references auth.users(id) on delete set null;
alter table public.push_campaigns drop constraint if exists push_campaigns_audience_check;
alter table public.push_campaigns add constraint push_campaigns_audience_check check (audience in ('all', 'active', 'inactive', 'user'));
