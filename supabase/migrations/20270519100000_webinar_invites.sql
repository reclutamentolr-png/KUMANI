-- KUMANI Webinar: inviti ai Kumani e videocamera per chi ha la parola.
-- Chi organizza sceglie i Kumani da invitare: ricevono l'avviso (telefono e
-- campanella) con il link e un secondo avviso quando la diretta inizia. Il
-- link per gli esterni resta com'è. Si legge e si scrive solo dal server.
create table if not exists public.webinar_invites (
  webinar_id uuid not null references public.webinars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (webinar_id, user_id)
);
alter table public.webinar_invites enable row level security;

-- Chi ha la parola ora può accendere anche la videocamera (oltre alla voce)
alter table public.webinars add column if not exists speaker_video_track text;
