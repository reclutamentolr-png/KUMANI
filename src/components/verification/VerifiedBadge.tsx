'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Segno «Kumano verificato» accanto al nome degli altri iscritti: identità
// controllata e profilo completo (public.kumano_verified). Il browser chiede
// solo sì/no per gli id che mostra; le risposte restano in memoria per la visita.
const known = new Map<string, boolean>()
const listeners = new Set<() => void>()
let queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null

function flush() {
  timer = null
  const ids = [...queue]
  queue = new Set()
  if (!ids.length) return
  void Promise.resolve(createClient().rpc('verified_kumani', { p_ids: ids })).then(({ data, error }) => {
    // setof uuid: valori semplici oppure righe { verified_kumani: id }
    const rows = (error ? [] : (data ?? [])) as (string | { verified_kumani: string })[]
    const verified = new Set(rows.map((row) => (typeof row === 'string' ? row : row.verified_kumani)))
    for (const id of ids) known.set(id, verified.has(id))
    listeners.forEach((fn) => fn())
  })
}

// Più nomi sulla stessa pagina: una sola richiesta
function request(id: string) {
  if (known.has(id) || queue.has(id)) return
  queue.add(id)
  timer ??= setTimeout(flush, 30)
}

export function useIsVerified(userId: string | null | undefined) {
  const [, rerender] = useState(0)
  useEffect(() => {
    if (!userId) return
    const fn = () => rerender((n) => n + 1)
    listeners.add(fn)
    request(userId)
    return () => {
      listeners.delete(fn)
    }
  }, [userId])
  return !!userId && known.get(userId) === true
}

export default function VerifiedBadge({ userId, className = '' }: { userId: string | null | undefined; className?: string }) {
  const t = useTranslations('verifiedBadge')
  const verified = useIsVerified(userId)
  if (!verified) return null
  return (
    <span title={t('tooltip')} className={`inline-flex shrink-0 items-center align-[-0.15em] text-[var(--gold)] ${className}`}>
      <BadgeCheck className="h-[1.05em] w-[1.05em]" strokeWidth={2.4} aria-hidden />
      <span className="sr-only">{t('label')}</span>
    </span>
  )
}

// Stesso segno quando il sì/no arriva già con i dati (Kordata, Eventi,
// Recensioni, Proposte): nessuna richiesta in più
export function VerifiedMark({ verified, className = '' }: { verified?: boolean | null; className?: string }) {
  const t = useTranslations('verifiedBadge')
  if (!verified) return null
  return (
    <span title={t('tooltip')} className={`inline-flex shrink-0 items-center align-[-0.15em] text-[var(--gold)] ${className}`}>
      <BadgeCheck className="h-[1.05em] w-[1.05em]" strokeWidth={2.4} aria-hidden />
      <span className="sr-only">{t('label')}</span>
    </span>
  )
}
