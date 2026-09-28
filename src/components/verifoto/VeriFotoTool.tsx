'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, ExternalLink, ImageUp, Info, LoaderCircle, Pencil, ScanEye, ShieldAlert, Sparkles } from 'lucide-react'
import { RISK_HIGH, RISK_LOW, buildClues, verdictOf, type CameraInfo, type Clue, type DetectorResult, type ProvenanceScan } from '@/lib/verifoto'
import { detectorCopy, errorLevelMap, readCamera, scanProvenance } from '@/lib/verifotoBrowser'

const MAX_FILE = 15 * 1024 * 1024
const ACCEPTED = /^image\/(jpeg|png|webp)$/

type Analysis = { scan: ProvenanceScan; camera: CameraInfo; ela: string | null }

// VeriFoto: la foto resta sul dispositivo per i controlli di base; solo con
// il consenso dell'utente una copia ridotta va al rilevatore AI esterno.
export default function VeriFotoTool({
  detectorConfigured,
  leftToday: initialLeft,
  quotaAvailable,
}: {
  detectorConfigured: boolean
  leftToday: number
  quotaAvailable: boolean
}) {
  const t = useTranslations('verifoto')
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [view, setView] = useState<'original' | 'ela'>('original')
  const [consent, setConsent] = useState(false)
  const [detector, setDetector] = useState<DetectorResult | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [leftToday, setLeftToday] = useState(initialLeft)

  // Libera l'anteprima quando cambia foto o si esce dalla pagina
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  // Ogni nuova foto invalida le risposte ancora in arrivo per la precedente
  const photoId = useRef(0)

  const onFile = useCallback(async (file: File | undefined) => {
    if (!file) return
    photoId.current += 1
    setError(null)
    setDetector(null)
    setAnalysis(null)
    setView('original')
    if (!ACCEPTED.test(file.type) || file.size > MAX_FILE) {
      setError(t('invalidFile'))
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setBusy(true)
    try {
      const [buffer, camera, ela] = await Promise.all([file.arrayBuffer(), readCamera(file), errorLevelMap(url)])
      const scan = scanProvenance(buffer, camera.software)
      setAnalysis({ scan, camera, ela })
    } catch {
      setError(t('invalidFile'))
    } finally {
      setBusy(false)
    }
  }, [t])

  const runDetector = async () => {
    if (!previewUrl || !consent) return
    const id = photoId.current
    setDetecting(true)
    try {
      const copy = await detectorCopy(previewUrl)
      if (!copy) {
        if (id === photoId.current) setDetector({ status: 'error' })
        return
      }
      const body = new FormData()
      body.append('image', copy, 'photo.jpg')
      const res = await fetch('/api/verifoto/check', { method: 'POST', body })
      const result = (await res.json().catch(() => ({ status: 'error' }))) as DetectorResult
      if (result.status === 'ok') setLeftToday((n) => Math.max(0, n - 1))
      if (result.status === 'user_limit') setLeftToday(0)
      if (id === photoId.current) setDetector(result)
    } catch {
      if (id === photoId.current) setDetector({ status: 'error' })
    } finally {
      setDetecting(false)
    }
  }

  const clues: Clue[] = useMemo(
    () => (analysis ? buildClues(analysis.scan, analysis.camera, detector) : []),
    [analysis, detector],
  )
  const { verdict, score } = useMemo(() => verdictOf(clues), [clues])

  const verdictStyle = {
    ai: { box: 'border-red-200 bg-red-50', text: 'text-red-800', icon: <ShieldAlert className="h-8 w-8 text-red-600" />, bar: 'bg-red-500' },
    uncertain: { box: 'border-amber-200 bg-amber-50', text: 'text-amber-900', icon: <AlertTriangle className="h-8 w-8 text-amber-500" />, bar: 'bg-amber-500' },
    likely_real: { box: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-800', icon: <CheckCircle2 className="h-8 w-8 text-emerald-600" />, bar: 'bg-emerald-500' },
  }[verdict]

  const signalIcon = (clue: Clue) =>
    clue.signal === 'ai' ? (
      <Sparkles className="h-4 w-4 text-red-500" />
    ) : clue.signal === 'real' ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    ) : clue.signal === 'edited' ? (
      <Pencil className="h-4 w-4 text-amber-500" />
    ) : (
      <Info className="h-4 w-4 text-[var(--muted)]" />
    )

  const detectorMessage =
    detector && detector.status !== 'ok' ? t(`detector_${detector.status}`) : null
  const canDetect = detectorConfigured && quotaAvailable && leftToday > 0 && (!detector || detector.status === 'unavailable' || detector.status === 'error')

  return (
    <div className="space-y-6">
      {/* Caricamento */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          onFile(e.dataTransfer.files?.[0])
        }}
        className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white p-6 text-center shadow-sm sm:p-8"
      >
        <ImageUp className="mx-auto h-10 w-10 text-[var(--gold)]" />
        <p className="mt-3 font-semibold text-[var(--ink)]">{t('uploadTitle')}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('uploadHint')}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md hover:brightness-105"
        >
          <ImageUp className="h-5 w-5" /> {previewUrl ? t('changePhoto') : t('uploadButton')}
        </button>
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      </div>

      {busy && (
        <div className="flex items-center justify-center gap-2 py-8 text-[var(--muted)]">
          <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" /> {t('analyzing')}
        </div>
      )}

      {analysis && previewUrl && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Foto e mappa dei ritocchi */}
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
            <div className="mb-3 flex gap-2">
              {(['original', 'ela'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={key === 'ela' && !analysis.ela}
                  onClick={() => setView(key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    view === key ? 'bg-[var(--ink)] text-white' : 'border border-gray-200 text-gray-700 disabled:opacity-40'
                  }`}
                >
                  {key === 'original' ? t('tabOriginal') : t('tabEla')}
                </button>
              ))}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view === 'ela' && analysis.ela ? analysis.ela : previewUrl}
              alt=""
              className="max-h-[480px] w-full rounded-xl bg-gray-50 object-contain"
            />
            {view === 'ela' && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t('elaHint')}</p>}
          </div>

          <div className="space-y-4">
            {/* Verdetto */}
            <div className={`rounded-2xl border p-5 ${verdictStyle.box}`}>
              <div className="flex items-start gap-3">
                {verdictStyle.icon}
                <div className="min-w-0">
                  <p className={`text-lg font-bold ${verdictStyle.text}`}>{t(`verdict_${verdict}`)}</p>
                  <p className={`mt-1 text-sm ${verdictStyle.text}`}>{t(`verdictText_${verdict}`)}</p>
                </div>
              </div>
              {/* Rischio: numero grande, scala a tre fasce e spiegazione */}
              <div className="mt-5 rounded-xl bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('riskLabel')}</p>
                <p className={`mt-1 text-5xl font-black leading-none ${verdictStyle.text}`}>
                  {score}
                  <span className="text-2xl font-bold">%</span>
                </p>
                <p className={`mt-1 text-sm font-semibold ${verdictStyle.text}`}>
                  {score >= RISK_HIGH ? t('riskHigh') : score <= RISK_LOW ? t('riskLow') : t('riskMedium')}
                </p>
                <div className="relative mt-4">
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <div className="bg-emerald-400" style={{ width: `${RISK_LOW}%` }} />
                    <div className="bg-amber-400" style={{ width: `${RISK_HIGH - RISK_LOW}%` }} />
                    <div className="flex-1 bg-red-500" />
                  </div>
                  <div
                    className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--ink)] ring-2 ring-white"
                    style={{ left: `${score}%` }}
                    aria-hidden="true"
                  />
                  <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-gray-500">
                    <span>{t('scaleLow')}</span>
                    <span>{t('scaleMedium')}</span>
                    <span>{t('scaleHigh')}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-gray-600">{t('riskExplain')}</p>
              </div>
            </div>

            {/* Indizi */}
            <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
              <p className="mb-3 font-bold text-[var(--ink)]">{t('cluesTitle')}</p>
              <ul className="space-y-3">
                {clues.map((clue) => (
                  <li key={clue.id} className="flex gap-3">
                    <span className="mt-0.5">{signalIcon(clue)}</span>
                    <div className="min-w-0 text-sm">
                      <p className="text-[var(--ink)]">{t(clue.textKey, clue.values ?? {})}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {t(`signal_${clue.signal}`)} · {clue.source}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Rilevatore AI esterno */}
            <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
                <ScanEye className="h-5 w-5 text-[var(--gold)]" /> {t('detectorTitle')}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t('detectorText')}</p>
              {detector?.status === 'ok' && detector.generator && (
                <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{t('detectorLikelyTool', { tool: detector.generator })}</p>
              )}
              {detectorMessage && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{detectorMessage}</p>}
              {!detectorConfigured ? (
                <p className="mt-2 text-sm text-[var(--muted)]">{t('detector_unavailable')}</p>
              ) : !quotaAvailable ? (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('detector_quota')}</p>
              ) : (
                (!detector || detector.status === 'unavailable' || detector.status === 'error') && (
                  <>
                    <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span>{t('detectorConsent')}</span>
                    </label>
                    <button
                      type="button"
                      disabled={!canDetect || !consent || detecting}
                      onClick={runDetector}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-50"
                    >
                      {detecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-[var(--gold-bright)]" />}
                      {detecting ? t('detectorRunning') : t('detectorButton')}
                    </button>
                    <p className="mt-2 text-center text-xs text-[var(--muted)]">{t('detectorLeft', { count: leftToday })}</p>
                  </>
                )
              )}
            </div>

            {/* Controlli manuali gratuiti */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="font-bold text-[var(--ink)]">{t('manualTitle')}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t('manualText')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['https://lens.google.com/', t('openLens')],
                  ['https://tineye.com/', t('openTineye')],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-gray-50"
                  >
                    {label} <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs leading-5 text-[var(--muted)]">{t('disclaimer')}</p>
    </div>
  )
}
