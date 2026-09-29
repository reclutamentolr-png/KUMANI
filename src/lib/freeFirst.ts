// Ordine stabile: prima i servizi gratuiti, poi gli altri, ciascun gruppo
// nell'ordine di partenza. File a parte (senza accesso al database) perché
// lo usano anche componenti che girano nel browser.
export function freeFirst<T>(items: T[], isFree: (item: T) => boolean): T[] {
  return [...items.filter(isFree), ...items.filter((item) => !isFree(item))]
}
