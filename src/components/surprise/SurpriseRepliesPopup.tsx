'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { HandHeart, Heart, LoaderCircle, Mail, PartyPopper, Smile, X, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { markSurpriseRepliesRead } from '@/app/actions/surprise'
import type { Reaction } from '@/lib/surprise'
import type { UnreadReply } from '@/lib/surpriseReplies'

// Dashboard: «Hai ricevuto un ringraziamento» quando chi ha ricevuto una
// sorpresa ha risposto. «Più tardi» lo nasconde fino al prossimo accesso
// (memoria della scheda del browser); «Segna come letto» lo toglie del tutto.
const REACTION_ICON: Record<Reaction, LucideIcon> = { love: Heart, joy: Smile, wow: PartyPopper, thanks: HandHeart }
const laterKey = (id: string) => `kumani_replies_later_${id}`

export default function SurpriseRepliesPopup({ replies, total }: { replies: UnreadReply[]; total: number }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDivElement>(null)
  const latest = replies[0]?.id

  useEffect(() => {
    if (!latest) return
    let later = false
    try {
      later = sessionStorage.getItem(laterKey(latest)) === '1'
    } catch {
      // memoria della scheda non disponibile: si mostra
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la memoria della scheda si legge solo nel browser
    if (!later) setOpen(true)
  }, [latest])

  const closeLater = () => {
    try {
      if (latest) sessionStorage.setItem(laterKey(latest), '1')
    } catch {
      // nulla da fare
    }
    setOpen(false)
  }

  const closeRef = useRef(closeLater)
  useEffect(() => {
    closeRef.current = closeLater
  })
  useEffect(() => {
    if (!open) return
    dialog.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  if (!open || !latest) return null

  const markRead = async () => {
    setBusy(true)
    await markSurpriseRepliesRead()
    setBusy(false)
    setOpen(false)
    // Tornando indietro la dashboard non deve riproporlo
    router.refresh()
  }
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={closeLater}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replies-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl focus:outline-none motion-safe:animate-[fadeIn_0.3s_ease-out] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <Mail className="h-7 w-7" />
          </span>
          <button type="button" onClick={closeLater} aria-label={t('popupLater')} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <h2 id="replies-title" className="mt-3 text-2xl font-bold text-[var(--ink)]">
          {t('popupTitle', { n: total })}
        </h2>
        <ul className="mt-4 space-y-3">
          {replies.map((r) => {
            const Icon = r.reaction ? REACTION_ICON[r.reaction] : HandHeart
            return (
              <li key={r.id} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                  <Icon className="h-4 w-4 shrink-0 text-rose-500" />
                  {t('popupLine', { name: r.recipientName || '—', title: r.giftTitle || t('untitled') })}
                </p>
                {r.reaction && <p className="mt-1 text-xs font-semibold text-rose-600">{t(`reaction_${r.reaction}`)}</p>}
                {r.message && <p className="mt-2 whitespace-pre-wrap text-[15px] italic leading-relaxed text-gray-800">{r.message}</p>}
                {r.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- link firmato temporaneo
                  <img src={r.photoUrl} alt="" className="mt-3 max-h-56 w-full rounded-xl bg-white object-contain" />
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">{when(r.createdAt)}</span>
                  <Link href={`/sorprese/${r.giftId}`} onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white hover:brightness-125">
                    {t('popupOpen')}
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
        {total > replies.length && <p className="mt-3 text-center text-sm text-gray-500">{t('popupMore', { n: total - replies.length })}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={closeLater} className="min-h-11 cursor-pointer rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            {t('popupLater')}
          </button>
          <button type="button" onClick={markRead} disabled={busy} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-rose-500 px-4 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-60">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('popupMarkRead')}
          </button>
        </div>
      </div>
    </div>
  )
}
