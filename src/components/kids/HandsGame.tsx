'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Brush, Camera, Circle, Hand, Music, RefreshCw, Scissors, Star, Trash2 } from 'lucide-react'
import type { HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { ageBand } from '@/lib/kids/catalog'
import { BONES, FINGERTIPS, countFingers, loadHands } from '@/lib/kids/hands'
import { KUMI_CSS, KUMI_MARKUP } from '@/lib/kids/kumi'
import type { KidProfile } from '@/lib/kids/storage'
import { KidsButton } from './ColorStage'
import { melody, speak, tone } from './kidsAudio'
import type { KidsActions } from './actions'
import KidChip from './KidChip'

// «Gioca con le mani»: la fotocamera davanti vede le mani del bambino (21
// puntini colorati per mano, MediaPipe sul telefono: il video non esce mai e
// non si salva). Sei attività:
// - Prendi le stelle: si toccano con la punta delle dita (KUMI guarda dal suo angolo)
// - Scoppia le bolle: le bolle salgono e si scoppiano con le dita
// - Disegna nell'aria: pollice e indice uniti disegnano, mano aperta si ferma
// - Pianoforte magico: tasti colorati in alto, si suonano con le dita
// - Conta con le dita: KUMI chiede un numero, il bambino lo mostra
// - Sasso, carta, forbice contro KUMI
// Stelle del bambino: ogni 10 stelle o bolle prese, 5 conte giuste, 3 vittorie.

const MODES = [
  { id: 'stars', icon: Star },
  { id: 'bubbles', icon: Circle },
  { id: 'draw', icon: Brush },
  { id: 'piano', icon: Music },
  { id: 'count', icon: Hand },
  { id: 'rps', icon: Scissors },
] as const
type Mode = (typeof MODES)[number]['id']
const MODE_LABEL: Record<Mode, string> = { stars: 'modeStars', bubbles: 'modeBubbles', draw: 'modeDraw', piano: 'modePiano', count: 'modeCount', rps: 'modeRps' }
const MODE_HINT: Partial<Record<Mode, string>> = { stars: 'catchHint', bubbles: 'bubblesHint', draw: 'drawHint', piano: 'pianoHint' }

type Status = 'idle' | 'loading' | 'running' | 'denied' | 'error'
type Gesture = 'rock' | 'paper' | 'scissors'
type Rps = { phase: 'ready' | 'beat' | 'result'; beat: number; you: Gesture | null; kumi: Gesture | null; result: 'win' | 'lose' | 'draw' | 'unknown' | null }
type FloatingStar = { x: number; y: number; color: number; born: number }
type Bubble = { x: number; y: number; r: number; vy: number; born: number }
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type Stroke = { color: string; pts: { x: number; y: number }[] }

const rand = () => Math.random()
const now = () => performance.now()

// Un colore per dito (pollice, indice, medio, anulare, mignolo), le stelle e gli 8 tasti
const FINGER_COLORS = ['#E8473B', '#F28C28', '#F7C531', '#5DB14E', '#3A5BC7']
const STAR_COLORS = ['#F7C531', '#F49CBB', '#7CC3EE', '#5DB14E', '#F28C28', '#8E5CC4']
const KEY_COLORS = ['#E8473B', '#F28C28', '#F7C531', '#5DB14E', '#7CC3EE', '#3A5BC7', '#8E5CC4', '#F49CBB']
const GESTURES: Gesture[] = ['rock', 'paper', 'scissors']
const GESTURE_EMOJI: Record<Gesture, string> = { rock: '✊', paper: '✋', scissors: '✌️' }
const BEATS = 3
const BEAT_MS = 650
const HOLD_MS = 700
const MAX_DRAW_POINTS = 4000

// Sasso: pugno (0-1 dita); carta: mano aperta (4-5); forbice: 2-3 dita
const gestureOf = (fingers: number): Gesture => (fingers <= 1 ? 'rock' : fingers >= 4 ? 'paper' : 'scissors')
const beats = (a: Gesture, b: Gesture) => (a === 'rock' && b === 'scissors') || (a === 'scissors' && b === 'paper') || (a === 'paper' && b === 'rock')

// KUMI come immagine per il disegno sul canvas (fermo: il movimento lo fa il gioco)
function kumiImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440" class="kumi-svg e-happy no-deco"><style>${KUMI_CSS}</style>${KUMI_MARKUP}</svg>`
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return img
}

