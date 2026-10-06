'use client'

import { useTranslations } from 'next-intl'
import { use, useState } from 'react'
import ToolBackLink from '@/components/ToolBackLink'
import {
  ArrowLeft,
  ShieldCheck,
  Search,
  LoaderCircle,
  Globe,
  Building,
  Lock,
  Eye,
  TrendingUp,
  ExternalLink,
  Download,
  Share2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  QrCode,
} from 'lucide-react'
import QRCheckScanner from '@/components/QRCheckScanner'

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

export default function SVATPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const t = useTranslations('svat')
  const commonT = useTranslations('common')
  const prefill = prefillFromParams(use(searchParams))
  const [activeTab, setActiveTab] = useState<'website' | 'vat' | 'qr'>(prefill.tab)
  const [input, setInput] = useState(prefill.value)
  const [result, setResult] = useState<SVATResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/svat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), mode: activeTab === 'vat' ? 'vat' : 'website' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || 'Verification failed')
      }

      const data = await res.json()
      setResult(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred'
      setError(message === 'invalidUrl' ? t('invalidUrl') : message)
    } finally {
      setLoading(false)
    }
  }

  // Controlli sull'azienda (partita IVA): il testo è tradotto con i dati VIES
  const isCompanyCheck = (c: SVATCheck) => COMPANY_CHECKS.includes(c.id)
  const detailText = (c: SVATCheck) =>
    isCompanyCheck(c) && c.detailsKey && t.has(c.detailsKey) ? t(c.detailsKey, c.detailsInterp) : c.details
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

  const exportToPDF = () => {
    if (!result) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(`
      <html>
        <head>
          <title>SVAT Report - ${result.domain || result.input}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .score { font-size: 48px; font-weight: bold; }
            .badge-${result.badge} { color: ${result.badge === 'green' ? '#16a34a' : result.badge === 'yellow' ? '#ca8a04' : '#dc2626'}; }
          </style>
        </head>
        <body>
          <h1>SVAT - Anti-Fraud Verification Report</h1>
          <h2>${result.domain || result.input}</h2>
          <p>Reliability Score: <span class="score badge-${result.badge}">${result.score}/100</span></p>
          <p>Badge: ${result.badge.toUpperCase()}</p>
          <h3>Checks Summary</h3>
          <ul>
            <li>Total checks: ${result.summary.totalChecks}</li>
            <li>OK: ${result.summary.okCount}</li>
            <li>Warnings: ${result.summary.warningCount}</li>
            <li>Risks: ${result.summary.riskCount}</li>
          </ul>
          <h3>Detailed Results</h3>
          ${result.checks.map((c) => `
            <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
              <strong>${t(c.name)}</strong> - Status: ${c.status.toUpperCase()}
              <p>${detailText(c)}</p>
              ${c.source ? `<p>Source: ${c.source}</p>` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <ShieldCheck className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

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
          <div className="space-y-8">
            {/* Score Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 text-center">
              <h3 className="text-lg font-semibold text-[var(--muted)] mb-2">{t('scoreTitle')}</h3>
              <div className={`text-6xl font-bold mb-2 ${getScoreColor(result.score)}`}>
                {result.score}
                <span className="text-2xl text-[var(--muted)]">/{t('scoreRange')}</span>
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

            {!isCompany && (
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
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{c.details}</p>
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
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{c.details}</p>
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
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{c.details}</p>
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
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{c.details}</p>
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
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{c.details}</p>
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
                            <p className="text-sm text-[var(--muted)] mt-1 break-words">{c.details}</p>
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
                {result.checks.map((c) => (
                  <div key={c.id} className="flex flex-col gap-1 p-3 rounded-xl border border-[var(--gold)]/15 hover:bg-[var(--gold-pale)]/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="flex items-center gap-3">
                      <StatusIcon status={c.status} />
                      <span className="font-medium text-[var(--ink)]">{t(c.name)}</span>
                    </div>
                    <span className="text-sm text-[var(--muted)] break-words sm:text-right">{detailText(c)}</span>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* Summary */}
            {!isCompany && (
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
              <button
                onClick={exportToPDF}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-[var(--gold)]/40 hover:border-[var(--gold)] text-[var(--ink)] rounded-xl font-medium transition-all"
              >
                <Download className="w-5 h-5" />
                {t('exportPDF')}
              </button>
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
