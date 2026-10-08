-- Kumani Garage: anche le moto, e i documenti del veicolo (libretto,
-- assicurazione…) in uno spazio privato.
-- Limiti per persona: 3 auto di proprietà, 3 moto di proprietà, 2 noleggi
-- (auto o moto). I veicoli già presenti restano; i limiti valgono per i
-- nuovi e per i cambi di tipo.

alter table public.garage_vehicles
  add column if not exists vehicle_type text not null default 'car' check (vehicle_type in ('car', 'motorbike'));

-- Documenti del veicolo
create table if not exists public.garage_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('registration', 'insurance', 'other')),
  title text check (title is null or char_length(title) <= 100),
  file_path text not null check (char_length(file_path) <= 300),
  file_name text check (file_name is null or char_length(file_name) <= 160),
  mime_type text check (mime_type is null or char_length(mime_type) <= 80),
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, user_id) references public.garage_vehicles(id, user_id) on delete cascade
);
create index if not exists garage_documents_vehicle_idx on public.garage_documents (vehicle_id, created_at desc);
create index if not exists garage_documents_user_idx on public.garage_documents (user_id, created_at desc);

alter table public.garage_documents enable row level security;
drop policy if exists garage_documents_own on public.garage_documents;
create policy garage_documents_own on public.garage_documents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists garage_documents_plan_insert on public.garage_documents;
create policy garage_documents_plan_insert on public.garage_documents as restrictive for insert to authenticated
  with check (exists (select 1 from public.can_use_tool('garage') x where x.allowed));
drop policy if exists garage_documents_plan_update on public.garage_documents;
create policy garage_documents_plan_update on public.garage_documents as restrictive for update to authenticated
  using (exists (select 1 from public.can_use_tool('garage') x where x.allowed));

-- Limiti per persona (veicoli per tipo, documenti)
create or replace function public.garage_limits_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'garage_vehicles' then
    if new.kind = 'rental' and (select count(*) from public.garage_vehicles where user_id = new.user_id and kind = 'rental' and id <> new.id) >= 2 then
      raise exception 'garage_rentals_limit';
    end if;
    if new.kind = 'owned' and new.vehicle_type = 'car'
       and (select count(*) from public.garage_vehicles where user_id = new.user_id and kind = 'owned' and vehicle_type = 'car' and id <> new.id) >= 3 then
      raise exception 'garage_cars_limit';
    end if;
    if new.kind = 'owned' and new.vehicle_type = 'motorbike'
       and (select count(*) from public.garage_vehicles where user_id = new.user_id and kind = 'owned' and vehicle_type = 'motorbike' and id <> new.id) >= 3 then
      raise exception 'garage_motorbikes_limit';
    end if;
  end if;
  if tg_table_name = 'garage_readings' and (select count(*) from public.garage_readings where user_id = new.user_id) >= 2000 then
    raise exception 'garage_readings_limit';
  end if;
  if tg_table_name = 'garage_deadlines' and (select count(*) from public.garage_deadlines where user_id = new.user_id) >= 200 then
    raise exception 'garage_deadlines_limit';
  end if;
  if tg_table_name = 'garage_expenses' and (select count(*) from public.garage_expenses where user_id = new.user_id) >= 5000 then
    raise exception 'garage_expenses_limit';
  end if;
  if tg_table_name = 'garage_documents' and (select count(*) from public.garage_documents where user_id = new.user_id) >= 100 then
    raise exception 'garage_documents_limit';
  end if;
  return new;
end;
$$;
revoke all on function public.garage_limits_check() from public, anon, authenticated;

-- I limiti dei veicoli valgono anche quando si cambia tipo o proprietà/noleggio
drop trigger if exists garage_vehicles_limit on public.garage_vehicles;
create trigger garage_vehicles_limit before insert or update of kind, vehicle_type on public.garage_vehicles
  for each row execute function public.garage_limits_check();
drop trigger if exists garage_documents_limit on public.garage_documents;
create trigger garage_documents_limit before insert on public.garage_documents for each row execute function public.garage_limits_check();

-- File privati: foto e PDF dei documenti, nella cartella dell'utente
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('garage-files', 'garage-files', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists garage_files_select on storage.objects;
create policy garage_files_select on storage.objects for select to authenticated
  using (bucket_id = 'garage-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists garage_files_insert on storage.objects;
create policy garage_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'garage-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.can_use_tool('garage') x where x.allowed)
  );
drop policy if exists garage_files_delete on storage.objects;
create policy garage_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'garage-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
