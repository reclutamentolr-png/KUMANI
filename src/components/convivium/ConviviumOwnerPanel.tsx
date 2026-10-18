'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, ExternalLink, MessageCircle, MessageSquareText, Pencil, Share2, Trash2, X } from 'lucide-react'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import { deleteConvivium, removeConviviumRsvp, setConviviumCancelled } from '@/app/actions/convivium'
import ConviviumForm from '@/components/convivium/ConviviumForm'
import type { ConviviumAnswer, ConviviumEvent, ConviviumRsvp } from '@/lib/convivium'

const ANSWER_STYLE: Record<ConviviumAnswer, string> = {
  yes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  maybe: 'bg-amber-50 text-amber-800 border-amber-200',
  no: 'bg-gray-50 text-gray-600 border-gray-200',
}

// Scheda di chi organizza: link da mandare, chi ha risposto, modifica,
// annulla ed elimina
export default function ConviviumOwnerPanel({ event, rsvps, hostName, inviteUrl, shareText }: { event: ConviviumEvent; rsvps: ConviviumRsvp[]; hostName: string | null; inviteUrl: string; shareText: string }) {
  const t = useTranslations('convivium')
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState<'link' | 'message' | null>(null)
  const [pending, start] = useTransition()
  const cancelled = !!event.cancelled_at
  const message = `${shareText} ${inviteUrl}`

  // «Copia link» copia solo l'indirizzo; «Copia messaggio» il testo pronto
  // con il link (per liste broadcast e gruppi WhatsApp)
  const copy = async (what: 'link' | 'message') => {
    const text = what === 'link' ? inviteUrl : message
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      window.prompt(what === 'link' ? t('copy') : t('copyMessage'), text)
    }
  }
  const shareMore = async () => {
    if (navigator.share) await navigator.share({ text: shareText, url: inviteUrl }).catch(() => {})
    else copy('link')
  }
  const run = (fn: () => Promise<unknown>) => start(async () => {
    await fn()
    router.refresh()
  })

  const groups = (['yes', 'maybe', 'no'] as const).map((answer) => ({ answer, list: rsvps.filter((r) => r.answer === answer) }))

  if (editing) {
    return (
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
        <ConviviumForm event={event} onDone={() => setEditing(false)} />
      </section>
    )
  }

  return (
    <div className="space-y-6">
      {!cancelled && (
        <section className="rounded-2xl bg-[var(--ink)] p-5 text-white shadow-sm sm:p-6">
          <h2 className="text-lg font-extrabold">{t('shareTitle')}</h2>
          <p className="mt-1 text-sm text-white/70">{t('shareHint')}</p>
          <p className="mt-4 break-all rounded-xl bg-white/10 px-3.5 py-2.5 font-mono text-sm text-[var(--gold-bright)]">{inviteUrl}</p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"
            >
              <MessageCircle className="h-4 w-4" aria-hidden /> {t('whatsapp')}
            </a>
            <button type="button" onClick={() => copy('link')} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20">
              {copied === 'link' ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied === 'link' ? t('copied') : t('copy')}
            </button>
            <button type="button" onClick={() => copy('message')} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20">
              {copied === 'message' ? <Check className="h-4 w-4" aria-hidden /> : <MessageSquareText className="h-4 w-4" aria-hidden />} {copied === 'message' ? t('copiedMessage') : t('copyMessage')}
            </button>
            <button type="button" onClick={shareMore} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20">
              <Share2 className="h-4 w-4" aria-hidden /> {t('shareMore')}
            </button>
            <a href={inviteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold text-white/70 hover:text-white">
              <ExternalLink className="h-4 w-4" aria-hidden /> {t('openInvite')}
            </a>
          </div>
          <p className="mt-4 text-xs text-white/60">{t('broadcastHint')}</p>
          <p className="mt-1.5 text-xs text-white/60">{t('reminderNote')}</p>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('answersTitle')}</h2>
        {rsvps.length === 0 && !event.host_joins ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{t('noAnswers')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {groups.map(({ answer, list }) =>
              list.length || (answer === 'yes' && event.host_joins) ? (
                <div key={answer}>
                  <p className="mb-2 text-sm font-bold text-[var(--ink)]">
                    {t(`answer_${answer}`)} · {list.length + (answer === 'yes' && event.host_joins ? 1 : 0)}
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {/* Chi organizza, se partecipa: primo al tavolo, non si toglie da qui (si cambia con Modifica) */}
                    {answer === 'yes' && event.host_joins && (
                      <li className="flex items-center gap-1.5 rounded-full border border-[var(--gold)]/60 bg-[var(--gold)]/15 px-3 py-1 text-sm font-bold text-[var(--ink)]">
                        {hostName ? t('youNamed', { name: hostName }) : t('you')} <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--gold)]">· {t('hostTag')}</span>
                      </li>
                    )}
                    {list.map((r) => (
                      <li key={r.id} className={`flex items-center gap-1.5 rounded-full border py-1 pl-3 pr-1.5 text-sm font-semibold ${ANSWER_STYLE[answer]}`}>
                        {r.name}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => window.confirm(t('removeConfirm', { name: r.name })) && run(() => removeConviviumRsvp(r.id))}
                          className="rounded-full p-0.5 opacity-60 hover:opacity-100"
                          aria-label={t('remove')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2.5">
        {!cancelled && (
          <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
            <Pencil className="h-4 w-4" aria-hidden /> {t('edit')}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => (cancelled || window.confirm(t('cancelConfirm'))) && run(() => setConviviumCancelled(event.id, !cancelled))}
          className="rounded-xl border border-[var(--gold)]/40 bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)]"
        >
          {cancelled ? t('restore') : t('cancelEvening')}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            window.confirm(t('deleteConfirm')) &&
            start(async () => {
              const res = await deleteConvivium(event.id)
              if (res.success) router.push('/convivium')
            })
          }
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden /> {t('delete')}
        </button>
      </div>
    </div>
  )
}
