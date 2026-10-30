'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, ChevronDown, LayoutTemplate, LoaderCircle } from 'lucide-react'
import { createSurprise } from '@/app/actions/surprise'
import { SURPRISE_TEMPLATES } from '@/lib/surpriseTemplates'
import { THEME_STYLE, voucherOnly, type SurpriseKind } from '@/lib/surprise'
import { OCCASION_ICON } from './SurpriseExperience'

// «Inizia da un modello»: sorprese già impostate (tipo, stile, testi e tappe),
// in una tendina che si apre con «Scegli da un modello»
// kinds: solo i modelli dei tipi accesi dall'Admin
export default function TemplatePicker({ prices, kinds }: { prices: Record<SurpriseKind, number>; kinds: SurpriseKind[] }) {
  const t = useTranslations('surprise')
  const tt = useTranslations('surpriseTpl')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const templates = SURPRISE_TEMPLATES.filter((tpl) => kinds.includes(tpl.kind))
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)

  const use = async (key: string) => {
    setBusy(key)
    setError(null)
    const r = await createSurprise(locale, key)
    if (!r.success) {
      setBusy(null)
      return setError(r.limitText ?? t('error_saveError'))
    }
    router.push(`${locale === 'it' ? '' : `/${locale}`}/sorprese/${r.id}`)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--ink)]">{t('templatesTitle')}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{t(voucherOnly(kinds) ? 'templatesTextVoucher' : 'templatesText')}</p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="surprise-templates"
        className="mt-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-[var(--gold)]/50 bg-white px-4 py-3 text-left shadow-sm transition hover:border-[var(--gold)]"
      >
        <LayoutTemplate className="h-6 w-6 shrink-0 text-[var(--gold)]" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[var(--ink)]">{open ? t('templatesClose') : t('templatesOpen')}</span>
          <span className="block text-sm text-[var(--muted)]">{t('templatesCount', { n: templates.length })}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[var(--gold)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id="surprise-templates" className={`mt-3 gap-3 sm:grid-cols-2 ${open ? 'grid' : 'hidden'}`}>
        {templates.map((tpl) => {
          const Icon = OCCASION_ICON[tpl.occasion]
          const accent = THEME_STYLE[tpl.theme].accent
          return (
            <button
              key={tpl.key}
              type="button"
              onClick={() => use(tpl.key)}
              disabled={busy !== null}
              className="group flex min-h-24 cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--gold)] hover:shadow-md disabled:opacity-60 motion-reduce:hover:translate-y-0"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: accent }}>
                {busy === tpl.key ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[var(--ink)]">{tt(`${tpl.key}_name`)}</span>
                <span className="mt-0.5 block text-sm text-[var(--muted)]">{tt(`${tpl.key}_desc`)}</span>
                <span className="mt-2 block text-xs font-semibold text-gray-600">
                  {t(`kind_${tpl.kind}`)} · {money(prices[tpl.kind])}
                </span>
              </span>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
            </button>
          )
        })}
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-amber-700">{error}</p>}
    </div>
  )
}
