-- Foto degli annunci della Bacheca (20/10/2026): caricate dal telefono o dal
-- computer, compresse nel browser (WebP), caricate dal server con la chiave
-- di servizio. Pubbliche come gli annunci; al massimo 2 MB ciascuna.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
