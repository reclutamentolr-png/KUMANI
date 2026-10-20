// Regioni per la Bacheca (annuncio e ricerca). Elenco a scelta per i paesi
// principali, nomi nella lingua del paese; negli altri la regione è libera e
// facoltativa (e non c'è il filtro per regione).
export const LISTING_REGIONS: Record<string, readonly string[]> = {
  IT: [
    'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
    'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
  ],
  CH: [
    'Aargau', 'Appenzell Ausserrhoden', 'Appenzell Innerrhoden', 'Basel-Landschaft', 'Basel-Stadt', 'Bern', 'Fribourg', 'Genève', 'Glarus',
    'Graubünden', 'Jura', 'Luzern', 'Neuchâtel', 'Nidwalden', 'Obwalden', 'Schaffhausen', 'Schwyz', 'Solothurn', 'St. Gallen', 'Thurgau',
    'Ticino', 'Uri', 'Valais', 'Vaud', 'Zug', 'Zürich',
  ],
  ES: [
    'Andalucía', 'Aragón', 'Asturias', 'Canarias', 'Cantabria', 'Castilla-La Mancha', 'Castilla y León', 'Cataluña', 'Ceuta',
    'Comunidad de Madrid', 'Comunidad Valenciana', 'Extremadura', 'Galicia', 'Islas Baleares', 'La Rioja', 'Melilla', 'Navarra',
    'País Vasco', 'Región de Murcia',
  ],
  FR: [
    'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Guadeloupe', 'Guyane',
    'Hauts-de-France', 'Île-de-France', 'La Réunion', 'Martinique', 'Mayotte', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie',
    'Pays de la Loire', "Provence-Alpes-Côte d'Azur",
  ],
  DE: [
    'Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen',
    'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen',
  ],
  AT: ['Burgenland', 'Kärnten', 'Niederösterreich', 'Oberösterreich', 'Salzburg', 'Steiermark', 'Tirol', 'Vorarlberg', 'Wien'],
  PT: ['Açores', 'Alentejo', 'Algarve', 'Área Metropolitana de Lisboa', 'Centro', 'Madeira', 'Norte'],
}

export function regionsOf(country: string | null | undefined): readonly string[] {
  return (country && LISTING_REGIONS[country.toUpperCase()]) || []
}

// Regione ripulita: dall'elenco per i paesi che lo hanno, altrimenti testo
// libero (60 caratteri, prima lettera maiuscola). Vuota → null.
export function cleanListingRegion(country: string | null | undefined, raw: string | null | undefined): string | null {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!text) return null
  const list = regionsOf(country)
  if (list.length) return list.find((r) => r.toLowerCase() === text.toLowerCase()) ?? null
  return text.charAt(0).toUpperCase() + text.slice(1)
}
