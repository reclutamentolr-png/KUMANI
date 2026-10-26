-- Landing Page: «Fatti trovare su Google» (search_visible) era stato aggiunto
-- senza il permesso di scriverlo, e la tabella dà i permessi colonna per
-- colonna: ogni salvataggio finiva in «permission denied for table
-- landing_pages» e nessuno poteva creare o aggiornare la pagina.
grant insert (search_visible), update (search_visible) on public.landing_pages to authenticated;
