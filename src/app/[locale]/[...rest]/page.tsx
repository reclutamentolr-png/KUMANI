import { after } from 'next/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { clientIp, recordSecurityEvent } from '@/lib/securityCore'

// Qualsiasi indirizzo inesistente sotto una lingua mostra la 404 tradotta
// di [locale]/not-found.tsx invece di quella generica di Next. Si annota nel
// registro di sicurezza: tante pagine inesistenti dallo stesso IP vogliono
// dire che qualcuno sta esplorando il sito (Admin → Sicurezza).
export default async function CatchAllNotFound({ params }: { params: Promise<{ locale: string; rest: string[] }> }) {
  const [{ locale, rest }, h] = await Promise.all([params, headers()])
  const ip = clientIp(h)
  const userAgent = h.get('user-agent')
  after(() => recordSecurityEvent({ kind: 'not_found', ip, path: `/${locale}/${rest.join('/')}`, userAgent }))
  notFound()
}
