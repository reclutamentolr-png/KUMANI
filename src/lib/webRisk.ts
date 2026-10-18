// Google Web Risk (la versione commerciale di Safe Browsing): dice se Google
// segnala un indirizzo come phishing, virus o software indesiderato. Usato da
// Speculum, controllo QR e CheckMail. Chiave in GOOGLE_WEB_RISK_API_KEY.

export const WEB_RISK_TYPES = ['SOCIAL_ENGINEERING', 'MALWARE', 'UNWANTED_SOFTWARE'] as const
export type WebRiskThreat = (typeof WEB_RISK_TYPES)[number]
export type WebRiskHit = { uri: string; threats: WebRiskThreat[] }

export const WEB_RISK_SOURCE = 'Google Web Risk'
export const WEB_RISK_SOURCE_URL = 'https://transparencyreport.google.com/safe-browsing/search'

// Gli indirizzi segnalati (vuoto = nessuno). null = senza chiave o Google non
// ha risposto a nessuna richiesta: il controllo non si mostra.
export async function webRiskLookup(uris: string[]): Promise<WebRiskHit[] | null> {
  const key = process.env.GOOGLE_WEB_RISK_API_KEY
  const list = [...new Set(uris.filter(Boolean))].slice(0, 12)
  if (!key || !list.length) return null
  let answered = false
  const hits = await Promise.all(
    list.map(async (uri): Promise<WebRiskHit | null> => {
      const params = new URLSearchParams({ uri, key })
      for (const type of WEB_RISK_TYPES) params.append('threatTypes', type)
      try {
        const res = await fetch(`https://webrisk.googleapis.com/v1/uris:search?${params}`, { signal: AbortSignal.timeout(6000), cache: 'no-store' })
        if (!res.ok) return null
        answered = true
        const data = (await res.json()) as { threat?: { threatTypes?: WebRiskThreat[] } }
        const threats = (data.threat?.threatTypes ?? []).filter((t) => (WEB_RISK_TYPES as readonly string[]).includes(t))
        return threats.length ? { uri, threats } : null
      } catch {
        return null
      }
    }),
  )
  return answered ? hits.filter((h): h is WebRiskHit => !!h) : null
}

// Il pericolo più grave tra quelli trovati: phishing, poi virus, poi software indesiderato
export function worstThreat(hits: WebRiskHit[]): WebRiskThreat | null {
  const all = new Set(hits.flatMap((h) => h.threats))
  return WEB_RISK_TYPES.find((t) => all.has(t)) ?? null
}
