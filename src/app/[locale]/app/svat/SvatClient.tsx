'use client'

import { useTranslations } from 'next-intl'
import { use, useEffect, useRef, useState, type ReactNode } from 'react'
import ToolBackLink from '@/components/ToolBackLink'
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Search,
  LoaderCircle,
  Globe,
  Building,
  Lock,
  Eye,
  TrendingUp,
  ExternalLink,
  Share2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  QrCode,
  ArrowDown,
} from 'lucide-react'
import QRCheckScanner from '@/components/QRCheckScanner'
import CommunityWarning from '@/components/scamNet/CommunityWarning'
import Link from '@/components/LocalizedLink'
import { reportHref } from '@/lib/scamNet'
import DossierButton, { type Dossier } from '@/components/scamNet/DossierButton'

interface SVATCheck {
  id: string
  name: string
  status: 'ok' | 'warning' | 'risk' | 'check'
  points: number
  details: string
  detailsKey?: string
  source?: string
  sourceUrl?: string
  detailsInterp?: Record<string, string>
}

interface SVATResult {
  input: string
  domain?: string
  score: number
  badge: 'green' | 'yellow' | 'red'
  checks: SVATCheck[]
  summary: {
    totalChecks: number
    okCount: number
    warningCount: number
    riskCount: number
  }
}

function StatusIcon({ status }: { status: 'ok' | 'warning' | 'risk' | 'check' }) {
  switch (status) {
    case 'ok':
      return <CheckCircle className="h-5 w-5 text-green-500" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />
    case 'risk':
      return <XCircle className="h-5 w-5 text-red-500" />
    case 'check':
      return <Clock className="h-5 w-5 text-[var(--gold)]" />
    default:
      return <Eye className="h-5 w-5 text-[var(--muted)]" />
  }
}

const COMPANY_CHECKS = ['vatFormat', 'vies', 'registry']