export default function HandsGame({
  profile,
  sound,
  voice,
  onProfileChange,
  actions,
}: {
  profile: KidProfile
  sound: boolean
  voice: boolean
  onProfileChange: (profile: KidProfile) => void
  actions: KidsActions
}) {
  const t = useTranslations('kids')
  const locale = useLocale()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef(0)
  const [status, setStatus] = useState<Status>('idle')
  const [mode, setModeState] = useState<Mode>('stars')
  const [seen, setSeen] = useState(false)
  const [caught, setCaught] = useState(0)
  const [target, setTarget] = useState(0)
  const [shown, setShown] = useState<number | null>(null)
  const [good, setGood] = useState(false)
  const [rps, setRps] = useState<Rps>({ phase: 'ready', beat: 0, you: null, kumi: null, result: null })
  const [wins, setWins] = useState(0)

  // Il ciclo dei fotogrammi legge sempre i valori aggiornati da qui
  const live = useRef({
    mode: 'stars' as Mode,
    sound,
    voice,
    profile,
    caught: 0,
    target: 0,
    correct: 0,
    holdFrom: 0,
    pauseUntil: 0,
    wins: 0,
    rps: { phase: 'ready' as Rps['phase'], from: 0, beat: 0 },
    strokes: [] as Stroke[],
  })
  useEffect(() => {
    Object.assign(live.current, { sound, voice, profile })
  }, [sound, voice, profile])

  const say = useCallback((text: string) => live.current.voice && speak(text, locale), [locale])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
  }, [])
  useEffect(() => stop, [stop])

  const maxCount = ageBand(profile.age) === 'big' ? 10 : 5
  const newTarget = useCallback(() => {
    let n = live.current.target
    while (n === live.current.target) n = 1 + Math.floor(rand() * maxCount)
    live.current.target = n
    live.current.holdFrom = 0
    setTarget(n)
    setGood(false)
    say(t('hands.countAsk', { n }))
  }, [maxCount, say, t])

  // Sasso, carta, forbice: si riparte dal «pronti»
  const rpsRestart = useCallback(() => {
    live.current.rps = { phase: 'ready', from: now(), beat: 0 }
    setRps({ phase: 'ready', beat: 0, you: null, kumi: null, result: null })
  }, [])

  // Cosa dire e preparare quando un'attività comincia (con la fotocamera accesa)
  const begin = useCallback(
    (m: Mode) => {
      if (m === 'count') return newTarget()
      if (m === 'rps') {
        say(t('hands.rpsReady'))
        return rpsRestart()
      }
      const hint = MODE_HINT[m]
      if (hint) say(t(`hands.${hint}`))
    },
    [newTarget, rpsRestart, say, t]
  )

  const setMode = (m: Mode) => {
    live.current.mode = m
    setModeState(m)
    if (streamRef.current) begin(m)
  }

  const reward = () => {
    const p = live.current.profile
    onProfileChange({ ...p, stars: p.stars + 1 })
    if (live.current.sound) melody([0, 2, 4, 7, 11], 110)
    actions.toast(t('hands.starEarned'))
  }

  const start = async () => {
    stop()
    setStatus('loading')
    try {
      const [hands, stream] = await Promise.all([
        loadHands(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }),
      ])
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setStatus('running')
      begin(live.current.mode)
      run(hands)
    } catch (e) {
      stop()
      setStatus(e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'error')
    }
  }

  const run = (hands: HandLandmarker) => {
    const video = videoRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const kumi = kumiImage()
    const stars: FloatingStar[] = []
    const bubbles: Bubble[] = []
    const sparks: Spark[] = []
    const keysDown = new Set<number>()
    let nextBubble = 0
    let pinching = false
    let strokeColor = 0
    let lastVideoTime = -1
    let lastSeen = false
    let lastShown: number | null = null

    const burst = (x: number, y: number, colors: string[], n = 14) => {
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2
        const s = 2 + rand() * 5
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, color: colors[i % colors.length] })
      }
    }
    const scored = () => {
      const L = live.current
      L.caught += 1
      setCaught(L.caught)
      navigator.vibrate?.(25)
      if (L.caught % 10 === 0) reward()
    }

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick)
      if (video.readyState < 2 || video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime
      const w = (canvas.width = video.videoWidth)
      const h = (canvas.height = video.videoHeight)
      const u = Math.min(w, h) / 480
      const time = now()
      const result = hands.detectForVideo(video, time)
      const L = live.current

      // Video a specchio, un po' schiarito perché i colori del gioco si vedano bene
      ctx.save()
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, w, h)
      ctx.restore()
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(0, 0, w, h)
      const px = (p: NormalizedLandmark) => [(1 - p.x) * w, p.y * h] as const
      const first = result.landmarks[0]
      const tips = result.landmarks.flatMap((hand) => FINGERTIPS.map((i) => px(hand[i])))
      let fingers = 0
      for (const hand of result.landmarks) fingers += countFingers(hand)
      if (!!first !== lastSeen) {
        lastSeen = !!first
        setSeen(lastSeen)
      }

      // Disegni nell'aria: sotto le mani
      if (L.mode === 'draw') {
        for (const s of L.strokes) drawStroke(ctx, s, w, h, u)
        if (first) {
          const palm = Math.hypot(first[0].x - first[9].x, first[0].y - first[9].y)
          const pinch = Math.hypot(first[4].x - first[8].x, first[4].y - first[8].y)
          const point = { x: 1 - (first[4].x + first[8].x) / 2, y: (first[4].y + first[8].y) / 2 }
          // Isteresi: si comincia a disegnare con le dita ben unite, si smette con le dita ben aperte
          if (!pinching && pinch < palm * 0.3) {
            pinching = true
            strokeColor = (strokeColor + 1) % KEY_COLORS.length
            L.strokes.push({ color: KEY_COLORS[strokeColor], pts: [point] })
            if (L.sound) tone(strokeColor, 0.06, 0.2)
          } else if (pinching && pinch > palm * 0.45) pinching = false
          if (pinching) {
            const s = L.strokes[L.strokes.length - 1]
            const last = s.pts[s.pts.length - 1]
            if (Math.hypot(point.x - last.x, point.y - last.y) > 0.004) s.pts.push(point)
            // Troppi punti: si tolgono i tratti più vecchi
            while (L.strokes.reduce((n, st) => n + st.pts.length, 0) > MAX_DRAW_POINTS && L.strokes.length > 1) L.strokes.shift()
          }
          // Pennello: cerchio del colore del prossimo tratto (pieno mentre disegna)
          ctx.beginPath()
          ctx.arc(point.x * w, point.y * h, 14 * u, 0, Math.PI * 2)
          ctx.fillStyle = pinching ? KEY_COLORS[strokeColor] : 'rgba(255,255,255,0.6)'
          ctx.fill()
          ctx.lineWidth = 3 * u
          ctx.strokeStyle = '#2B2D52'
          ctx.stroke()
        } else pinching = false
      }

      // Pianoforte: 8 tasti in alto, suona il tasto appena un dito ci entra
      if (L.mode === 'piano') {
        const kw = w / KEY_COLORS.length
        const kh = h * 0.24
        const pressed = new Set<number>()
        for (const [x, y] of tips) if (y < kh) pressed.add(Math.min(KEY_COLORS.length - 1, Math.floor(x / kw)))
        KEY_COLORS.forEach((c, i) => {
          const on = pressed.has(i)
          if (on && !keysDown.has(i)) {
            if (L.sound) tone(i, 0.14, 0.5)
            burst(i * kw + kw / 2, kh, [c, '#FFFFFF'], 8)
          }
          ctx.beginPath()
          ctx.roundRect(i * kw + 3 * u, 3 * u + (on ? 6 * u : 0), kw - 6 * u, kh - 6 * u, 14 * u)
          ctx.fillStyle = c
          ctx.globalAlpha = on ? 1 : 0.78
          ctx.fill()
          ctx.globalAlpha = 1
          ctx.lineWidth = 4 * u
          ctx.strokeStyle = '#2B2D52'
          ctx.stroke()
        })
        keysDown.clear()
        pressed.forEach((k) => keysDown.add(k))
        drawKumi(ctx, kumi, w / 2, h - 66 * u, 120 * u, time, pressed.size > 0)
      }

      drawHands(ctx, result.landmarks, px, u)

      if (L.mode === 'stars') {
        // Le stelle si prendono con la punta di un dito; KUMI guarda dal suo angolo
        while (stars.length < 3) stars.push({ x: 0.12 + rand() * 0.76, y: 0.12 + rand() * 0.6, color: Math.floor(rand() * STAR_COLORS.length), born: time })
        for (let i = stars.length - 1; i >= 0; i--) {
          const s = stars[i]
          const age = (time - s.born) / 1000
          const sx = (s.x + Math.sin(age * 1.3 + i) * 0.02) * w
          const sy = (s.y + Math.cos(age * 1.1 + i) * 0.02) * h
          const r = 26 * u * Math.min(1, age * 3)
          drawStar(ctx, sx, sy, r, age, STAR_COLORS[s.color])
          if (tips.some(([x, y]) => Math.hypot(x - sx, y - sy) < r + 12 * u)) {
            stars.splice(i, 1)
            burst(sx, sy, [STAR_COLORS[s.color], '#FFFFFF', '#FFC93C'])
            if (L.sound) tone(s.color + 3, 0.12)
            scored()
          }
        }
        drawKumi(ctx, kumi, w - 64 * u, h - 62 * u, 110 * u, time, !!first)
      }

      if (L.mode === 'bubbles') {
        // Una bolla nuova ogni 0,7–1,3 secondi, che sale ondeggiando
        if (time > nextBubble && bubbles.length < 7) {
          bubbles.push({ x: 0.1 + rand() * 0.8, y: 1.1, r: 0.05 + rand() * 0.04, vy: 0.0025 + rand() * 0.002, born: time })
          nextBubble = time + 700 + rand() * 600
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i]
          b.y -= b.vy
          const bx = (b.x + Math.sin((time - b.born) / 600) * 0.03) * w
          const by = b.y * h
          const br = b.r * Math.min(w, h)
          if (b.y < -0.15) {
            bubbles.splice(i, 1)
            continue
          }
          if (tips.some(([x, y]) => Math.hypot(x - bx, y - by) < br)) {
            bubbles.splice(i, 1)
            burst(bx, by, ['#7CC3EE', '#FFFFFF', '#C9B3EC', '#F49CBB'], 16)
            if (L.sound) tone(Math.floor(rand() * 8) + 4, 0.12, 0.25)
            scored()
            continue
          }
          drawBubble(ctx, bx, by, br, u)
        }
        drawKumi(ctx, kumi, w - 64 * u, h - 62 * u, 110 * u, time, !!first)
      }

      if (L.mode === 'count') {
        drawKumi(ctx, kumi, w - 70 * u, h - 66 * u, 120 * u, time, true)
        const shownNow = first ? fingers : null
        if (shownNow !== lastShown) {
          lastShown = shownNow
          setShown(shownNow)
        }
        if (time > L.pauseUntil && shownNow === L.target) {
          L.holdFrom ||= time
          if (time - L.holdFrom > HOLD_MS) {
            L.pauseUntil = time + 1600
            L.correct += 1
            setGood(true)
            burst(w / 2, h / 2, ['#F7C531', '#E8473B', '#7CC3EE', '#5DB14E', '#F49CBB'], 40)
            if (L.sound) melody([0, 4, 7, 11], 110)
            say(t('hands.countGood', { n: L.target }))
            if (L.correct % 5 === 0) reward()
            setTimeout(() => live.current.mode === 'count' && streamRef.current && newTarget(), 1600)
          }
        } else if (shownNow !== L.target) L.holdFrom = 0
      }

      if (L.mode === 'rps') {
        const R = L.rps
        // Pronti: si parte appena si vede la mano (dopo un attimo)
        if (R.phase === 'ready' && first && time - R.from > 900) {
          R.phase = 'beat'
          R.from = time
          R.beat = 1
          setRps({ phase: 'beat', beat: 1, you: null, kumi: null, result: null })
          if (L.sound) tone(0, 0.12, 0.2)
        } else if (R.phase === 'beat' && time - R.from > BEAT_MS) {
          R.from = time
          if (R.beat < BEATS) {
            R.beat += 1
            setRps((r) => ({ ...r, beat: R.beat }))
            if (L.sound) tone(R.beat * 2, 0.12, 0.2)
          } else {
            // Via! La mano del bambino contro quella (a caso) di KUMI
            R.phase = 'result'
            const kumiPick = GESTURES[Math.floor(rand() * 3)]
            const you = first ? gestureOf(countFingers(first)) : null
            const res: Rps['result'] = !you ? 'unknown' : you === kumiPick ? 'draw' : beats(you, kumiPick) ? 'win' : 'lose'
            setRps({ phase: 'result', beat: BEATS, you, kumi: kumiPick, result: res })
            if (res === 'win') {
              L.wins += 1
              setWins(L.wins)
              burst(w / 2, h / 2, ['#F7C531', '#E8473B', '#7CC3EE', '#5DB14E', '#F49CBB'], 40)
              if (L.sound) melody([0, 4, 7, 11], 110)
              if (L.wins % 3 === 0) reward()
            } else if (L.sound) melody(res === 'lose' ? [7, 4, 0] : [4, 4], 140)
            say(t(res === 'win' ? 'hands.rpsWin' : res === 'lose' ? 'hands.rpsLose' : res === 'draw' ? 'hands.rpsDraw' : 'hands.rpsUnknown'))
          }
        } else if (R.phase === 'result' && time - R.from > 2800) {
          R.phase = 'ready'
          R.from = time
          setRps({ phase: 'ready', beat: 0, you: null, kumi: null, result: null })
        }
        // KUMI agita il tentacolo a ogni battito
        const shake = R.phase === 'beat' ? Math.abs(Math.sin(((time - R.from) / BEAT_MS) * Math.PI)) * 30 * u : 0
        drawKumi(ctx, kumi, w - 70 * u, h - 66 * u - shake, 120 * u, time, true)
      }

      // Scintille
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.x += s.vx * u
        s.y += s.vy * u
        s.vy += 0.25
        s.life -= 0.03
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        ctx.globalAlpha = s.life
        drawStar(ctx, s.x, s.y, 9 * u * s.life + 3, s.life * 4, s.color)
        ctx.globalAlpha = 1
      }
    }
    tick()
  }

  const fingersDone = shown !== null && shown === target
  const running = status === 'running'
  const counter = mode === 'stars' || mode === 'bubbles' ? caught : mode === 'rps' ? wins : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Le sei attività */}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border-[3px] border-[#2B2D52] px-1.5 py-1 text-xs font-extrabold leading-tight text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] sm:text-sm ${mode === id ? 'bg-[#FFC93C]' : 'bg-white'}`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden /> <span className="text-left">{t(`hands.${MODE_LABEL[id]}`)}</span>
          </button>
        ))}
      </div>

      {/* Fotocamera */}
      <div className="flex min-h-[180px] flex-1 items-center justify-center [container-type:size]">
        <div className="relative">
          <KidChip />
          <div className="relative mx-auto aspect-[4/3] w-[min(calc(100cqw-104px),calc((100cqh-6px)*1.333))] min-w-[220px] overflow-hidden rounded-[22px] border-[3px] border-[#2B2D52] bg-[#E6ECF8] shadow-[5px_5px_0_#2B2D52]">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className={`block h-full w-full object-cover ${running ? '' : 'hidden'}`} />

            {running && counter !== null && (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border-[3px] border-[#2B2D52] bg-white px-2.5 py-1 text-lg font-extrabold tabular-nums text-[#2B2D52]" aria-label={`${t(mode === 'rps' ? 'hands.wins' : 'hands.caught')}: ${counter}`}>
                <Star className="h-5 w-5 fill-[#FFC93C] text-[#2B2D52]" aria-hidden /> {counter}
              </span>
            )}
            {running && mode === 'count' && target > 0 && (
              <div className={`absolute inset-x-2 top-2 flex items-center justify-between gap-2 rounded-2xl border-[3px] border-[#2B2D52] px-3 py-1.5 font-extrabold text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] ${good || fingersDone ? 'bg-[#C8F0D2]' : 'bg-white'}`} role="status">
                <span className="text-base leading-tight sm:text-lg">{good ? t('hands.countGood', { n: target }) : t('hands.countAsk', { n: target })}</span>
                <span className="text-4xl tabular-nums">{shown ?? '–'}</span>
              </div>
            )}
            {running && mode === 'rps' && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center" role="status">
                {rps.phase === 'beat' && <span className="text-7xl font-black text-white [text-shadow:0_3px_0_#2B2D52,0_0_12px_#2B2D52]">{rps.beat}</span>}
                {rps.phase === 'result' && (
                  <div className="rounded-3xl border-[3px] border-[#2B2D52] bg-white/95 px-4 py-3 shadow-[4px_4px_0_#2B2D52]">
                    <p className="text-2xl font-extrabold text-[#2B2D52]">
                      {t(rps.result === 'win' ? 'hands.rpsWin' : rps.result === 'lose' ? 'hands.rpsLose' : rps.result === 'draw' ? 'hands.rpsDraw' : 'hands.rpsUnknown')}
                    </p>
                    {rps.you && rps.kumi && (
                      <div className="mt-2 flex items-center justify-center gap-5 text-sm font-bold text-[#61648A]">
                        <span className="grid justify-items-center">
                          <span className="text-4xl">{GESTURE_EMOJI[rps.you]}</span>
                          {t('hands.rpsYou')} · {t(`hands.${rps.you}`)}
                        </span>
                        <span className="grid justify-items-center">
                          <span className="text-4xl">{GESTURE_EMOJI[rps.kumi]}</span>
                          {t('hands.rpsKumi')} · {t(`hands.${rps.kumi}`)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {running && mode === 'rps' && rps.phase === 'ready' && seen && (
              <p className="pointer-events-none absolute inset-x-3 top-3 rounded-2xl bg-white/90 px-3 py-2 text-center text-lg font-extrabold text-[#2B2D52]">{t('hands.rpsReady')}</p>
            )}
            {running && mode === 'draw' && (
              <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
                <p className="rounded-2xl bg-white/90 px-3 py-1.5 text-xs font-extrabold leading-snug text-[#2B2D52] sm:text-sm">{t('hands.drawHint')}</p>
                <button
                  type="button"
                  onClick={() => {
                    live.current.strokes = []
                    if (live.current.sound) melody([7, 4, 0], 90)
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-2.5 py-1.5 text-sm font-extrabold text-[#2B2D52] shadow-[3px_3px_0_#2B2D52]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> {t('hands.clear')}
                </button>
              </div>
            )}
            {running && !seen && (
              <p className="pointer-events-none absolute inset-x-3 bottom-3 rounded-2xl bg-white/90 px-3 py-2 text-center text-base font-extrabold text-[#2B2D52]">{t('hands.showHand')}</p>
            )}

            {!running && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
                {status === 'loading' ? (
                  <>
                    <RefreshCw className="h-9 w-9 animate-spin text-[#2B2D52]" aria-hidden />
                    <p className="text-lg font-extrabold text-[#2B2D52]">{t('hands.loading')}</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold leading-snug text-[#2B2D52]">{t('hands.intro')}</p>
                    {status === 'denied' && <p className="rounded-xl bg-[#FFF3C4] px-3 py-2 text-sm font-bold text-[#2B2D52]">{t('hands.denied')}</p>}
                    {status === 'error' && <p className="rounded-xl bg-[#FFF3C4] px-3 py-2 text-sm font-bold text-[#2B2D52]">{t('hands.error')}</p>}
                    <KidsButton onClick={() => void start()} accent>
                      <Camera className="h-5 w-5" /> {t('hands.start')}
                    </KidsButton>
                    <p className="text-xs font-bold text-[#61648A]">{t('hands.privacy')}</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Mani: ossa bianche bordate e puntini colorati, punte delle dita più grandi
function drawHands(ctx: CanvasRenderingContext2D, hands: NormalizedLandmark[][], px: (p: NormalizedLandmark) => readonly [number, number], u: number) {
  for (const hand of hands) {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    for (const [a, b] of BONES) {
      const [ax, ay] = px(hand[a])
      const [bx, by] = px(hand[b])
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
    }
    ctx.strokeStyle = 'rgba(43,45,82,0.85)'
    ctx.lineWidth = 9 * u
    ctx.stroke()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 5 * u
    ctx.stroke()
    hand.forEach((p, i) => {
      const [x, y] = px(p)
      const finger = i === 0 ? -1 : Math.floor((i - 1) / 4)
      ctx.beginPath()
      ctx.arc(x, y, (FINGERTIPS.includes(i) ? 11 : 6.5) * u, 0, Math.PI * 2)
      ctx.fillStyle = finger < 0 ? '#FFFFFF' : FINGER_COLORS[finger]
      ctx.fill()
      ctx.lineWidth = 3 * u
      ctx.strokeStyle = '#2B2D52'
      ctx.stroke()
    })
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number, u: number) {
  if (s.pts.length < 2) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h)))
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 20 * u
  ctx.stroke()
  ctx.strokeStyle = s.color
  ctx.lineWidth = 13 * u
  ctx.stroke()
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, u: number) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(0.35, 'rgba(201,179,236,0.35)')
  g.addColorStop(1, 'rgba(124,195,238,0.55)')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.lineWidth = 3 * u
  ctx.strokeStyle = 'rgba(43,45,82,0.7)'
  ctx.stroke()
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, color: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(spin * 0.8)
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.48 : r
    const a = (i * Math.PI) / 5 - Math.PI / 2
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.12)
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#2B2D52'
  ctx.stroke()
  ctx.restore()
}

// KUMI che dondola (e saltella quando gioca)
function drawKumi(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, time: number, happy: boolean) {
  if (!img.complete || !img.naturalWidth) return
  const h = size * 1.1
  const bob = Math.sin(time / (happy ? 180 : 420)) * size * 0.04
  ctx.save()
  ctx.translate(x, y + bob)
  ctx.rotate(Math.sin(time / 500) * 0.08)
  ctx.drawImage(img, -size / 2, -h / 2, size, h)
  ctx.restore()
}
