'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, Check, LoaderCircle, SwitchCamera, X } from 'lucide-react'
import { checkLive, liveChecksFor, loadLiveFace, type LiveKind, type LiveResult } from '@/lib/fototessera/live'

// Scatto guidato (Fototessera e foto profilo): fotocamera dal vivo con
// l'ovale, i controlli (verde = va bene) e un consiglio alla volta. Quando
// tutto va bene per un attimo parte il conto alla rovescia e la foto si
// scatta da sola; «Scatta ora» resta sempre disponibile. Con la foto arriva
// anche la posizione del viso (per il ritaglio del profilo). Il video non
// esce dal dispositivo.

export type FaceBox = { cx: number; cy: number; len: number }

const CHECK_EVERY_MS = 110
const STEADY_MS = 900
const COUNT_FROM = 3
const COUNT_STEP_MS = 750
const SMALL_W = 160

type State = 'starting' | 'live' | 'denied' | 'error'

export default function SmartCamera({ onPhoto, onClose, kind = 'id' }: { onPhoto: (photo: File, face: FaceBox | null) => void; onClose: () => void; kind?: LiveKind }) {
  const t = useTranslations('fototessera')
  const checks = liveChecksFor(kind)
  const boxRef = useRef<FaceBox | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('user')
  const [state, setState] = useState<State>('starting')
  const [result, setResult] = useState<LiveResult | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [flash, setFlash] = useState(false)
  const onPhotoRef = useRef(onPhoto)
  useEffect(() => {
    onPhotoRef.current = onPhoto
  }, [onPhoto])

  // Foto a piena risoluzione, non a specchio (la fototessera è la persona com'è)
  // Uno scatto solo: «Scatta ora» e il conto alla rovescia non scattano due volte
  const shotRef = useRef(false)
  const shoot = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth || shotRef.current) return
    shotRef.current = true
    const c = document.createElement('canvas')
    c.width = video.videoWidth
    c.height = video.videoHeight
    c.getContext('2d')!.drawImage(video, 0, 0)
    setFlash(true)
    navigator.vibrate?.(40)
    const face = boxRef.current
    c.toBlob((blob) => blob && onPhotoRef.current(new File([blob], 'foto.jpg', { type: 'image/jpeg' }), face), 'image/jpeg', 0.95)
  }, [])

  useEffect(() => {
    let alive = true
    let stream: MediaStream | null = null
    let raf = 0
    let lastCheck = 0
    let goodSince = 0
    let countFrom = 0
    let lastKey = ''
    let lastCount: number | null = null
    const small = document.createElement('canvas')
    const sctx = small.getContext('2d', { willReadFrequently: true })

    const run = async () => {
      try {
        // Fotocamera e riconoscimento insieme; se il riconoscimento non parte
        // la fotocamera si spegne (altrimenti resterebbe accesa)
        const streamP = navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
        const face = await loadLiveFace().catch((e) => {
          streamP.then((s) => s.getTracks().forEach((tr) => tr.stop())).catch(() => {})
          throw e
        })
        const s = await streamP
        if (!alive) return s.getTracks().forEach((tr) => tr.stop())
        stream = s
        const video = videoRef.current!
        video.srcObject = s
        await video.play().catch(() => {})
        if (!alive) return
        setState('live')

        const tick = () => {
          raf = requestAnimationFrame(tick)
          const now = performance.now()
          if (now - lastCheck < CHECK_EVERY_MS || video.readyState < 2 || !video.videoWidth) return
          lastCheck = now
          const W = video.videoWidth
          const H = video.videoHeight
          let img: ImageData | null = null
          if (sctx) {
            small.width = SMALL_W
            small.height = Math.round((SMALL_W * H) / W)
            sctx.drawImage(video, 0, 0, small.width, small.height)
            img = sctx.getImageData(0, 0, small.width, small.height)
          }
          const res = checkLive(face.detectForVideo(video, now).faceLandmarks ?? [], W, H, img, kind)
          boxRef.current = res.box ?? null
          const key = `${res.hint}|${checks.map((c) => (res.ok[c] ? 1 : 0)).join('')}`
          if (key !== lastKey) {
            lastKey = key
            setResult(res)
          }

          // Tutto a posto per un attimo: conto alla rovescia; se qualcosa cambia si ricomincia
          let next: number | null = null
          if (!res.hint) {
            goodSince ||= now
            if (now - goodSince > STEADY_MS) {
              countFrom ||= now
              const left = COUNT_FROM - Math.floor((now - countFrom) / COUNT_STEP_MS)
              if (left <= 0) {
                cancelAnimationFrame(raf)
                shoot()
                return
              }
              next = left
            }
          } else {
            goodSince = 0
            countFrom = 0
          }
          if (next !== lastCount) {
            lastCount = next
            setCount(next)
          }
        }
        tick()
      } catch (e) {
        if (!alive) return
        const name = (e as DOMException)?.name
        setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    }
    void run()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((tr) => tr.stop())
    }
  }, [facing, shoot, kind, checks])

  const hint = result?.hint
  const message = state !== 'live' ? null : count !== null ? t('liveAllGood') : hint ? t(`live_${hint}`) : t('liveAllGood')

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={t(kind === 'profile' ? 'selfieTitle' : 'smartTitle')}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className={`h-full w-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />

        {/* Ovale guida, sempre verticale come un viso (anche sullo schermo largo del
            computer); fuori un velo scuro. Verde quando tutto va bene */}
        {state === 'live' && (
          <span
            className={`pointer-events-none absolute left-1/2 top-[44%] aspect-[3/4] h-[54%] max-w-[86%] [@media(orientation:landscape)]:top-[47%] [@media(orientation:landscape)]:h-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors ${hint || !result ? 'border-white/85' : 'border-emerald-400'}`}
            aria-hidden
          />
        )}

        {message && (
          <p className={`absolute inset-x-4 top-[max(16px,env(safe-area-inset-top))] mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-base font-bold shadow-lg ${hint && count === null ? 'bg-white text-[var(--ink)]' : 'bg-emerald-500 text-white'}`} role="status">
            {message}
          </p>
        )}
        {count !== null && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl font-black text-white [text-shadow:0_4px_18px_rgba(0,0,0,0.6)]">{count}</span>}
        {flash && <span className="pointer-events-none absolute inset-0 bg-white" />}

        {state !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'starting' ? (
              <>
                <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold-bright)]" />
                <p className="text-sm">{t('liveLoading')}</p>
              </>
            ) : (
              <p className="max-w-sm text-sm text-amber-200">{t(state === 'denied' ? 'liveDenied' : 'liveError')}</p>
            )}
          </div>
        )}
      </div>

      {/* Controlli e pulsanti */}
      <div className="space-y-3 bg-black px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {state === 'live' && (
          <ul className="flex flex-wrap justify-center gap-1.5" aria-label={t('checksTitle')}>
            {checks.map((c) => {
              const good = !!result?.ok[c]
              return (
                <li key={c} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${good ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/70'}`}>
                  {good ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-white/50" />}
                  {t(`liveCheck_${c}`)}
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label={t('liveClose')} title={t('liveClose')}>
            <X className="h-5 w-5" />
          </button>
          <button type="button" disabled={state !== 'live'} onClick={shoot} className="flex h-14 items-center gap-2 rounded-full bg-white px-6 font-bold text-[var(--ink)] disabled:opacity-40">
            <Camera className="h-5 w-5" /> {t('liveShootNow')}
          </button>
          <button
            type="button"
            onClick={() => {
              setState('starting')
              setResult(null)
              setCount(null)
              setFacing((f) => (f === 'user' ? 'environment' : 'user'))
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label={t('liveSwitch')}
            title={t('liveSwitch')}
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
