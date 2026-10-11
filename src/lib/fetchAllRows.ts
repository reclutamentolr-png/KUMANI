// Il database restituisce al massimo 1000 righe per richiesta: per gli
// elenchi che possono superarle (spese di Spendly, rilevazioni del Garage…)
// si leggono a pagine fino alla fine. La query deve avere un ordine stabile
// (ultimo criterio: id) e ricevere qui l'intervallo con .range(from, to).
const PAGE = 1000

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  max = 20000
): Promise<{ data: T[]; error: { message: string } | null }> {
  const rows: T[] = []
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return { data: rows, error: null }
}
