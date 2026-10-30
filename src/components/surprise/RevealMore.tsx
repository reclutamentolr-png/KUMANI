'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Delete, LoaderCircle, Mic, type LucideIcon } from 'lucide-react'
import { SAFE_FREE_AFTER } from '@/lib/surprise'

// Sei aperture in più (vedi Reveal.tsx): candeline da spegnere (tocco o
// soffio nel microfono), palloncino da scoppiare, biscotto della fortuna,
// sipario, foto che si sviluppa, cassaforte con il codice. Con «meno
// movimento» niente animazioni continue e si apre subito. Nessun suono.

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useReduced() {
  const [r, setR] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- si legge solo nel browser
    setR(reduced())
  }, [])
  return r
}

const later = (fn: () => void, ms: number) => {
  if (reduced()) fn()
  else setTimeout(fn, ms)
}
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
const KEYFRAMES =
  '@keyframes rv-flick{from{transform:scaleY(1) skewX(-3deg)}to{transform:scaleY(1.12) skewX(3deg)}}@keyframes rv-smoke{from{opacity:.8;transform:translateY(0)}to{opacity:0;transform:translateY(-20px)}}@keyframes rv-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}@keyframes rv-burst{from{transform:scale(.6);opacity:1}to{transform:scale(2.4);opacity:0}}@keyframes rv-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}'

// ─── Candeline: si spengono con un tocco o soffiando nel microfono ───
// Il microfono si chiede solo toccando il pulsante e si spegne sempre: a
// candeline spente, uscendo dalla pagina o passando a un'altra app.
export function Candles({ accent, onOpen }: { accent: string; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const still = useReduced()
  const [lit, setLit] = useState([true, true, true])
  const [mic, setMic] = useState<'off' | 'asking' | 'on' | 'no'>('off')
  const stopRef = useRef<() => void>(() => {})
  const opened = useRef(false)
  // Uscita dalla pagina o app in secondo piano mentre si chiede il permesso:
  // il microfono, se arriva dopo, si spegne subito
  const away = useRef(false)
  const stopMic = useCallback(() => {
    stopRef.current()
    stopRef.current = () => {}
  }, [])
  const done = lit.every((x) => !x)
  useEffect(() => {
    if (!done || opened.current) return
    opened.current = true
    stopMic()
    later(onOpen, 700)
  }, [done, onOpen, stopMic])
  useEffect(() => {
    away.current = false
    const hide = () => {
      if (document.visibilityState !== 'hidden') return
      away.current = true
      stopMic()
      setMic((m) => (m === 'on' || m === 'asking' ? 'off' : m))
    }
    const leave = () => {
      away.current = true
      stopMic()
    }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', leave)
      away.current = true
      stopMic()
    }
  }, [stopMic])
  const blowOut = (i: number) => setLit((l) => l.map((v, k) => (k === i ? false : v)))
  const blow = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setMic('no')
    stopMic()
    away.current = false
    setMic('asking')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } })
      // Uscito dalla pagina o candeline già spente mentre si chiedeva il permesso
      if (away.current || opened.current) {
        stream.getTracks().forEach((tr) => tr.stop())
        return
      }
      const ctx = new AudioContext()
      // Safari: dopo l'attesa del permesso l'audio può partire in pausa
      void ctx.resume().catch(() => {})
      const an = ctx.createAnalyser()
      an.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.fftSize)
      let raf = 0
      let strong = 0
      const tick = () => {
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += ((v - 128) / 128) ** 2
        // Un soffio è un rumore forte e lungo: spegne una candelina alla volta
        if (Math.sqrt(sum / buf.length) > 0.18) strong++
        else strong = Math.max(0, strong - 1)
        if (strong > 6) {
          strong = 0
          setLit((l) => {
            const i = l.indexOf(true)
            return i < 0 ? l : l.map((x, k) => (k === i ? false : x))
          })
        }
        raf = requestAnimationFrame(tick)
      }
      stopRef.current = () => {
        cancelAnimationFrame(raf)
        stream.getTracks().forEach((tr) => tr.stop())
        void ctx.close().catch(() => {})
      }
      tick()
      setMic('on')
    } catch {
      setMic('no')
    }
  }
  const colors = ['#f3a6b8', '#9fd3f5', '#e7c56a']
  return (
    <div className="mx-auto flex flex-col items-center text-center">
      <p className="text-lg font-bold text-white">{t('candlesWish')}</p>
      <div className="relative mt-4 w-64">
        <svg viewBox="0 0 240 230" className="w-64" aria-hidden>
          {[60, 120, 180].map((x, i) => (
            <g key={x}>
              <rect x={x - 6} y={60} width={12} height={50} rx={3} fill={colors[i]} />
              {lit[i] ? (
                <g style={{ transformOrigin: `${x}px 55px`, animation: still ? undefined : 'rv-flick .25s ease-in-out infinite alternate' }}>
                  <ellipse cx={x} cy={44} rx={9} ry={16} fill="#ffb341" />
                  <ellipse cx={x} cy={48} rx={4.5} ry={9} fill="#fff4c2" />
                </g>
              ) : (
                !still && <path d={`M${x} 56 q 6 -14 -2 -26 q 10 10 2 26`} fill="none" stroke="#8a8a8a" strokeWidth={2} opacity={0.7} style={{ animation: 'rv-smoke 1.2s ease-out forwards' }} />
              )}
            </g>
          ))}
          <rect x={20} y={108} width={200} height={60} rx={14} fill="#f6e7c1" />
          <rect x={20} y={108} width={200} height={18} rx={9} fill="#fffaf0" />
          <path d="M20 126 q 20 14 40 0 q 20 14 40 0 q 20 14 40 0 q 20 14 40 0 q 20 14 40 0" fill="#fffaf0" />
          <rect x={10} y={165} width={220} height={45} rx={14} fill="#c79a3b" />
          <rect x={10} y={165} width={220} height={12} rx={6} fill="#e7c56a" />
        </svg>
        {/* Le fiammelle sono pulsanti veri (anche da tastiera) */}
        {[25, 50, 75].map((left, i) => (
          <button
            key={left}
            type="button"
            disabled={!lit[i]}
            onClick={() => blowOut(i)}
            aria-label={t('candleN', { n: i + 1 })}
            className={`absolute top-[4%] h-[46%] w-[18%] -translate-x-1/2 cursor-pointer rounded-xl disabled:cursor-default ${focusRing}`}
            style={{ left: `${left}%` }}
          />
        ))}
      </div>
      <p className="mt-2 text-sm text-white/80">{t('candlesTap')}</p>
      {mic === 'off' && !done && (
        <button type="button" onClick={blow} className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-sm font-bold text-white" style={{ borderColor: accent }}>
          <Mic className="h-4 w-4" aria-hidden /> {t('candlesBlow')}
        </button>
      )}
      {mic === 'asking' && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-white/80">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> {t('candlesMicAsk')}
        </p>
      )}
      {mic === 'on' && !done && (
        <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm font-semibold text-white" role="status">
          <Mic className="h-4 w-4 text-red-400" aria-hidden /> {t('candlesBlowing')}
          <button
            type="button"
            onClick={() => {
              stopMic()
              setMic('off')
            }}
            className="min-h-11 cursor-pointer px-2 underline underline-offset-4"
          >
            {t('candlesMicOff')}
          </button>
        </p>
      )}
      {mic === 'no' && <p className="mt-4 text-sm text-white/70">{t('candlesNoMic')}</p>}
      <style>{KEYFRAMES}</style>
    </div>
  )
}

