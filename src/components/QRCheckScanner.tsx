'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Camera,
  Upload,
  QrCode,
  X,
  LoaderCircle,
  ExternalLink,
  Flag,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  RefreshCw,
} from 'lucide-react'

interface QRIndicator {
  type: 'ok' | 'warning' | 'risk'
  key: string
  params?: Record<string, string>
}

interface QRAnalysis {
  type: 'url' | 'phone' | 'sms' | 'email' | 'vcard' | 'wifi' | 'geo' | 'payment' | 'text'
  raw: string
  data: Record<string, string>
  analysis: {
    riskScore: number
    badge: 'green' | 'yellow' | 'red'
    indicators: QRIndicator[]
    redirectChain?: Array<{ url: string; final: boolean }>
    recommendations: string[]
    aiExplanation: string
  }
  communitySignals?: {
    totalReports: number
    phishing: number
    scam: number
    impersonation: number
    other: number
  }
}

const TYPE_LABEL_KEY: Record<QRAnalysis['type'], string> = {
  url: 'typeUrl',
  phone: 'typePhone',
  sms: 'typeSms',
  email: 'typeEmail',
  vcard: 'typeVcard',
  wifi: 'typeWifi',
  geo: 'typeGeo',
  payment: 'typePayment',
  text: 'typeText',
}

function getDestination(result: QRAnalysis): string {
  switch (result.type) {
    case 'url':
      return result.data.url || result.raw
    case 'phone':
      return result.data.phone || result.raw
    case 'sms':
      return result.data.phone || result.raw
    case 'email':
      return result.data.address || result.raw
    case 'vcard':
      return result.data.name || result.raw
    case 'wifi':
      return result.data.ssid || result.raw
    case 'geo':
      return `${result.data.latitude}, ${result.data.longitude}`
    case 'payment':
      return result.data.address || result.raw
    default:
      return result.data.text || result.raw
  }
}

