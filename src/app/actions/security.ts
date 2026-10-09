'use server'

import { headers } from 'next/headers'
import { clientIp, logSecurityEvent } from '@/lib/security'

// Accesso fallito (email o password sbagliate), segnalato dalla pagina di
// accesso: finisce nel registro di sicurezza, che apre un avviso quando i
// tentativi dallo stesso IP o sulla stessa email sono troppi. Un freno in
// memoria evita che qualcuno usi questa funzione per riempire il registro.
const recent = new Map<string, number[]>()

export async function reportLoginFailure(email: string): Promise<void> {
  const h = await headers()
  const ip = clientIp(h)
  const key = ip ?? 'unknown'
  const now = Date.now()
  const hits = (recent.get(key) ?? []).filter((t) => now - t < 60_000)
  if (hits.length >= 20) return
  hits.push(now)
  recent.set(key, hits)
  if (recent.size > 5000) recent.clear()

  const clean = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 200) : ''
  await logSecurityEvent({
    kind: 'login_failed',
    ip,
    path: '/login',
    userAgent: h.get('user-agent'),
    detail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? { email: clean } : {},
  })
}