// ─── Palloncino: tre tocchi, si gonfia e scoppia (senza rumore) ───
export function Balloon({ accent, onOpen }: { accent: string; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const still = useReduced()
  const [taps, setTaps] = useState(0)
  const [pop, setPop] = useState(false)
  const tap = () => {
    if (pop) return
    if (taps >= 2) {
      setPop(true)
      later(onOpen, 450)
    } else setTaps((n) => n + 1)
  }
  return (
    <div className="mx-auto flex flex-col items-center text-center">
      <p className="text-lg font-bold text-white" aria-live="polite">
        {t(`balloonTap${Math.min(taps, 2)}`)}
      </p>
      <button
        type="button"
        onClick={tap}
        aria-label={t('balloonLabel')}
        className={`relative mt-6 cursor-pointer rounded-full ${focusRing}`}
        style={{ animation: pop || still ? undefined : 'rv-float 2.4s ease-in-out infinite' }}
      >
        {pop ? (
          <span className="block h-64 w-44" style={{ animation: still ? undefined : 'rv-burst .45s ease-out forwards' }}>
            <svg viewBox="0 0 120 150" className="h-full w-full" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <path key={i} d="M60 60 l4 -14 l-8 0 z" fill={accent} transform={`rotate(${i * 36} 60 60)`} />
              ))}
            </svg>
          </span>
        ) : (
          <svg viewBox="0 0 120 190" className="h-64 w-44 transition-transform duration-300" style={{ transform: `scale(${1 + taps * 0.22})` }} aria-hidden>
            <defs>
              <radialGradient id="rv-bal" cx="35%" cy="30%">
                <stop offset="0%" stopColor="#fff4c2" />
                <stop offset="45%" stopColor={accent} />
                <stop offset="100%" stopColor="#3a2c0a" />
              </radialGradient>
            </defs>
            <ellipse cx={60} cy={62} rx={46} ry={56} fill="url(#rv-bal)" />
            <path d="M54 117 l6 8 l6 -8 z" fill={accent} />
            <path d="M60 125 q -12 20 4 36 q 14 14 -2 28" fill="none" stroke="#e7c56a" strokeWidth={1.5} />
            <ellipse cx={42} cy={38} rx={10} ry={16} fill="#fff" opacity={0.35} />
          </svg>
        )}
      </button>
      <style>{KEYFRAMES}</style>
    </div>
  )
}