function IndicatorIcon({ type }: { type: 'ok' | 'warning' | 'risk' }) {
  if (type === 'ok') return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
  if (type === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
  return <XCircle className="h-4 w-4 text-red-500 shrink-0" />
}

const REPORT_TYPES = ['phishing', 'scam', 'impersonation'] as const

export default function QRCheckScanner() {
  const t = useTranslations('svat.qrCheck')

  const [cameraActive, setCameraActive] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QRAnalysis | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportSent, setReportSent] = useState(false)
  const [reportError, setReportError] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // jsqr caricato alla prima scansione, fuori dal bundle iniziale
  const jsqrRef = useRef<typeof import('jsqr').default | null>(null)
  const loadJsQR = useCallback(async () => {
    if (!jsqrRef.current) jsqrRef.current = (await import('jsqr')).default
    return jsqrRef.current
  }, [])

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const analyze = useCallback(async (qrData: string) => {
    setAnalyzing(true)
    setError(null)
    setResult(null)
    setReportOpen(false)
    setReportSent(false)
    setReportError(false)
    try {
      const res = await fetch('/api/svat/qr-decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || 'Analysis failed')
      }
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    setResult(null)
    try {
      loadJsQR().catch(() => {})
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCameraActive(true)

      function tick() {
        const video = videoRef.current
        const canvas = canvasRef.current
        const jsQR = jsqrRef.current
        if (!video || !canvas || !jsQR || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          rafRef.current = requestAnimationFrame(tick)
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          stopCamera()
          analyze(code.data)
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        rafRef.current = requestAnimationFrame(tick)
      })
    } catch {
      setError(t('allowCamera'))
    }
  }, [t, analyze, stopCamera, loadJsQR])

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      setResult(null)
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = async () => {
        const canvas = canvasRef.current
        URL.revokeObjectURL(url)
        if (!canvas) return
        let jsQR: typeof import('jsqr').default
        try {
          jsQR = await loadJsQR()
        } catch {
          setError(t('noQRFound'))
          return
        }
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          analyze(code.data)
        } else {
          setError(t('noQRFound'))
        }
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        setError(t('noQRFound'))
      }
      img.src = url
    },
    [analyze, t, loadJsQR]
  )

  const reset = () => {
    stopCamera()
    setResult(null)
    setError(null)
    setReportOpen(false)
    setReportSent(false)
    setReportError(false)
  }

  const submitReport = async (type: (typeof REPORT_TYPES)[number]) => {
    if (!result) return
    setReportError(false)
    try {
      const res = await fetch('/api/svat/qr-decode/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData: result.raw, type }),
      })
      if (res.ok) {
        setReportSent(true)
        setReportOpen(false)
      } else {
        setReportError(true)
      }
    } catch {
      setReportError(true)
    }
  }

  const riskLevelKey =
    result?.analysis.badge === 'green' ? 'riskLow' : result?.analysis.badge === 'yellow' ? 'riskMedium' : 'riskHigh'
  const aiExplanationKey =
    result?.analysis.badge === 'green'
      ? 'aiExplanationLowRisk'
      : result?.analysis.badge === 'yellow'
        ? 'aiExplanationMediumRisk'
        : 'aiExplanationHighRisk'
  const riskColor =
    result?.analysis.badge === 'green'
      ? 'text-green-600 bg-green-100'
      : result?.analysis.badge === 'yellow'
        ? 'text-amber-700 bg-amber-100'
        : 'text-red-600 bg-red-100'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <QrCode className="w-5 h-5 text-[var(--gold)]" />
        <h3 className="text-lg font-semibold text-[var(--ink)]">{t('title')}</h3>
      </div>
      <p className="text-sm text-[var(--muted)] mb-6">{t('subtitle')}</p>

      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {cameraActive && (
        <div className="relative rounded-xl overflow-hidden bg-black mb-4">
          <video ref={videoRef} className="w-full max-h-96 object-contain" muted playsInline />
          <button
            onClick={stopCamera}
            className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full p-2 shadow"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-[var(--ink)]" />
          </button>
        </div>
      )}

      {!cameraActive && !analyzing && !result && !error && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={startCamera}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all"
          >
            <Camera className="w-5 h-5" />
            {t('scanCamera')}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-4 bg-white border border-[var(--gold)]/40 hover:border-[var(--gold)] text-[var(--ink)] rounded-xl font-semibold transition-all"
          >
            <Upload className="w-5 h-5" />
            {t('uploadImage')}
          </button>
        </div>
      )}

      {analyzing && (
        <div className="text-center py-10">
          <LoaderCircle className="w-10 h-10 text-[var(--gold)] mx-auto mb-3 animate-spin" />
          <p className="text-[var(--muted)]">{t('scanning')}</p>
        </div>
      )}

      {error && !analyzing && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <XCircle className="w-5 h-5 text-red-600 mx-auto mb-2" />
          <p className="text-red-800 text-sm">{error}</p>
          <button
            onClick={reset}
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:text-[var(--gold)] hover:underline"
          >
            <RefreshCw className="w-4 h-4" />
            {t('uploadImage')}
          </button>
        </div>
      )}

      {result && !analyzing && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wide">
              {t(TYPE_LABEL_KEY[result.type])}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${riskColor}`}>{t(riskLevelKey)}</span>
          </div>

          <div className="bg-[var(--gold-pale)]/60 border border-[var(--gold)]/20 rounded-xl p-4">
            <p className="text-xs text-[var(--muted)] mb-1">{t('destination')}</p>
            <p className="font-medium text-[var(--ink)] break-all">{getDestination(result)}</p>
          </div>

          <p className="text-sm text-[var(--muted)]">{t(aiExplanationKey)}</p>

          {result.analysis.redirectChain && result.analysis.redirectChain.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">{t('redirect')}</p>
              <div className="space-y-1">
                {result.analysis.redirectChain.map((hop, i) => (
                  <p key={i} className="text-sm text-[var(--muted)] break-all">
                    {i > 0 && `${t('redirectTo')} → `}
                    {hop.url}
                  </p>
                ))}
              </div>
            </div>
          )}

          {result.analysis.indicators.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-2">
                {t('riskIndicators')}
              </p>
              <div className="space-y-2">
                {result.analysis.indicators.map((ind, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[var(--ink)]">
                    <IndicatorIcon type={ind.type} />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <span>{t(ind.key as any, ind.params as any)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.analysis.recommendations.length > 0 && (
            <div className="bg-[var(--gold-pale)] border border-[var(--gold)]/30 rounded-xl p-4 space-y-1">
              {result.analysis.recommendations.map((rec, i) => (
                <p key={i} className="text-sm text-[var(--ink)]">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  • {t(rec as any)}
                </p>
              ))}
            </div>
          )}

          {result.communitySignals && result.communitySignals.totalReports > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                <Users className="w-4 h-4" />
                {t('communityReport')}
              </div>
              <p className="text-sm text-red-700">
                {t('communityReports', { count: result.communitySignals.totalReports })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            {result.type === 'url' && (
              <a
                href={getDestination(result)}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                  result.analysis.badge === 'red'
                    ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    : 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-md hover:brightness-105'
                }`}
              >
                <ExternalLink className="w-4 h-4" />
                {result.analysis.badge === 'red' ? t('openAnyway') : t('visitSite')}
              </a>
            )}

            {!reportSent ? (
              <div className="relative">
                <button
                  onClick={() => setReportOpen((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-white border border-[var(--gold)]/40 text-[var(--ink)] hover:border-[var(--gold)] transition-all"
                >
                  <Flag className="w-4 h-4" />
                  {t('reportIssue')}
                </button>
                {reportOpen && (
                  <div className="absolute z-10 mt-2 bg-white border border-[var(--gold)]/25 rounded-xl shadow-lg overflow-hidden min-w-40">
                    {REPORT_TYPES.map((rt) => (
                      <button
                        key={rt}
                        onClick={() => submitReport(rt)}
                        className="block w-full text-left px-4 py-2 text-sm text-[var(--ink)] hover:bg-[var(--gold-pale)]"
                      >
                        {t(rt === 'impersonation' ? 'impersonationReport' : rt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                {t('reportSuccess')}
              </span>
            )}
            {reportError && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <XCircle className="w-4 h-4" />
                {t('reportError')}
              </span>
            )}

            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              {t('uploadImage')}
            </button>
          </div>

          <p className="text-xs text-[var(--muted)] text-center pt-2">{t('disclaimer')}</p>
        </div>
      )}
    </div>
  )
}
