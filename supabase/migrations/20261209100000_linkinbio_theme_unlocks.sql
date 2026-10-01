-- Link in Bio: ogni tema speciale si sblocca a parte con i KU (prima un
-- unico sblocco apriva tutti e tre). I nuovi sblocchi partono dal costo e
-- dalla disponibilità del vecchio pacchetto, che viene disattivato: chi lo
-- aveva già comprato conserva tutti e tre i temi.
insert into public.ku_unlocks (key, tool, cost_ku, enabled)
select k.key, 'link-in-bio', coalesce(old.cost_ku, 150), coalesce(old.enabled, true)
from (values ('linkinbio_theme_aurora'), ('linkinbio_theme_notte'), ('linkinbio_theme_tramonto')) as k(key)
left join public.ku_unlocks old on old.key = 'linkinbio_premium_themes'
on conflict (key) do nothing;

update public.ku_unlocks set enabled = false where key = 'linkinbio_premium_themes';
