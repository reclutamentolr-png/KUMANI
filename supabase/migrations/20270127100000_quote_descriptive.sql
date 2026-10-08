-- Preventivi: seconda modalità «Descrittivo» (lettera a sezioni con testo,
-- elenchi e importi, come i preventivi scritti a mano in Word) e posizione
-- del logo nel PDF. Le sezioni pronte (Oneri a nostro carico, Condizioni…)
-- si salvano nel profilo azienda e si richiamano in ogni preventivo.

alter table public.quotes add column if not exists layout text not null default 'table';
alter table public.quotes drop constraint if exists quotes_layout_check;
alter table public.quotes add constraint quotes_layout_check check (layout in ('table', 'descriptive'));

alter table public.quotes add column if not exists logo_position text not null default 'left';
alter table public.quotes drop constraint if exists quotes_logo_position_check;
alter table public.quotes add constraint quotes_logo_position_check check (logo_position in ('left', 'center', 'right', 'band'));

alter table public.quotes add column if not exists subject text;
alter table public.quotes add column if not exists intro text;
alter table public.quotes add column if not exists closing text;
-- [{ title, kind: 'text'|'numbered'|'bullets', body, amount (numero o null) }]
alter table public.quotes add column if not exists sections jsonb not null default '[]'::jsonb;
alter table public.quotes add column if not exists show_total boolean not null default true;
alter table public.quotes add column if not exists vat_mode text not null default 'plus';
alter table public.quotes drop constraint if exists quotes_vat_mode_check;
alter table public.quotes add constraint quotes_vat_mode_check check (vat_mode in ('plus', 'included', 'none'));
alter table public.quotes add column if not exists signature boolean not null default true;

-- Sezioni pronte e ultima posizione del logo scelta, nel profilo azienda
alter table public.quote_issuer_profiles add column if not exists quote_presets jsonb not null default '[]'::jsonb;
alter table public.quote_issuer_profiles add column if not exists quote_logo_position text;
