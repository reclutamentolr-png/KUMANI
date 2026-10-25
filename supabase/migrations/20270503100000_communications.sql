-- Admin → Comunicazioni: messaggi a tutti gli iscritti preparati in anticipo
-- (notifica push + email), da inviare quando lo Staff decide, con lo storico
-- degli invii. E chi non vuole più ricevere le email di KUMANI (le notifiche
-- push restano se le ha attive). Solo chiave di servizio (Admin e link di
-- disiscrizione firmato): nessuna lettura dal browser.

create table if not exists public.staff_communications (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  -- Notifica push (vuota = solo email)
  push_title text check (char_length(push_title) <= 80),
  push_body text check (char_length(push_body) <= 240),
  push_url text check (push_url is null or push_url ~ '^/[^/]'),
  -- Email ({nome} diventa il nome della persona; vuota = solo push)
  email_subject text check (char_length(email_subject) <= 200),
  email_preheader text check (char_length(email_preheader) <= 200),
  email_body text check (char_length(email_body) <= 20000),
  email_from text not null default 'info@kumani.io',
  note text,
  created_at timestamptz not null default now(),
  push_sent_at timestamptz,
  push_result jsonb,
  email_sent_at timestamptz,
  email_result jsonb,
  sent_by uuid references auth.users(id) on delete set null
);
create index if not exists staff_communications_created_idx on public.staff_communications (created_at desc);
alter table public.staff_communications enable row level security;

create table if not exists public.email_unsubscribes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  unsubscribed_at timestamptz not null default now(),
  -- Da quale comunicazione (se dal link di un'email)
  communication_id uuid references public.staff_communications(id) on delete set null
);
create index if not exists email_unsubscribes_at_idx on public.email_unsubscribes (unsubscribed_at desc);
alter table public.email_unsubscribes enable row level security;

-- Primo messaggio pronto: chiusura del lancio (messaggio 03)
insert into public.staff_communications (title, push_title, push_body, push_url, email_subject, email_preheader, email_body, note)
select
  'Chiusura del lancio e nuove sorprese',
  'Grazie! Le 50 licenze omaggio sono finite 💛',
  'Grazie a tutti voi per il lancio di KUMANI. Presto nuove sorprese: chi è già iscritto le vedrà in anteprima.',
  '/dashboard',
  'Grazie! Il lancio di KUMANI è stato un successo',
  'Le 50 licenze omaggio sono terminate. Ora arrivano le novità: chi è già iscritto le vedrà in anteprima.',
  'Ciao {nome},

le 50 licenze KUMANI Plus omaggio riservate ai primi iscritti sono terminate: il lancio è stato un successo, e il merito è anche tuo.

Desidero ringraziarti personalmente per aver creduto in KUMANI e per aver scelto di partecipare alla nostra fase BETA. KUMANI non nasce come una semplice raccolta di strumenti digitali, ma da un''idea più ampia: un ecosistema che semplifichi la vita di tutti i giorni, protegga dalle truffe online, faccia risparmiare tempo e denaro e offra nuove opportunità alle persone.

Ti invito a esplorare la piattaforma con calma. Non serve usare tutti gli oltre 50 servizi: anche due o tre, scelti in base alle tue esigenze, possono già diventare un aiuto concreto.

IN ARRIVO, PRIMA PER TE
Stiamo preparando nuovi servizi e nuove sorprese. Chi è già iscritto avrà la possibilità di vederli in anteprima, prima di tutti gli altri: ti avviseremo noi, qui e nell''app.

COSA CAMBIA DA OGGI
• L''iscrizione a KUMANI resta aperta e gratuita: puoi invitare amici e familiari.
• I piani Plus e Pro si apriranno il 15 novembre 2026.
• Chi ha ricevuto la licenza omaggio la mantiene per tutto il periodo previsto.

LA TUA OPINIONE CONTA
Questa fase BETA serve a migliorare KUMANI insieme. Idee, suggerimenti e anche critiche costruttive sono preziosi: puoi scriverci in qualsiasi momento dall''app.

Grazie davvero per la fiducia, per il tuo tempo e per essere tra i primi a credere in questo progetto. Questo è soltanto l''inizio.

Un caro saluto,
il team KUMANI

KUMANI – Mani che ti danno una mano.',
  'Messaggio 03 della cartella «messaggi ai Kumani»'
where not exists (select 1 from public.staff_communications where title = 'Chiusura del lancio e nuove sorprese');
