'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import CommunityWarning from '@/components/scamNet/CommunityWarning'
import ScamCardCaptured from '@/components/scamCards/ScamCardCaptured'
import type { CapturedCard } from '@/lib/scamCards/capture'
import { reportHref } from '@/lib/scamNet'
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
  ShieldAlert,
  ShieldCheck,
  ArrowDown,
  ChevronDown,
  Lock,
  LockOpen,
} from 'lucide-react'
import { askConfirm } from '@/lib/confirm'

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
    landing?: { from: string; to: string }
    phishing?: { brand: string; domain: string; official: string; card: boolean }
    site?: { host: string; https: boolean; exists: boolean }
    recommendations: string[]
    aiExplanation: string
  }
  scamCard?: CapturedCard | null
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
  if (type === 'ok') return <CheckCircle className="mt-0.5 h-5 w-5 text-green-600 shrink-0" />
  if (type === 'warning') return <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
  return <XCircle className="mt-0.5 h-5 w-5 text-red-600 shrink-0" />
}

// Colori del verdetto
const TONES = {
  red: { band: 'bg-red-600', soft: 'bg-red-50', border: 'border-red-300', text: 'text-red-800' },
  yellow: { band: 'bg-amber-500', soft: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-900' },
  green: { band: 'bg-green-600', soft: 'bg-green-50', border: 'border-green-300', text: 'text-green-900' },
} as const

// Un gruppo di segnali (pericolo o da tenere d'occhio), uno per riga, ben leggibili sul telefono
function IndicatorGroup({ title, items, t, tone }: { title: string; items: QRIndicator[]; t: ReturnType<typeof useTranslations>; tone: 'risk' | 'warning' }) {
  const box = tone === 'risk' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
  const head = tone === 'risk' ? 'text-red-700' : 'text-amber-800'
  return (
    <div>
      <p className={`mb-2 text-sm font-extrabold uppercase tracking-wide ${head}`}>
        {title} ({items.length})
      </p>
      <ul className="space-y-2">
        {items.map((ind, i) => (
          <li key={i} className={`flex items-start gap-3 rounded-xl border p-3 text-[15px] leading-snug text-[var(--ink)] ${box}`}>
            <IndicatorIcon type={ind.type} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <span className="min-w-0 break-words">{t(ind.key as any, ind.params as any)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function QRCheckScanner() {
  const t = useTranslations('svat.qrCheck')

  const [cameraActive, setCameraActive] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<QRAnalysis | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Dal vivo: contorno e bollino disegnati sopra il QR inquadrato; ogni QR si
  // controlla una volta sola (risultati tenuti qui) e la fotocamera resta accesa
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const liveCache = useRef(new Map<string, QRAnalysis | 'loading' | 'error'>())
  const [live, setLive] = useState<{ data: string; state: QRAnalysis | 'loading' | 'error' } | null>(null)
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

  // Controllo di un QR visto dal vivo, senza fermare la fotocamera
  const analyzeLive = useCallback(async (qrData: string) => {
    liveCache.current.set(qrData, 'loading')
    setLive({ data: qrData, state: 'loading' })
    let state: QRAnalysis | 'error' = 'error'
    try {
      const res = await fetch('/api/svat/qr-decode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qrData }) })
      if (res.ok) state = (await res.json()) as QRAnalysis
    } catch {
      // resta «error»: si potrà riprovare inquadrandolo di nuovo
    }
    if (state === 'error') liveCache.current.delete(qrData)
    else liveCache.current.set(qrData, state)
    setLive((prev) => (prev?.data === qrData ? { data: qrData, state } : prev))
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    setResult(null)
    setLive(null)
    try {
      loadJsQR().catch(() => {})
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCameraActive(true)
      let lastSeen = 0

      // Contorno del QR e bollino colorato sopra, nelle misure del video
      function drawOverlay(code: { data: string; location: Record<'topLeftCorner' | 'topRightCorner' | 'bottomRightCorner' | 'bottomLeftCorner', { x: number; y: number }> } | null, w: number, h: number) {
        const overlay = overlayRef.current
        if (!overlay) return
        if (overlay.width !== w || overlay.height !== h) {
          overlay.width = w
          overlay.height = h
        }
        const octx = overlay.getContext('2d')
        if (!octx) return
        octx.clearRect(0, 0, w, h)
        if (!code) return
        const state = liveCache.current.get(code.data)
        const badge = state && typeof state === 'object' ? state.analysis.badge : null
        const color = badge === 'red' ? '#dc2626' : badge === 'yellow' ? '#f59e0b' : badge === 'green' ? '#16a34a' : '#ffffff'
        const L = code.location
        const pts = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner]
        const u = Math.max(w, h) / 900
        octx.lineJoin = 'round'
        octx.lineWidth = 8 * u
        octx.strokeStyle = color
        octx.fillStyle = badge ? `${color}33` : 'rgba(255,255,255,0.15)'
        octx.beginPath()
        pts.forEach((p, i) => (i ? octx.lineTo(p.x, p.y) : octx.moveTo(p.x, p.y)))
        octx.closePath()
        octx.fill()
        octx.stroke()
        // Bollino sopra il codice
        const label = badge === 'red' ? `✕ ${t('liveDanger')}` : badge === 'yellow' ? `⚠ ${t('liveWarning')}` : badge === 'green' ? `✓ ${t('liveSafe')}` : t('liveChecking')
        const top = Math.min(...pts.map((p) => p.y))
        const cx = pts.reduce((s, p) => s + p.x, 0) / 4
        octx.font = `800 ${Math.round(34 * u)}px system-ui, sans-serif`
        const tw = octx.measureText(label).width
        const bw = tw + 36 * u
        const bh = 58 * u
        const bx = Math.max(6, Math.min(w - bw - 6, cx - bw / 2))
        const by = Math.max(6, top - bh - 14 * u)
        octx.fillStyle = badge ? color : 'rgba(23,23,23,0.85)'
        octx.beginPath()
        octx.roundRect(bx, by, bw, bh, bh / 2)
        octx.fill()
        octx.fillStyle = badge === 'yellow' ? '#1f1f1f' : '#ffffff'
        octx.textBaseline = 'middle'
        octx.fillText(label, bx + 18 * u, by + bh / 2)
      }

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
        const now = performance.now()
        if (code?.data) {
          lastSeen = now
          // QR nuovo: si controlla (una volta sola) e la fotocamera resta accesa
          const known = liveCache.current.get(code.data)
          if (!known) void analyzeLive(code.data)
          else setLive((prev) => (prev?.data === code.data ? prev : { data: code.data, state: known }))
          drawOverlay(code, canvas.width, canvas.height)
        } else if (now - lastSeen > 700) {
          // QR uscito dall'inquadratura: via il contorno (il risultato resta in basso)
          drawOverlay(null, canvas.width, canvas.height)
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
  }, [t, analyzeLive, loadJsQR])

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
  }

  const riskLevelKey =
    result?.analysis.badge === 'green' ? 'riskLow' : result?.analysis.badge === 'yellow' ? 'riskMedium' : 'riskHigh'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-4 sm:p-8">
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
        <div className="mb-4">
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video ref={videoRef} className="block w-full max-h-[28rem] object-contain" muted playsInline />
            {/* Contorno e bollino sopra il QR, con le stesse misure del video */}
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" aria-hidden />
            {!live && <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-black/60 px-3 py-2 text-center text-sm font-semibold text-white">{t('liveHint')}</p>}
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full p-2 shadow"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-[var(--ink)]" />
            </button>
          </div>
          {/* Ultimo QR controllato: esito in breve e dettagli completi */}
          {live && (
            <div
              className={`mt-3 flex flex-wrap items-center gap-3 rounded-xl border p-3 ${
                typeof live.state === 'object' ? `${TONES[live.state.analysis.badge].soft} ${TONES[live.state.analysis.badge].border}` : 'border-[var(--gold)]/30 bg-[var(--paper)]'
              }`}
              role="status"
            >
              <div className="min-w-0 flex-1">
                <p className={`font-extrabold ${typeof live.state === 'object' ? TONES[live.state.analysis.badge].text : 'text-[var(--ink)]'}`}>
                  {live.state === 'loading'
                    ? t('liveChecking')
                    : live.state === 'error'
                      ? t('liveError')
                      : t(live.state.analysis.badge === 'red' ? 'liveDanger' : live.state.analysis.badge === 'yellow' ? 'liveWarning' : 'liveSafe')}
                </p>
                <p className="truncate text-xs text-[var(--muted)]">{live.data}</p>
              </div>
              {typeof live.state === 'object' && (
                <button
                  type="button"
                  onClick={() => {
                    const full = live.state as QRAnalysis
                    stopCamera()
                    setResult(full)
                  }}
                  className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-[var(--gold-bright)]"
                >
                  {t('liveDetails')}
                </button>
              )}
            </div>
          )}
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

      {result && !analyzing && (() => {
        const badge = result.analysis.badge
        const tone = TONES[badge]
        const VerdictIcon = badge === 'green' ? ShieldCheck : badge === 'yellow' ? AlertTriangle : ShieldAlert
        const risks = result.analysis.indicators.filter((i) => i.type === 'risk')
        const warnings = result.analysis.indicators.filter((i) => i.type === 'warning')
        const oks = result.analysis.indicators.filter((i) => i.type === 'ok')
        const score = Math.max(0, Math.min(100, Math.round(result.analysis.riskScore)))
        const site = result.analysis.site
        return (
          <div className="space-y-4 sm:space-y-5">
            {/* Il verdetto, grande e colorato: la prima cosa da capire */}
            <div role={badge === 'red' ? 'alert' : undefined} className={`overflow-hidden rounded-2xl border-2 shadow-md ${tone.border} ${tone.soft}`}>
              <div className={`flex items-center gap-3 px-4 py-4 text-white sm:px-6 sm:py-5 ${tone.band}`}>
                <VerdictIcon className={`h-11 w-11 shrink-0 sm:h-12 sm:w-12 ${badge === 'red' ? 'motion-safe:animate-pulse' : ''}`} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-white/85">{t(riskLevelKey)}</p>
                  <p className="text-xl font-extrabold leading-tight sm:text-2xl">{t(`verdictTitle_${badge}`)}</p>
                </div>
              </div>
              <div className="space-y-4 p-4 sm:p-6">
                <p className={`text-base font-medium leading-relaxed ${tone.text}`}>
                  {t(`verdictText_${badge}`, { risk: risks.length, warning: warnings.length })}
                </p>
                {/* Livello di sicurezza 0-100 */}
                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-[var(--ink)]">{t('safetyScore')}</span>
                    <span className={`text-lg font-extrabold ${tone.text}`}>{score}/100</span>
                  </div>
                  <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
                    <div className={`h-full rounded-full ${tone.band}`} style={{ width: `${Math.max(score, 4)}%` }} />
                  </div>
                </div>
                {/* Quanti segnali, per tipo */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-white px-2 py-2.5 ring-1 ring-red-200">
                    <p className="text-2xl font-extrabold text-red-600">{risks.length}</p>
                    <p className="text-[11px] font-semibold leading-tight text-red-800 sm:text-xs">{t('countRisk')}</p>
                  </div>
                  <div className="rounded-xl bg-white px-2 py-2.5 ring-1 ring-amber-200">
                    <p className="text-2xl font-extrabold text-amber-600">{warnings.length}</p>
                    <p className="text-[11px] font-semibold leading-tight text-amber-800 sm:text-xs">{t('countWarning')}</p>
                  </div>
                  <div className="rounded-xl bg-white px-2 py-2.5 ring-1 ring-green-200">
                    <p className="text-2xl font-extrabold text-green-600">{oks.length}</p>
                    <p className="text-[11px] font-semibold leading-tight text-green-800 sm:text-xs">{t('countOk')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dove porta il QR: il nome del sito in grande */}
            <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold-pale)]/60 p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                {t(TYPE_LABEL_KEY[result.type])} · {t('destination')}
              </p>
              {site ? (
                <>
                  <p className="mt-1.5 break-all font-mono text-xl font-extrabold text-[var(--ink)] sm:text-2xl">{site.host}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${site.https ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                      {site.https ? <Lock className="h-3.5 w-3.5" aria-hidden /> : <LockOpen className="h-3.5 w-3.5" aria-hidden />}
                      {t(site.https ? 'httpsYes' : 'httpsNo')}
                    </span>
                    {!site.exists && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                        <XCircle className="h-3.5 w-3.5" aria-hidden /> {t('siteMissing')}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-[var(--muted)]">{t('fullLink')}</p>
                  <p className="break-all font-mono text-sm text-[var(--ink)]">{getDestination(result)}</p>
                </>
              ) : (
                <p className="mt-1.5 break-all text-lg font-bold text-[var(--ink)]">{getDestination(result)}</p>
              )}
            </div>

            {/* Finta pagina di accesso: avviso in evidenza */}
            {result.analysis.phishing && (
              <div role="alert" className="rounded-2xl border-2 border-red-400 bg-red-50 p-4 text-red-900 shadow-md sm:p-5">
                <p className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
                  <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" aria-hidden /> {t('phishingAlertTitle')}
                </p>
                <p className="mt-2 break-words text-base font-medium leading-relaxed">
                  {t(result.analysis.phishing.card ? 'indicatorPhishingCard' : 'indicatorPhishingPage', {
                    brand: result.analysis.phishing.brand,
                    domain: result.analysis.phishing.domain,
                    official: result.analysis.phishing.official,
                  })}
                </p>
              </div>
            )}

            {/* Il link porta su un altro sito: partenza e arrivo ben visibili */}
            {result.analysis.landing && (
              <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 shadow-md sm:p-5">
                <p className="flex items-center gap-2 text-lg font-extrabold sm:text-xl">
                  <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" aria-hidden /> {t('landingTitle')}
                </p>
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">{t('redirectFrom')}</p>
                  <p className="break-all rounded-xl border border-amber-200 bg-white/70 px-4 py-2 font-mono text-sm">{result.analysis.landing.from}</p>
                  <ArrowDown className="mx-auto h-6 w-6 text-amber-600" aria-hidden />
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">{t('redirectDest')}</p>
                  <p className="break-all rounded-xl border-2 border-amber-500 bg-white px-4 py-3 font-mono text-base font-bold text-[var(--ink)]">{result.analysis.landing.to}</p>
                </div>
              </div>
            )}

            {/* Segnali di pericolo e da tenere d'occhio, uno per riga */}
            {risks.length > 0 && <IndicatorGroup title={t('groupRisk')} items={risks} t={t} tone="risk" />}
            {warnings.length > 0 && <IndicatorGroup title={t('groupWarning')} items={warnings} t={t} tone="warning" />}

            {result.analysis.redirectChain && result.analysis.redirectChain.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{t('redirect')}</p>
                <div className="space-y-1">
                  {result.analysis.redirectChain.map((hop, i) => (
                    <p key={i} className="break-all text-sm text-[var(--muted)]">
                      {i > 0 && `${t('redirectTo')} → `}
                      {hop.url}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Cosa fare adesso: passi numerati */}
            {result.analysis.recommendations.length > 0 && (
              <div className={`rounded-2xl p-4 sm:p-5 ${badge === 'red' ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/30 bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
                <p className="text-base font-extrabold">{t('whatToDo')}</p>
                <ol className="mt-3 space-y-2.5">
                  {result.analysis.recommendations.map((rec, i) => (
                    <li key={rec} className="flex gap-3 text-[15px] leading-snug">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${badge === 'red' ? 'bg-[var(--gold-bright)] text-[var(--ink)]' : 'bg-[var(--ink)] text-white'}`}>
                        {i + 1}
                      </span>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <span>{t(rec as any)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Avviso della Rete Anti-Truffa (link, numero o email del QR) */}
            <CommunityWarning items={[{ kind: 'qr', value: result.raw }]} />
            <ScamCardCaptured card={result.scamCard} />

            {result.communitySignals && result.communitySignals.totalReports > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-medium text-red-700">
                  <Users className="h-4 w-4" />
                  {t('communityReport')}
                </div>
                <p className="text-sm text-red-700">{t('communityReports', { count: result.communitySignals.totalReports })}</p>
              </div>
            )}

            {/* Le cose a posto: chiuse, per non distrarre dal pericolo */}
            {oks.length > 0 && (
              <details className="group rounded-2xl border border-green-200 bg-green-50/60 p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-green-800">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" aria-hidden /> {t('groupOk')} ({oks.length})
                  </span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <ul className="mt-3 space-y-2">
                  {oks.map((ind, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--ink)]">
                      <IndicatorIcon type="ok" />
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <span>{t(ind.key as any, ind.params as any)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {/* Azioni: a tutta larghezza sul telefono */}
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
              <Link
                href={reportHref('qr', result.raw)}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${
                  badge === 'red' ? 'bg-red-600 text-white shadow-md hover:bg-red-700' : 'border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]'
                }`}
              >
                <Flag className="h-4 w-4" />
                {t('reportIssue')}
              </Link>
              <button
                onClick={reset}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[var(--ink-soft)]"
              >
                <RefreshCw className="h-4 w-4" />
                {t('scanAnother')}
              </button>
              {result.type === 'url' && badge !== 'red' && (
                <a
                  href={getDestination(result)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-3 text-sm font-bold text-[var(--ink)] shadow-md hover:brightness-105 sm:col-span-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {t('visitSite')}
                </a>
              )}
            </div>
            {/* QR pericoloso: aprirlo resta possibile, ma piccolo e con conferma */}
            {result.type === 'url' && badge === 'red' && (
              <button
                type="button"
                onClick={async () => {
                  if (await askConfirm(t('openAnywayConfirm'))) window.open(getDestination(result), '_blank', 'noopener,noreferrer')
                }}
                className="mx-auto block text-xs text-[var(--muted)] underline hover:text-[var(--ink)]"
              >
                {t('openAnyway')}
              </button>
            )}

            <p className="pt-1 text-center text-xs text-[var(--muted)]">{t('disclaimer')}</p>
          </div>
        )
      })()}
    </div>
  )
}
