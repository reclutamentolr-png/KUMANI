// Scadenza delle carte con cui si pagano i costi fissi (Admin → Costi e
// margini). La carta vale fino all'ultimo giorno del mese indicato: l'avviso
// parte dal primo giorno del mese prima, così c'è il tempo di cambiarla nei
// servizi senza perdere gli abbonamenti.

export type CardCost = { name: string; provider: string | null; payment_card: string | null; card_expiry: string | null; status: string; end_date: string | null }
export type ExpiringCard = { card: string; expiry: string; services: string[]; alertFrom: string; expired: boolean; lastMonth: boolean }

const shiftMonth = (day: string, months: number) => {
  const [y, m] = day.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + months, 1))
  return d.toISOString().slice(0, 10)
}

// Primo giorno da cui avvisare (un mese prima del mese di scadenza)
export const cardAlertFrom = (expiry: string) => shiftMonth(expiry, -1)

// «05/27» per il mese di scadenza
export const expiryLabel = (expiry: string) => `${expiry.slice(5, 7)}/${expiry.slice(2, 4)}`

export function expiringCards(costs: CardCost[], today: string): ExpiringCard[] {
  const groups = new Map<string, ExpiringCard>()
  for (const c of costs) {
    if (!c.payment_card || !c.card_expiry || c.status !== 'active') continue
    if (c.end_date && c.end_date < today) continue
    const expiry = c.card_expiry.slice(0, 10)
    const alertFrom = cardAlertFrom(expiry)
    if (today < alertFrom) continue
    const key = `${c.payment_card.trim().toLowerCase()}|${expiry}`
    const group = groups.get(key) ?? {
      card: c.payment_card.trim(),
      expiry,
      services: [],
      alertFrom,
      expired: today >= shiftMonth(expiry, 1),
      lastMonth: today >= expiry,
    }
    const label = c.provider || c.name
    if (!group.services.includes(label)) group.services.push(label)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => a.expiry.localeCompare(b.expiry))
}
