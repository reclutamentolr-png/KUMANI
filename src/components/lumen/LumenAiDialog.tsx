'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle, Sparkles, X } from 'lucide-react'
import { generateLumenScript, lumenAiLeft } from '@/app/actions/lumen'
import { LUMEN_AI_DURATIONS, LUMEN_AI_GOALS, LUMEN_AI_TONES, type LumenAiRequest, type LumenScript } from '@/lib/lumen'

// «Scrivi con l'AI»: di cosa vuoi parlare, a chi, quanto deve durare, tono,
// obiettivo e invito finale. Il copione arriva già salvato e si apre
// nell'editor, pronto da leggere con LUMEN. Con «Modifica» (replaceId) si
// riapre con le scelte di quel copione e «Aggiorna» lo riscrive.
export default function LumenAiDialog({
  onClose,
  onCreated,
  initialTopic = '',
  initial,
  replaceId,
}: {
  onClose: () => void
  onCreated: (script: LumenScript) => void
  initialTopic?: string
  initial?: LumenAiRequest | null
  replaceId?: string
}) {
  const t = useTranslations('lumen')
  const locale = useLocale()
  const [form, setForm] = useState<LumenAiRequest>({ topic: initialTopic, audience: '', cta: '', seconds: 30, tone: 'friendly', goal: 'present', ...initial })
  const editing = !!replaceId
  // Copioni con l'AI che restano oggi
  const [quota, setQuota] = useState<{ left: number; limit: number } | null>(null)
  useEffect(() => {
    lumenAiLeft().then((r) => r.success && setQuota(r.data)).catch(() => {})
  }, [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<LumenAiRequest>) => setForm((f) => ({ ...f, ...patch }))

  const submit = async () => {
    setBusy(true)
    setError(null)
    const r = await generateLumenScript(form, locale, replaceId)
    setBusy(false)
    lumenAiLeft().then((q) => q.success && setQuota(q.data)).catch(() => {})
    if (!r.success) return setError(t(`error_${r.message}` as 'error_aiError'))
    onCreated(r.data)
  }

  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 text-gray-600 hover:border-[var(--gold)]/60'}`
  const field = 'mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="lumen-ai-title" onClick={() => !busy && onClose()}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="lumen-ai-title" className="flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
              <Sparkles className="h-5 w-5 text-[var(--gold)]" /> {editing ? t('aiEditTitle') : t('aiTitle')}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{editing ? t('aiEditIntro') : t('aiIntro')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('close')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-semibold text-[var(--ink)]">
          {t('aiTopic')}
          <textarea value={form.topic} onChange={(e) => set({ topic: e.target.value.slice(0, 600) })} rows={3} placeholder={t('aiTopicPlaceholder')} className={field} />
        </label>
        <label className="mt-3 block text-sm font-semibold text-[var(--ink)]">
          {t('aiAudience')}
          <input value={form.audience} onChange={(e) => set({ audience: e.target.value.slice(0, 200) })} placeholder={t('aiAudiencePlaceholder')} className={field} />
        </label>

        <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('aiGoal')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LUMEN_AI_GOALS.map((g) => (
            <button key={g} type="button" onClick={() => set({ goal: g })} aria-pressed={form.goal === g} className={chip(form.goal === g)}>
              {t(`aiGoal_${g}`)}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('aiTone')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LUMEN_AI_TONES.map((tone) => (
            <button key={tone} type="button" onClick={() => set({ tone })} aria-pressed={form.tone === tone} className={chip(form.tone === tone)}>
              {t(`aiTone_${tone}`)}
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('aiLength')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LUMEN_AI_DURATIONS.map((s) => (
            <button key={s} type="button" onClick={() => set({ seconds: s })} aria-pressed={form.seconds === s} className={chip(form.seconds === s)}>
              {t('aiSeconds', { seconds: s })}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold text-[var(--ink)]">
          {t('aiCta')}
          <input value={form.cta} onChange={(e) => set({ cta: e.target.value.slice(0, 200) })} placeholder={t('aiCtaPlaceholder')} className={field} />
        </label>

        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={busy || form.topic.trim().length < 5 || quota?.left === 0}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-base font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {busy ? t('aiWriting') : editing ? t('aiUpdate') : t('aiGenerate')}
        </button>
        {quota && (
          <p className={`mt-2 text-center text-xs font-semibold ${quota.left === 0 ? 'text-red-700' : 'text-[var(--ink)]'}`}>
            {quota.left === 0 ? t('aiNoneLeft', { limit: quota.limit }) : t('aiLeft', { left: quota.left, limit: quota.limit })}
          </p>
        )}
        <p className="mt-1 text-center text-xs text-[var(--muted)]">{editing ? t('aiEditNote') : t('aiNote')}</p>
      </div>
    </div>
  )
}
