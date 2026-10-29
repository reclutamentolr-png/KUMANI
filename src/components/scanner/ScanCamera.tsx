'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, Check, LoaderCircle, SwitchCamera } from 'lucide-react'
import { canvasOf, detectQuad, type Quad } from '@/lib/scanner/image'

// SCANNER, scatto automatico: la fotocamera cerca il foglio dal vivo (stesso
// metodo dei bordi usato dopo lo scatto, senza IA), lo contorna e scatta da
// sola quando il foglio è intero, abbastanza grande e fermo. Si continua con
// le pagine successive; «Fine» chiude. Le foto non lasciano il dispositivo.

const CHECK_EVERY_MS = 220
const SAMPLE_W = 480
const STEADY_MS = 1000
const STILL = 0.018 // spostamento massimo degli angoli (frazione del lato lungo) per «fermo»
const NEW_PAGE = 0.08 // dopo uno scatto si riparte solo con un foglio spostato o cambiato

type Hint = 'noDoc' | 'closer' | 'edges' | 'hold' | 'captured'
type State = 'starting' | 'live' | 'denied' | 'error'

const moved = (a: Quad, b: Quad, side: number) => Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y))) / side

// Area del quadrilatero (formula del laccio)
const area = (q: Quad) => Math.abs(q.reduce((s, p, i) => s + p.x * q[(i + 1) % 4].y - q[(i + 1) % 4].x * p.y, 0)) / 2

