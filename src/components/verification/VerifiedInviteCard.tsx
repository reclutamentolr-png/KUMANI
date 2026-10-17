'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BadgeCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import VerificationSetup, { type VerificationStatus } from '@/components/verification/VerificationSetup'

// Dashboard: invito a diventare «Kumano verificato» (segno dorato accanto al
// nome che vedono gli altri). Sparisce a verifica fatta; «Più tardi» lo
// nasconde per due settimane su questo dispositivo.
const LATER_KEY = 'kumani_verified_invite_later'
const LATER_MS = 14 * 24 * 60 * 60 * 1000

type Status = VerificationStatus & { verified: boolean }

export default function VerifiedInviteCard() {
  const t = useTranslations('verifiedBadge')
  const [status, setStatus] = useState<Status | null>(null)
  const [open, setOpen] = useState(false)

  const load = () =>
    void Promise.resolve(createClient().rpc('my_kumano_verification')).then(({ data, error }) => {
      if (!error && data) setStatus(data as Status)
    })

  useEffect(() => {
    try {
      if (Date.now() - Number(localStorage.getItem(LATER_KEY) ?? 0) < LATER_MS) return
    } catch {
      // memoria del browser non disponibile: si mostra
    }
    load()
  }, [])

  if (!status || status.verified || status.blocked) return null

  const later = () => {
    setStatus(null)
    try {
      localStorage.setItem(LATER_KEY, String(Date.now()))
    } catch {
      // vale solo per questa visita
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-4 shadow-[0_10px_30px_rgba(23,23,23,0.07)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
          <BadgeCheck className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold text-[var(--ink)]">{t('inviteTitle')}</h2>
          <p className="mt-1 text-sm leading-snug text-gray-600">
            {status.identity_pending ? t('invitePending') : t('inviteText')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white hover:brightness-110"
            >
              <BadgeCheck className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden /> {status.identity_pending ? t('inviteStatus') : t('inviteCta')}
            </button>
            <button type="button" onClick={later} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-[var(--muted)] hover:bg-black/5">
              {t('inviteLater')}
            </button>
          </div>
        </div>
      </div>
      {open && (
        <VerificationSetup
          kind="kumano"
          status={status}
          onClose={() => (setOpen(false), load())}
          onDone={() => (setOpen(false), load())}
        />
      )}
    </section>
  )
}