// ─── Biscotto della fortuna: si spezza ed esce il bigliettino ───
export function FortuneCookie({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations('surprise')
  const [broken, setBroken] = useState(false)
  return (
    <div className="mx-auto flex flex-col items-center text-center">
      <p className="text-lg font-bold text-white" aria-live="polite">
        {broken ? t('cookieNote') : t('cookieTap')}
      </p>
      <button
        type="button"
        onClick={() => {
          if (broken) return
          setBroken(true)
          later(onOpen, 1600)
        }}
        className={`relative mt-4 h-52 w-72 cursor-pointer rounded-2xl ${focusRing}`}
        aria-label={t('cookieLabel')}
      >
        <span
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-sm bg-[#fffaf0] px-4 py-2 font-[family-name:var(--font-letter)] text-base italic text-[#171717] shadow transition-all duration-700 motion-reduce:transition-none ${broken ? 'z-20' : 'z-0'}`}
          style={{ width: broken ? 230 : 40, opacity: broken ? 1 : 0, transitionDelay: '0.35s' }}
        >
          {t('cookieMessage')}
        </span>
        {[-1, 1].map((side) => (
          <svg
            key={side}
            viewBox="0 0 100 100"
            aria-hidden
            className="absolute top-6 z-10 h-36 w-36 transition-transform duration-700 motion-reduce:transition-none"
            style={{ left: side < 0 ? 28 : 108, transform: broken ? `translateX(${side * 70}px) rotate(${side * 28}deg)` : 'none' }}
          >
            <path d={side < 0 ? 'M100 20 C 30 0, 0 60, 40 90 C 60 70, 90 60, 100 50 Z' : 'M0 20 C 70 0, 100 60, 60 90 C 40 70, 10 60, 0 50 Z'} fill="#d9a45a" />
            <path d={side < 0 ? 'M100 30 C 45 20, 25 60, 45 80' : 'M0 30 C 55 20, 75 60, 55 80'} fill="none" stroke="#b57d35" strokeWidth={3} opacity={0.6} />
          </svg>
        ))}
      </button>
    </div>
  )
}

// ─── Sipario: si apre sul regalo ───
export function Curtain({ Icon, accent, onOpen }: { Icon: LucideIcon; accent: string; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const [open, setOpen] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        if (open) return
        setOpen(true)
        later(onOpen, 1300)
      }}
      className={`relative mx-auto block h-[420px] w-full max-w-sm cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-b from-[#221d14] to-[#0d0c0a] shadow-2xl ${focusRing}`}
      aria-label={t('curtainLabel')}
    >
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <Icon className="h-20 w-20" style={{ color: accent }} />
      </span>
      <span aria-hidden className="absolute inset-x-0 top-0 z-20 h-10 bg-gradient-to-b from-[#5a0f1a] to-[#8b1c2b] shadow-lg" />
      {[0, 1].map((i) => (
        <span
          key={i}
          aria-hidden
          className="absolute top-0 z-10 h-full w-1/2 transition-transform duration-[1200ms] ease-in-out motion-reduce:transition-none"
          style={{
            [i ? 'right' : 'left']: 0,
            transform: open ? `translateX(${i ? '' : '-'}92%)` : 'none',
            background: 'repeating-linear-gradient(90deg,#8b1c2b 0 18px,#a8283a 18px 30px,#7a1624 30px 44px)',
            boxShadow: 'inset 0 -40px 60px rgba(0,0,0,.35)',
          }}
        />
      ))}
      {!open && <span className="absolute inset-x-0 bottom-10 z-30 px-4 text-center text-lg font-bold text-[#f3dc8f]">{t('curtainTap')}</span>}
    </button>
  )
}