export default function ScanCamera({ room, onPhoto, onClose }: { room: number; onPhoto: (photo: File) => void; onClose: () => void }) {
  const t = useTranslations('scanner')
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [facing, setFacing] = useState<'user' | 'environment'>('environment')
  const [state, setState] = useState<State>('starting')
  const [hint, setHint] = useState<Hint>('noDoc')
  const [taken, setTaken] = useState(0)
  const [flash, setFlash] = useState(0)
  const onPhotoRef = useRef(onPhoto)
  const takenRef = useRef(0)
  // Posti liberi all'apertura: le pagine scattate qui li consumano uno a uno
  const roomRef = useRef(room)
  useEffect(() => {
    onPhotoRef.current = onPhoto
  }, [onPhoto])

  // Foto a piena risoluzione: la pagina si raddrizza poi come le altre
  const shoot = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth || takenRef.current >= roomRef.current) return
    const c = canvasOf(video.videoWidth, video.videoHeight)
    c.getContext('2d')!.drawImage(video, 0, 0)
    c.toBlob((blob) => blob && onPhotoRef.current(new File([blob], `pagina-${Date.now()}.jpg`, { type: 'image/jpeg' })), 'image/jpeg', 0.92)
    takenRef.current += 1
    setTaken(takenRef.current)
    setFlash((f) => f + 1)
    navigator.vibrate?.(40)
  }, [])

  // Spazio finito: si chiude da sola
  const [startRoom] = useState(room)
  useEffect(() => {
    if (taken >= startRoom) onClose()
  }, [taken, startRoom, onClose])

  useEffect(() => {
    let alive = true
    let stream: MediaStream | null = null
    let raf = 0
    let lastCheck = 0
    let last: Quad | null = null
    let stillSince = 0
    let lastShot: Quad | null = null
    let lastHint: Hint | null = null
    const sample = canvasOf(SAMPLE_W, SAMPLE_W)

    const say = (h: Hint) => {
      if (h !== lastHint) {
        lastHint = h
        setHint(h)
      }
    }

    const run = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
        if (!alive) return s.getTracks().forEach((tr) => tr.stop())
        stream = s
        const video = videoRef.current!
        video.srcObject = s
        await video.play().catch(() => {})
        // Chiusa mentre il video partiva: niente giro di controlli che resti acceso
        if (!alive) return
        setState('live')

        const tick = () => {
          raf = requestAnimationFrame(tick)
          const now = performance.now()
          if (now - lastCheck < CHECK_EVERY_MS || video.readyState < 2 || !video.videoWidth) return
          lastCheck = now
          const W = video.videoWidth
          const H = video.videoHeight
          sample.width = SAMPLE_W
          sample.height = Math.round((SAMPLE_W * H) / W)
          sample.getContext('2d')!.drawImage(video, 0, 0, sample.width, sample.height)
          const q = detectQuad(sample)
          const side = Math.max(sample.width, sample.height)

          // Contorno del foglio sopra il video (stesse misure del campione)
          const overlay = overlayRef.current
          if (overlay) {
            overlay.width = sample.width
            overlay.height = sample.height
            const ctx = overlay.getContext('2d')!
            ctx.clearRect(0, 0, overlay.width, overlay.height)
            if (q) {
              ctx.beginPath()
              q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
              ctx.closePath()
              ctx.fillStyle = stillSince && now - stillSince > STEADY_MS * 0.4 ? 'rgba(52,211,153,0.22)' : 'rgba(199,154,59,0.18)'
              ctx.fill()
              ctx.lineWidth = 4
              ctx.strokeStyle = stillSince && now - stillSince > STEADY_MS * 0.4 ? '#34d399' : '#E8C76A'
              ctx.stroke()
            }
          }

          if (!q) {
            last = null
            stillSince = 0
            lastShot = null
            return say('noDoc')
          }
          // Il foglio deve stare tutto dentro (angoli lontani dai bordi) ed essere grande abbastanza
          const margin = side * 0.012
          const touching = q.some((p) => p.x < margin || p.y < margin || p.x > sample.width - margin || p.y > sample.height - margin)
          const share = area(q) / (sample.width * sample.height)
          const stable = !!last && moved(q, last, side) < STILL
          last = q
          if (touching) {
            stillSince = 0
            return say('edges')
          }
          if (share < 0.22) {
            stillSince = 0
            return say('closer')
          }
          // Dopo uno scatto si aspetta un foglio nuovo (o spostato)
          if (lastShot && moved(q, lastShot, side) < NEW_PAGE) return say('captured')
          lastShot = null
          if (!stable) {
            stillSince = 0
            return say('hold')
          }
          stillSince ||= now
          say('hold')
          if (now - stillSince > STEADY_MS) {
            stillSince = 0
            lastShot = q
            shoot()
            say('captured')
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
  }, [facing, shoot])

  const good = hint === 'captured'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={t('autoTitle')}>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Video e contorno con le stesse proporzioni (contain): il contorno cade sul foglio */}
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-contain" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" aria-hidden />

        {state === 'live' && (
          <p className={`absolute inset-x-4 top-[max(16px,env(safe-area-inset-top))] mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-base font-bold shadow-lg ${good ? 'bg-emerald-500 text-white' : 'bg-white text-[var(--ink)]'}`} role="status">
            {t(`auto_${hint}`)}
          </p>
        )}
        {flash > 0 && <span key={flash} className="scan-flash pointer-events-none absolute inset-0 bg-white" />}

        {state !== 'live' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            {state === 'starting' ? (
              <>
                <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold-bright)]" />
                <p className="text-sm">{t('autoLoading')}</p>
              </>
            ) : (
              <p className="max-w-sm text-sm text-amber-200">{t(state === 'denied' ? 'autoDenied' : 'autoError')}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 bg-black px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => {
            setState('starting')
            setFacing((f) => (f === 'user' ? 'environment' : 'user'))
          }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label={t('autoSwitch')}
          title={t('autoSwitch')}
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
        <button type="button" disabled={state !== 'live'} onClick={shoot} className="flex h-14 items-center gap-2 rounded-full bg-white px-6 font-bold text-[var(--ink)] disabled:opacity-40">
          <Camera className="h-5 w-5" /> {t('autoShootNow')}
        </button>
        <button type="button" onClick={onClose} className="flex h-12 items-center gap-1.5 rounded-full bg-[var(--gold)] px-4 font-bold text-[var(--ink)]">
          <Check className="h-5 w-5" /> {t('autoDone', { count: taken })}
        </button>
      </div>
      <style>{`.scan-flash { animation: scanFlash .35s ease-out forwards; } @keyframes scanFlash { from { opacity: .9; } to { opacity: 0; } }`}</style>
    </div>
  )
}