function BadgeColor({ badge }: { badge: 'green' | 'yellow' | 'red' }) {
  switch (badge) {
    case 'green':
      return 'bg-green-500'
    case 'yellow':
      return 'bg-amber-500'
    case 'red':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

// Precompilazione da link (?vat= o ?url=, es. dalla chat o dal box «Controlla»):
// solo il campo, il controllo parte col click perché chiama servizi esterni
function prefillFromParams(params: { [key: string]: string | string[] | undefined }): { tab: 'website' | 'vat'; value: string } {
  const clean = (v: string | string[] | undefined) =>
    (typeof v === 'string' ? v : '').replace(/[\x00-\x1f\x7f<>"`]/g, '').trim().slice(0, 200)
  const vat = clean(params.vat)
  if (vat) return { tab: 'vat', value: vat }
  return { tab: 'website', value: clean(params.url) }
}

export default function SvatClient({
  searchParams,
  hubBar,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  // Barra delle schede di Speculum (componente server, passato da page.tsx)
  hubBar: ReactNode
}) {
  const t = useTranslations('svat')
  const commonT = useTranslations('common')
  const prefill = prefillFromParams(use(searchParams))
  const [activeTab, setActiveTab] = useState<'website' | 'vat' | 'qr'>(prefill.tab)
  const [input, setInput] = useState(prefill.value)
  const [result, setResult] = useState<SVATResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resultsRef = useRef<HTMLDivElement>(null)
  const runCheck = async (value: string, tab: 'website' | 'vat' | 'qr', scrollToResult = false) => {
    if (!value.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/svat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value.trim(), mode: tab === 'vat' ? 'vat' : 'website' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || 'Verification failed')
      }

      const data = await res.json()
      setResult(data)
      // Avvio automatico: si va subito al risultato
      if (scrollToResult) setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message === 'invalidUrl' ? t('invalidUrl') : message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runCheck(input, activeTab)
  }

  // Arrivando da «Controlla» (o da un link) con ?url= o ?vat= il controllo
  // parte da solo, una volta, senza dover toccare «Esegui verifica»
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current || !prefill.value) return
    autoRan.current = true
    void runCheck(prefill.value, prefill.tab, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Controlli sull'azienda (partita IVA): il testo è tradotto con i dati VIES
  const isCompanyCheck = (c: SVATCheck) => COMPANY_CHECKS.includes(c.id)
  // Dettagli tradotti per tutti i controlli quando il testo esiste nella
  // lingua (e ha i dati che chiede); altrimenti il testo tecnico del server
  const detailText = (c: SVATCheck) => {
    if (!c.detailsKey || !t.has(c.detailsKey)) return c.details
    const raw = String(t.raw(c.detailsKey))
    if (raw.includes('{') && !c.detailsInterp) return c.details
    return t(c.detailsKey, c.detailsInterp)
  }
  const isCompany = !!result?.checks.some(isCompanyCheck)

  const switchTab = (tab: 'website' | 'vat' | 'qr') => {
    if (tab === activeTab) return
    setActiveTab(tab)
    setInput('')
    setResult(null)
    setError(null)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 40) return 'text-amber-500'
    return 'text-red-500'
  }

  // Dossier del controllo in PDF (al posto della vecchia stampa con i titoli in inglese)
  const buildDossier = (): Dossier => {
    const r = result!
    const status = r.badge === 'green' ? 'ok' : r.badge === 'yellow' ? 'warning' : 'risk'
    return {
      tool: 'SVAT',
      subject: r.domain || r.input,
      subjectLines: r.domain && r.domain !== r.input ? [r.input] : [],
      verdict: { status, text: t(r.badge === 'green' ? 'badgeGreen' : r.badge === 'yellow' ? 'badgeYellow' : 'badgeRed'), score: `${r.score}/100` },
      rows: r.checks.map((c) => ({ label: t(c.name), value: `${detailText(c)}${c.source ? ` (${c.source})` : ''}`, status: c.status === 'check' ? 'info' : c.status })),
    }
  }

  const shareResult = async () => {
    if (!result) return
    const text = `SVAT Verification Report for ${result.domain || result.input}\nScore: ${result.score}/100 (${result.badge})`
    if (navigator.share) {
      navigator.share({ title: 'SVAT Report', text, url: window.location.href })
    } else {
      navigator.clipboard.writeText(text)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-3">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            label={<><ArrowLeft className="w-5 h-5" /> {commonT('backToServices')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide min-w-0 text-right leading-tight">
            <ShieldCheck className="h-5 w-5 text-[var(--gold-bright)] shrink-0" />
            {t('title')}
          </h1>
        </div>
      </header>
      {hubBar}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-[var(--gold)]/15 text-[var(--gold-bright)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <ShieldCheck className="w-4 h-4" />
              {t('badge')}
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t('heroTitle')}</h2>
            <p className="text-white/70 text-base sm:text-lg">{t('heroDescription')}</p>
          </div>

          {/* Tabs */}
          <div className="relative mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => switchTab('website')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'website'
                  ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-md'
                  : 'border border-[var(--gold)]/40 text-white/80 font-medium hover:border-[var(--gold)] hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              {t('tabWebsiteCheck')}
            </button>
            <button
              onClick={() => switchTab('vat')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'vat'
                  ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-md'
                  : 'border border-[var(--gold)]/40 text-white/80 font-medium hover:border-[var(--gold)] hover:text-white'
              }`}
            >
              <Building className="w-4 h-4" />
              {t('tabVatCheck')}
            </button>
            <button
              onClick={() => switchTab('qr')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm transition-all ${
                activeTab === 'qr'
                  ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-md'
                  : 'border border-[var(--gold)]/40 text-white/80 font-medium hover:border-[var(--gold)] hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4" />
              {t('tabQrCheck')}
            </button>
          </div>
        </div>

        {activeTab === 'qr' && <QRCheckScanner />}

        {activeTab !== 'qr' && (
        <>
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mb-8 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={activeTab === 'vat' ? t('inputPlaceholderVat') : t('inputPlaceholderSite')}
              className="flex-1 px-4 py-3 border-2 border-[var(--gold)]/20 rounded-xl focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 transition-all text-base"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoaderCircle className="w-5 h-5 animate-spin" />
                  {t('scanning')}
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  {t('submit')}
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">
            <XCircle className="w-5 h-5 text-red-600 mx-auto mb-2" />
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <LoaderCircle className="w-12 h-12 text-[var(--gold)] mx-auto mb-4 animate-spin" />
            <p className="text-[var(--muted)]">{t('checksInProgress')}</p>
          </div>
        )}

        {result && (
          <div ref={resultsRef} className="scroll-mt-[calc(var(--hub-bottom,4rem)+1rem)] space-y-8">
            {/* Avviso della Rete Anti-Truffa (solo se il sito è stato segnalato e confermato) */}
            {result.domain && <CommunityWarning items={[{ kind: 'site', value: result.domain }]} report={{ kind: 'site', value: result.domain }} />}
            {/* In un elenco di siti truffa (autorità o phishing) o segnalato da Google: avviso in cima, con la fonte */}
            {(() => {
              const listed = result.checks.find((c) => (c.id === 'scamList' || c.id === 'webRisk' || c.id === 'ipLogger' || c.id === 'scamPattern') && c.status === 'risk')
              if (!listed) return null
              return (
                <div role="alert" className="rounded-2xl border-2 border-red-400 bg-red-50 p-5 text-red-900 shadow-md sm:p-6">
                  <p className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
                    <ShieldAlert className="h-7 w-7 shrink-0 text-red-600" aria-hidden /> {listed.id === 'ipLogger' ? t('ipLoggerAlertTitle') : listed.id === 'scamPattern' ? t('scamPatternAlertTitle') : t('scamListAlertTitle')}
                  </p>
                  <p className="mt-3 break-words text-base font-medium leading-relaxed sm:text-lg">{detailText(listed)}</p>
                  {listed.sourceUrl && (
                    <a href={listed.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-800 underline">
                      {t('scamListSource', { source: listed.source ?? '' })} <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )
            })()}
            {/* Il link porta su un altro sito: partenza e arrivo ben visibili, perché i controlli sono sul sito d'arrivo */}
            {(() => {
              const redirect = result.checks.find((c) => c.id === 'redirect' && c.detailsInterp?.from && c.detailsInterp?.to)
              if (!redirect?.detailsInterp) return null
              return (
                <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950 shadow-md sm:p-6">
                  <p className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
                    <AlertTriangle className="h-7 w-7 shrink-0 text-amber-600" aria-hidden /> {t(redirect.name)}
                  </p>
                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">{t('redirectFrom')}</p>
                    <p className="break-all rounded-xl border border-amber-200 bg-white/70 px-4 py-2 font-mono text-sm text-amber-900">{redirect.detailsInterp.from}</p>
                    <ArrowDown className="mx-auto h-6 w-6 text-amber-600" aria-hidden />
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">{t('redirectDest')}</p>
                    <p className="break-all rounded-xl border-2 border-amber-500 bg-white px-4 py-3 font-mono text-base font-bold text-[var(--ink)] sm:text-lg">{redirect.detailsInterp.to}</p>
                  </div>
                  <p className="mt-4 text-base leading-relaxed">{detailText(redirect)}</p>
                </div>
              )
            })()}
            {/* Score Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 text-center">
              <h3 className="text-lg font-semibold text-[var(--muted)] mb-2">{t('scoreTitle')}</h3>
              <div className={`text-6xl font-bold mb-2 ${getScoreColor(result.score)}`}>
                {result.score}
                <span className="text-2xl text-[var(--muted)]">/100</span>
              </div>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={`h-4 w-4 rounded-full ${BadgeColor({ badge: result.badge })}`} />
                <span className="text-xl font-semibold text-[var(--ink)]">
                  {result.badge === 'green' ? t('badgeGreen') : result.badge === 'yellow' ? t('badgeYellow') : t('badgeRed')}
                </span>
              </div>
              <p className="text-[var(--muted)]">
                {t('scoreTitle')}: {result.score}/100 — {result.badge === 'green' ? t('badgeGreen') : result.badge === 'yellow' ? t('badgeYellow') : t('badgeRed')}
              </p>
              {/* Segnala il sito alla Rete Anti-Truffa: modulo già compilato; in evidenza se il risultato è rosso */}
              {result.domain && !isCompany && (
                <div className="mt-5">
                  <Link
                    href={reportHref('site', result.domain)}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold ${
                      result.badge === 'red'
                        ? 'bg-[#A12A2A] text-white shadow-md hover:brightness-110'
                        : 'border border-[var(--ink)]/20 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'
                    }`}
                  >
                    <ShieldAlert className="h-4 w-4" aria-hidden /> {t('reportSite')}
                  </Link>
                  <p className="mt-2 text-xs text-[var(--muted)]">{t('reportSiteHint')}</p>
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4 text-center">
                <div className="text-2xl font-bold text-[var(--ink)]">{result.summary.totalChecks}</div>
                <p className="text-xs text-[var(--muted)]">{t('totalChecks')}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{result.summary.okCount}</div>
                <p className="text-xs text-[var(--muted)]">{t('statusOK')}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{result.summary.warningCount}</div>
                <p className="text-xs text-[var(--muted)]">{t('statusWarning')}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{result.summary.riskCount}</div>
                <p className="text-xs text-[var(--muted)]">{t('statusRisk')}</p>
              </div>
            </div>

            {/* Company Section (partita IVA) */}
            {isCompany && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <Building className="w-5 h-5 text-[var(--gold)]" />
                  {t('companySection')}
                </div>
                {result.checks.filter(isCompanyCheck).map((c) => (
                  <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <StatusIcon status={c.status} />
                        <div>
                          <p className="font-medium text-[var(--ink)]">{t(c.name)}</p>
                          <p className="text-sm text-[var(--muted)] mt-1 break-words">{detailText(c)}</p>
                          {c.source && (
                            <p className="text-xs text-[var(--muted)] mt-1">
                              {c.sourceUrl ? (
                                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] hover:underline">
                                  {c.id === 'registry' ? t('registryOpen') : c.source} <ExternalLink className="w-3 h-3 inline" />
                                </a>
                              ) : (
                                c.source
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === 'ok' ? 'bg-green-100 text-green-800' :
                        c.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                        c.status === 'risk' ? 'bg-red-100 text-red-800' :
                        'bg-[var(--gold-pale)] text-[var(--ink)]'
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-[var(--muted)]">{t('companyNote')}</p>
              </div>
            )}

            {/* Link spia: il link non si apre, quindi niente sezioni sul sito */}
            {!isCompany && !result.checks.some((c) => c.id === 'ipLogger') && (
            <>
            {/* Results Grid */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Domain & DNS Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <Globe className="w-5 h-5 text-[var(--gold)]" />
                  {t('domainSection')}
                </div>
                {result.checks
                  .filter((c) => ['whois', 'domainAge', 'spf', 'dmarc', 'mx', 'ptr', 'httpHeaders'].includes(c.id))
                  .map((c) => (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon status={c.status} />
                          <div>
                            <p className="font-medium text-[var(--ink)]">{t(c.name)}</p>
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{detailText(c)}</p>
                            {c.source && (
                              <p className="text-xs text-[var(--muted)] mt-1">
                                {c.sourceUrl ? (
                                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] hover:underline">
                                    {c.source} <ExternalLink className="w-3 h-3 inline" />
                                  </a>
                                ) : (
                                  c.source
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === 'ok' ? 'bg-green-100 text-green-800' :
                          c.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                          c.status === 'risk' ? 'bg-red-100 text-red-800' :
                          'bg-[var(--gold-pale)] text-[var(--ink)]'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Security & SSL Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <Lock className="w-5 h-5 text-[var(--gold)]" />
                  {t('securitySection')}
                </div>
                {result.checks
                  .filter((c) => ['ssl', 'safeBrowsing', 'virusTotal', 'abuseIPDB'].includes(c.id))
                  .map((c) => (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon status={c.status} />
                          <div>
                            <p className="font-medium text-[var(--ink)]">{t(c.name)}</p>
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{detailText(c)}</p>
                            {c.source && (
                              <p className="text-xs text-[var(--muted)] mt-1">
                                {c.sourceUrl ? (
                                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--gold)] hover:underline">
                                    {c.source} <ExternalLink className="w-3 h-3 inline" />
                                  </a>
                                ) : (
                                  c.source
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === 'ok' ? 'bg-green-100 text-green-800' :
                          c.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                          c.status === 'risk' ? 'bg-red-100 text-red-800' :
                          'bg-[var(--gold-pale)] text-[var(--ink)]'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Content, Legal, Reviews, Business Model Sections */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Content Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <Search className="w-5 h-5 text-[var(--gold)]" />
                  {t('contentSection')}
                </div>
                {result.checks
                  .filter((c) => ['contentScraping'].includes(c.id))
                  .map((c) => (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon status={c.status} />
                          <div>
                            <p className="font-medium text-[var(--ink)]">{t(c.name)}</p>
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{detailText(c)}</p>
                            {c.source && <p className="text-xs text-[var(--muted)] mt-1">{c.source}</p>}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === 'ok' ? 'bg-green-100 text-green-800' :
                          c.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                          c.status === 'risk' ? 'bg-red-100 text-red-800' :
                          'bg-[var(--gold-pale)] text-[var(--ink)]'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Legal Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <ShieldCheck className="w-5 h-5 text-[var(--gold)]" />
                  {t('legalSection')}
                </div>
                {result.checks
                  .filter((c) => ['legalPages'].includes(c.id))
                  .map((c) => (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon status={c.status} />
                          <div>
                            <p className="font-medium text-[var(--ink)]">{t(c.name)}</p>
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{detailText(c)}</p>
                            {c.source && <p className="text-xs text-[var(--muted)] mt-1">{c.source}</p>}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === 'ok' ? 'bg-green-100 text-green-800' :
                          c.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                          c.status === 'risk' ? 'bg-red-100 text-red-800' :
                          'bg-[var(--gold-pale)] text-[var(--ink)]'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Reviews Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <TrendingUp className="w-5 h-5 text-[var(--gold)]" />
                  {t('reviewsSection')}
                </div>
                {result.checks
                  .filter((c) => ['reviews'].includes(c.id))
                  .map((c) => (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon status={c.status} />
                          <div>
                            <p className="font-medium text-[var(--ink)]">{t(c.name)}</p>
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{detailText(c)}</p>
                            {c.source && <p className="text-xs text-[var(--muted)] mt-1">{c.source}</p>}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === 'ok' ? 'bg-green-100 text-green-800' :
                          c.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                          c.status === 'risk' ? 'bg-red-100 text-red-800' :
                          'bg-[var(--gold-pale)] text-[var(--ink)]'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Business Model Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-[var(--ink)]">
                  <Building className="w-5 h-5 text-[var(--gold)]" />
                  {t('businessSection')}
                </div>
                {result.checks
                  .filter((c) => ['businessModel'].includes(c.id))
                  .map((c) => (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <StatusIcon status={c.status} />
                          <div>
                            <p className="font-medium text-[var(--ink)]">{t(c.name)}</p>
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{detailText(c)}</p>
                            {c.source && <p className="text-xs text-[var(--muted)] mt-1">{c.source}</p>}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                          c.status === 'ok' ? 'bg-green-100 text-green-800' :
                          c.status === 'warning' ? 'bg-amber-100 text-amber-800' :
                          c.status === 'risk' ? 'bg-red-100 text-red-800' :
                          'bg-[var(--gold-pale)] text-[var(--ink)]'
                        }`}>
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            </>
            )}

            {/* All Checks List */}
            {!isCompany && (
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6">
              <h3 className="text-lg font-semibold text-[var(--ink)] mb-4">{t('allChecks')}</h3>
              <div className="space-y-3">
                {result.checks.map((c) => {
                  // I due controlli che l'utente deve capire subito: in evidenza anche qui
                  const key = (c.id === 'scamPattern' && c.status === 'risk') || c.id === 'redirect'
                  if (key) {
                    return (
                      <div key={c.id} className={`rounded-xl border-2 p-4 ${c.id === 'redirect' ? 'border-amber-400 bg-amber-50' : 'border-red-400 bg-red-50'}`}>
                        <div className="flex items-center gap-3">
                          <StatusIcon status={c.id === 'redirect' ? 'warning' : c.status} />
                          <span className="font-bold text-[var(--ink)]">{t(c.name)}</span>
                        </div>
                        <p className={`mt-2 break-words text-sm font-medium leading-relaxed sm:text-base ${c.id === 'redirect' ? 'text-amber-950' : 'text-red-900'}`}>{detailText(c)}</p>
                      </div>
                    )
                  }
                  return (
                    <div key={c.id} className="flex flex-col gap-1 p-3 rounded-xl border border-[var(--gold)]/15 hover:bg-[var(--gold-pale)]/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="flex items-center gap-3">
                        <StatusIcon status={c.status} />
                        <span className="font-medium text-[var(--ink)]">{t(c.name)}</span>
                      </div>
                      <span className="text-sm text-[var(--muted)] break-words sm:text-right">{detailText(c)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            )}

            {/* Summary */}
            {!isCompany && !result.checks.some((c) => c.id === 'ipLogger') && (
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6">
              <h3 className="text-lg font-semibold text-[var(--ink)] mb-4">{t('websiteSection')}</h3>
              <p className="text-sm text-[var(--muted)]">
                {result.checks.some((c) => ['ssl', 'httpHeaders', 'spf', 'dmarc', 'mx', 'safeBrowsing', 'virusTotal', 'abuseIPDB', 'ptr'].includes(c.id))
                  ? t('reputationSummary')
                  : 'Security checks incomplete'}
              </p>
            </div>
            )}

            {/* Actions */}
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
              <DossierButton build={buildDossier} community={isCompany ? [] : [{ kind: 'site', value: result.domain || result.input }]} />
              <button
                onClick={shareResult}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-[var(--gold)]/40 hover:border-[var(--gold)] text-[var(--ink)] rounded-xl font-medium transition-all"
              >
                <Share2 className="w-5 h-5" />
                {t('viewSources')}
              </button>
              <button
                onClick={() => {
                  setResult(null)
                  setInput('')
                }}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white rounded-xl font-medium transition-all"
              >
                <RefreshCw className="w-5 h-5" />
                {t('backToMarketplace')}
              </button>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-[var(--muted)] text-center">
              {t('disclaimer')}
            </p>
          </div>
        )}

        {!loading && !result && !error && (
          <div className="text-center py-12 rounded-2xl border border-dashed border-[var(--gold)]/40 text-[var(--muted)]">
            {activeTab === 'vat' ? <Building className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" /> : <Search className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" />}
            <p>{activeTab === 'vat' ? t('emptyVat') : t('emptySite')}</p>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  )
}