// ─── Foto che si sviluppa come una Polaroid (la copertina, se c'è) ───
export function Polaroid({ name, coverUrl, onOpen }: { name: string; coverUrl?: string | null; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const [dev, setDev] = useState(false)
  return (
    <div className="mx-auto flex flex-col items-center text-center">
      <p className="text-lg font-bold text-white" aria-live="polite">
        {dev ? t('polaroidDev') : t('polaroidTap')}
      </p>
      <button
        type="button"
        onClick={() => {
          if (dev) return
          setDev(true)
          later(onOpen, 3600)
        }}
        className={`mt-5 rotate-[-3deg] cursor-pointer bg-[#fdfbf6] p-3 pb-12 shadow-2xl ${focusRing}`}
        aria-label={t('polaroidLabel')}
      >
        <span className="relative block h-60 w-56 overflow-hidden bg-gradient-to-br from-[#f7e7b4] via-[#d9b25c] to-[#a37a2c]">
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo dello Storage
            <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="absolute bottom-6 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-[#fff2c7]/80 blur-md" />
          )}
          <span aria-hidden className="absolute inset-0 bg-[#2a2622] transition-opacity duration-[3200ms] ease-in motion-reduce:transition-none" style={{ opacity: dev ? 0 : 1 }} />
        </span>
        <span className="mt-3 block max-w-56 truncate font-[family-name:var(--font-letter)] text-lg italic text-[#4a4033]">{t('polaroidCaption', { name: name || '' })}</span>
      </button>
    </div>
  )
}

// ─── Cassaforte: il codice lo controlla il server; dopo 5 errori «Apri lo stesso» ───
export function Safe({ accent, hint, check, onOpen }: { accent: string; hint?: string; check?: (code: string) => Promise<{ ok: boolean; reason?: string }>; onOpen: () => void }) {
  const t = useTranslations('surprise')
  const still = useReduced()
  const [code, setCode] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'wrong' | 'wait' | 'open'>('idle')
  const [errors, setErrors] = useState(0)
  const open = () => {
    setState('open')
    later(onOpen, 1200)
  }
  const tryCode = async (value: string) => {
    if (!check) return
    setState('busy')
    const r = await check(value).catch(() => ({ ok: false, reason: 'wrong' }))
    if (r.ok) return open()
    setErrors((n) => n + 1)
    setState(r.reason === 'wait' ? 'wait' : 'wrong')
    setTimeout(() => setCode(''), 600)
  }
  const press = (d: string) => {
    if (state === 'open' || state === 'busy' || code.length >= 4) return
    const next = code + d
    setCode(next)
    if (state === 'wrong' || state === 'wait') setState('idle')
    if (next.length === 4) void tryCode(next)
  }
  const back = () => state !== 'busy' && state !== 'open' && setCode((c) => c.slice(0, -1))
  // Anche dalla tastiera del computer: cifre e «cancella»
  const pressRef = useRef(press)
  const backRef = useRef(back)
  useEffect(() => {
    pressRef.current = press
    backRef.current = back
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (/^[0-9]$/.test(e.key)) pressRef.current(e.key)
      else if (e.key === 'Backspace') backRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const key = 'h-12 w-16 cursor-pointer rounded-xl bg-white/10 text-lg font-bold text-white hover:bg-white/20 active:bg-white/30'
  return (
    <div className="mx-auto flex flex-col items-center text-center">
      <p className="text-lg font-bold text-white">{t('safeEnter')}</p>
      {hint && (
        <p className="mt-1 max-w-xs text-sm text-white/80">
          <span className="font-bold text-white">{t('safeHintTitle')}</span> {hint}
        </p>
      )}
      <div
        aria-hidden
        className={`relative mt-4 h-44 w-56 rounded-2xl border-4 bg-gradient-to-br from-[#4a4033] to-[#1d1a14] shadow-2xl ${still ? '' : 'transition-transform duration-1000'}`}
        style={{
          transformOrigin: 'left center',
          borderColor: accent,
          transform: state === 'open' && !still ? 'perspective(600px) rotateY(-75deg)' : undefined,
          animation: state === 'wrong' && !still ? 'rv-shake .4s' : undefined,
        }}
      >
        <span className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-[#2a2622]" style={{ borderColor: accent }} />
        <span className="absolute right-4 top-1/2 h-10 w-3 -translate-y-1/2 rounded" style={{ background: accent }} />
        <span className="absolute inset-x-0 bottom-3 font-mono text-2xl tracking-[0.5em] text-[#f3dc8f]">{code.padEnd(4, '•')}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {t('safeEntered', { n: code.length })}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label={t('safeEnter')}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={key}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} className={key}>
          0
        </button>
        <button type="button" onClick={back} aria-label={t('safeDelete')} className={`${key} flex items-center justify-center`}>
          <Delete className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <p className="mt-3 min-h-5 text-sm font-bold text-red-300" role="status">
        {state === 'wrong' ? t('safeWrong') : state === 'wait' ? t('safeWait') : !check ? t('safeNoCheck') : ''}
      </p>
      {(errors >= SAFE_FREE_AFTER || !check) && state !== 'open' && (
        <button type="button" onClick={open} className="mt-1 min-h-11 cursor-pointer rounded-full px-5 py-2 text-sm font-semibold text-white underline underline-offset-4">
          {t('safeOpenAnyway')}
        </button>
      )}
      <style>{KEYFRAMES}</style>
    </div>
  )
}
