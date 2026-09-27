'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { BadgeCheck, CheckCircle2, Circle, LoaderCircle, Plus, ShieldCheck, Store, XCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { becomeLeader } from '@/app/actions/convivio'
import { CONVIVIO_CATEGORIES, type ConvivioCard, type ConvivioLeaderStatus } from '@/lib/convivio'
import ConvivioCardItem from './ConvivioCardItem'
import ConvivioCreateForm from './ConvivioCreateForm'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

// Convivio: cordate aperte e "le mie", filtro per categoria, "Proponi un
// Convivio" (con la verifica del capocordata quando serve).
export default function ConvivioHome({
  open,
  mine,
  leader,
  isPro,
}: {
  open: ConvivioCard[]
  mine: ConvivioCard[]
  leader: ConvivioLeaderStatus | null
  isPro: boolean
}) {
  const t = useTranslations('convivio')
  const locale = useLocale()
  const router = useRouter()
  const [tab, setTab] = useState<'open' | 'mine'>('open')
  const [category, setCategory] = useState<string>('all')
  const [sheet, setSheet] = useState<'setup' | 'create' | null>(null)
  const [now, setNow] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const list = (tab === 'open' ? open : mine).filter((c) => category === 'all' || c.category === category)

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-[var(--gold)]/25 bg-white p-1">
          {(['open', 'mine'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]'}`}
            >
              {t(key === 'open' ? 'tabOpen' : 'tabMine')} {key === 'mine' && mine.length > 0 ? `(${mine.length})` : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
        {isPro && (
          <Link
            href="/marketplace/convivio/fornitore"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--gold)] px-4 py-2 font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
          >
            <Store className="h-5 w-5" /> {t('supplierArea')}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setSheet(leader?.verified ? 'create' : 'setup')}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 font-bold text-[var(--ink)] shadow-sm hover:brightness-105"
        >
          <Plus className="h-5 w-5" /> {t('propose')}
        </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {['all', ...CONVIVIO_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              category === c ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-200 bg-white text-gray-600'
            }`}
          >
            {c === 'all' ? t('allCategories') : t(`category_${c}`)}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white/70 p-10 text-center">
          <p className="text-[var(--muted)]">{tab === 'open' ? t('emptyOpen') : t('emptyMine')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card) => (
            <ConvivioCardItem key={card.id} card={card} now={now} />
          ))}
        </div>
      )}

      <p className="mt-8 flex items-start gap-2 rounded-xl bg-white/70 px-4 py-3 text-xs leading-5 text-[var(--muted)]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('paymentsNotice')}
      </p>

      {sheet === 'setup' && leader && <LeaderSetup status={leader} onClose={() => setSheet(null)} onDone={() => (router.refresh(), setSheet('create'))} />}
      {sheet === 'create' && (
        <ConvivioCreateForm
          mode="leader"
          onClose={() => setSheet(null)}
          onCreated={(id) => router.push(`/${locale}/marketplace/convivio/${id}`)}
        />
      )}
    </div>
  )
}

function LeaderSetup({ status, onClose, onDone }: { status: ConvivioLeaderStatus; onClose: () => void; onDone: () => void }) {
  const t = useTranslations('convivio')
  const [taxCode, setTaxCode] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState(status)

  // Prima l'abbonamento (senza non contano i 30 giorni), poi i 30 giorni di
  // abbonamento, poi il profilo. Se manca uno di questi non si prosegue.
  const checks: { key: keyof ConvivioLeaderStatus; text: string; action?: React.ReactNode }[] = [
    {
      key: 'subscription',
      text: t('check_subscription'),
      action: !local.subscription && (
        <Link href={{ pathname: '/billing' }} className="text-xs font-semibold text-[var(--gold)] underline">
          {t('activate')}
        </Link>
      ),
    },
    {
      key: 'account_age',
      text: local.account_age ? t('check_account_age') : local.subscription ? t('check_account_age_wait', { days: local.days_left }) : t('check_account_age'),
    },
    { key: 'profile', text: t('check_profile'), action: !local.profile && <span className="text-xs text-[var(--muted)]">{t('check_profile_hint')}</span> },
  ]
  const basicsOk = local.subscription && local.account_age && local.profile && !local.blocked

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await becomeLeader(taxCode, terms)
    setBusy(false)
    if (!result.success) {
      setError(t(`error_${result.error ?? 'saveError'}`))
      return
    }
    const next = { ...local, tax_code: true, terms: true }
    setLocal(next)
    if (next.account_age && next.subscription && next.profile && !next.blocked) onDone()
  }

  return (
    <Sheet title={t('setupTitle')} onClose={onClose}>
      <p className="mb-4 text-sm text-gray-600">{t('setupIntro')}</p>
      <ul className="mb-5 space-y-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            {local[c.key] ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />}
            <span className={`flex-1 ${local[c.key] ? '' : 'font-semibold text-red-700'}`}>
              {c.text} {c.action}
            </span>
          </li>
        ))}
        <li className="flex items-start gap-2 text-sm">
          {local.tax_code && local.terms ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" />}
          <span>{t('check_tax_code')}</span>
        </li>
      </ul>

      {!basicsOk && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{t('requirementsMissing')}</p>
      )}

      {basicsOk && !(local.tax_code && local.terms) && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-4">
          <div>
            <label className={label}>{t('taxCode')}</label>
            <input
              className={`${input} font-mono uppercase tracking-wider`}
              value={taxCode}
              maxLength={16}
              required
              placeholder="RSSMRA80A01H501U"
              onChange={(e) => setTaxCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
            />
            <p className="mt-1 text-xs text-gray-500">{t('taxCodeHint')}</p>
          </div>
          <div className="rounded-lg bg-white p-3 text-xs leading-5 text-gray-600">
            <p className="mb-1 font-semibold text-gray-800">{t('rulesTitle')}</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>{t('rule1')}</li>
              <li>{t('rule2')}</li>
              <li>{t('rule3')}</li>
              <li>{t('rule4')}</li>
            </ul>
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
            {t('acceptRules')}
          </label>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button type="submit" disabled={busy || !terms || taxCode.length !== 16} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white disabled:opacity-50">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />} {t('verifyMe')}
          </button>
        </form>
      )}

    </Sheet>
  )
}
