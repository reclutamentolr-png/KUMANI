-- Foto del profilo: al posto dell'iniziale del nome in alto e, se lo si
-- sceglie, nella pagina «privato» del Link in Bio. Si carica e si toglie solo
-- dal server (chiave di servizio), senza la richiesta di cambio dati.
alter table public.profiles add column if not exists avatar_path text;
alter table public.link_in_bio add column if not exists show_photo boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
