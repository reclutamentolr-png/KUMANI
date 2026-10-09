-- KUMANI Sorpresa più ricca:
-- - occasione (compleanno, amore, matrimonio, nascita, natale, festa dei
--   genitori, laurea, festa, grazie, generica): sfondo, icona, effetto
--   all'apertura e musica consigliata;
-- - modo di aprire il regalo: scatola, busta-lettera, gratta e scopri;
-- - musica di sottofondo: registrazioni libere da diritti (pubblico dominio o
--   CC0) su Cloudflare R2, oppure un audio caricato da chi crea;
-- - tappe speciali: messaggio, galleria (fino a 6 foto), indovinello (la
--   tappa si apre solo con la risposta giusta, controllata sul server),
--   luogo (link alla mappa), canzone (link a Spotify/YouTube);
-- - ringraziamenti di chi riceve (reazione, messaggio, foto), letti da chi
--   ha regalato.

alter table public.surprise_gifts
  add column if not exists occasion text not null default 'generic',
  add column if not exists reveal_style text not null default 'box',
  add column if not exists music text,
  add column if not exists music_path text;

alter table public.surprise_gifts drop constraint if exists surprise_gifts_occasion_check;
alter table public.surprise_gifts add constraint surprise_gifts_occasion_check
  check (occasion in ('generic', 'birthday', 'love', 'wedding', 'baby', 'christmas', 'parents', 'graduation', 'party', 'thanks'));
alter table public.surprise_gifts drop constraint if exists surprise_gifts_reveal_check;
alter table public.surprise_gifts add constraint surprise_gifts_reveal_check
  check (reveal_style in ('box', 'envelope', 'scratch'));
alter table public.surprise_gifts drop constraint if exists surprise_gifts_music_check;
-- Il Canone di Pachelbel (carillon della prima versione) non c'è più: chi
-- l'aveva scelto passa ad «Air» di Bach
update public.surprise_gifts set music = 'air' where music = 'canon';
alter table public.surprise_gifts add constraint surprise_gifts_music_check
  check (music is null or music in ('birthday', 'radetzky', 'joy', 'pomp', 'danube', 'clair', 'nocturne', 'gymno', 'air', 'lullaby', 'twinkle', 'jingle', 'silentnight', 'own'));

alter table public.surprise_steps
  add column if not exists kind text not null default 'message',
  add column if not exists gallery text[] not null default '{}',
  add column if not exists extra jsonb not null default '{}'::jsonb,
  add column if not exists riddle_answer text,
  add column if not exists solved_at timestamptz;

alter table public.surprise_steps drop constraint if exists surprise_steps_kind_check;
alter table public.surprise_steps add constraint surprise_steps_kind_check
  check (kind in ('message', 'gallery', 'riddle', 'place', 'song'));
alter table public.surprise_steps drop constraint if exists surprise_steps_gallery_check;
alter table public.surprise_steps add constraint surprise_steps_gallery_check check (cardinality(gallery) <= 6);
alter table public.surprise_steps drop constraint if exists surprise_steps_answer_check;
alter table public.surprise_steps add constraint surprise_steps_answer_check check (riddle_answer is null or char_length(riddle_answer) <= 100);

-- «Risolto» lo segna solo il server (risposta giusta di chi riceve)
create or replace function public.surprise_steps_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.solved_at := null;
  else
    new.solved_at := old.solved_at;
  end if;
  return new;
end;
$$;
drop trigger if exists surprise_steps_guard on public.surprise_steps;
create trigger surprise_steps_guard before insert or update on public.surprise_steps
  for each row execute function public.surprise_steps_guard();

-- Ringraziamenti di chi riceve: li scrive solo il server (pagina pubblica),
-- li legge chi ha creato la sorpresa
create table if not exists public.surprise_replies (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.surprise_gifts(id) on delete cascade,
  reaction text check (reaction in ('love', 'joy', 'wow', 'thanks')),
  message text not null default '' check (char_length(message) <= 1000),
  photo_path text,
  created_at timestamptz not null default now()
);
create index if not exists surprise_replies_gift_idx on public.surprise_replies (gift_id, created_at desc);
alter table public.surprise_replies enable row level security;
drop policy if exists surprise_replies_owner_read on public.surprise_replies;
create policy surprise_replies_owner_read on public.surprise_replies for select to authenticated
  using (exists (select 1 from public.surprise_gifts g where g.id = gift_id and g.user_id = (select auth.uid())));
grant select on public.surprise_replies to authenticated;

-- File: anche le foto dei ringraziamenti (cartella dell'autore della
-- sorpresa, caricate dal server)
insert into public.app_limits (key, value, kind, section, label, sort) values
  ('surprise_replies', 20, 'count', 'Sorpresa', 'Ringraziamenti per sorpresa', 152)
on conflict (key) do nothing;
drop trigger if exists app_limit_check on public.surprise_replies;
create trigger app_limit_check before insert on public.surprise_replies
  for each row execute function public.enforce_app_limit('surprise_replies', 'gift_id');
