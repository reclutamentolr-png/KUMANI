'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { answerConviviumForm } from '@/app/actions/convivium'
import { CONVIVIUM_LIMITS, type ConviviumAnswer } from '@/lib/convivium'

const BUTTON: Record<ConviviumAnswer, string> = {
  yes: 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]',
  maybe: 'bg-white/10 text-white hover:bg-white/20',
  no: 'bg-white/10 text-white/80 hover:bg-white/20',
}

// Risposta all'invito senza account: nome e un tocco. È un vero modulo (azione
// del server): parte anche se il telefono non ha finito di caricare la pagina.
// Si può cambiare quando si vuole dallo stesso telefono (cookie) o dall'account.
export default function ConviviumRsvp({ code, initialName, mine, full }: { code: string; initialName: string; mine: { name: string; answer: ConviviumAnswer } | null; full: boolean }) {
  const t = useTranslations('convivium')
  const [state, formAction, pending] = useActionState(answerConviviumForm, null)
  const answered = state?.answer ?? mine?.answer ?? null

  const status = state?.status
  const message =
    status === 'ok' && state?.answer
      ? { text: t(`saved_${state.answer}`), good: true }
      : status === 'name'
        ? { text: t('errorName'), good: false }
        : status === 'full'
          ? { text: t('full'), good: false }
          : status === 'cancelled'
            ? { text: t('cancelledText'), good: false }
            : status === 'closed'
              ? { text: t('closedText'), good: false }
              : status
                ? { text: t('error_generic'), good: false }
                : null

  return (
    <form action={formAction} className="mt-6 text-left">
      <input type="hidden" name="code" value={code} />
      <p className="text-center text-2xl font-extrabold">{t('question')}</p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-white/80">{t('yourName')}</span>
        <input
          name="name"
          defaultValue={mine?.name ?? initialName}
          required
          maxLength={CONVIVIUM_LIMITS.name}
          autoComplete="given-name"
          placeholder={t('yourNamePlaceholder')}
          className="w-full rounded-xl border border-white/20 bg-white/10 px-3.5 py-3 text-white placeholder:text-white/40 outline-none focus:border-[var(--gold-bright)]"
        />
      </label>
      <p className="mt-1.5 text-xs text-white/50">{t('nameVisible')}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(['yes', 'maybe', 'no'] as const).map((a) => (
          <button
            key={a}
            type="submit"
            name="answer"
            value={a}
            disabled={pending || (a === 'yes' && full && answered !== 'yes')}
            aria-pressed={answered === a}
            className={`rounded-xl px-2 py-3 text-sm font-extrabold transition disabled:opacity-40 sm:text-base ${BUTTON[a]} ${answered === a ? 'ring-2 ring-white' : ''}`}
          >
            {t(`btn_${a}`)}
          </button>
        ))}
      </div>
      {full && answered !== 'yes' && <p className="mt-3 text-center text-sm text-amber-200">{t('full')}</p>}
      {message && (
        <p role="status" className={`mt-4 rounded-xl px-3.5 py-2.5 text-center text-sm font-semibold ${message.good ? 'bg-emerald-500/15 text-emerald-200' : 'bg-red-500/15 text-red-200'}`}>
          {message.text}
        </p>
      )}
      {answered && !message && (
        <p className="mt-4 text-center text-sm text-white/70">
          {t('yourAnswer', { answer: t(`answer_${answered}`) })} · {t('change')}
        </p>
      )}
    </form>
  )
}
