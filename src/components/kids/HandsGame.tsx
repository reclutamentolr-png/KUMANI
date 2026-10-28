'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Brush, Camera, Circle, Hand, Music, Power, RefreshCw, Star, Trash2, Trophy, Wind } from 'lucide-react'
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
// - Prendi le stelle: si toccano con la punta delle dita (KUMI guarda dal suo
//   angolo); al livello 2 solo con il dito dello stesso colore della stella
// - Scoppia le bolle: le bolle salgono e si scoppiano con le dita
// - Disegna nell'aria: pollice e indice uniti disegnano, mano aperta si ferma
// - Pianoforte magico: tasti colorati in alto, si suonano con le dita
// - Conta con le dita: KUMI chiede un numero, il bambino lo mostra
// - Palloncino: cade piano, si tiene in aria colpendolo con la mano
// Stelle del bambino: ogni 10 stelle, bolle o colpi al palloncino, 5 conte giuste.
// «Termina il gioco» spegne la fotocamera in qualsiasi attività.

const MODES = [
  { id: 'stars', icon: Star },
  { id: 'bubbles', icon: Circle },
  { id: 'draw', icon: Brush },
  { id: 'piano', icon: Music },
  { id: 'count', icon: Hand },
  { id: 'balloon', icon: Wind },
] as const
type Mode = (typeof MODES)[number]['id']
const MODE_LABEL: Record<Mode, string> = { stars: 'modeStars', bubbles: 'modeBubbles', draw: 'modeDraw', piano: 'modePiano', count: 'modeCount', balloon: 'modeBalloon' }
const MODE_HINT: Partial<Record<Mode, string>> = { stars: 'catchHint', bubbles: 'bubblesHint', draw: 'drawHint', piano: 'pianoHint', balloon: 'balloonHint' }

type Status = 'idle' | 'loading' | 'running' | 'denied' | 'error'
type Balloon = { x: number; y: number; vx: number; vy: number; color: number; hitAt: number; fellAt: number }
type FloatingStar = { x: number; y: number; color: number; born: number; level: 1 | 2; bumpUntil: number }
type Bubble = { x: number; y: number; r: number; vy: number; born: number }
type Spark = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type Stroke = { color: string; pts: { x: number; y: number }[] }

const rand = () => Math.random()
const now = () => performance.now()

// Un colore per dito (pollice, indice, medio, anulare, mignolo), le stelle e gli 8 tasti
const FINGER_COLORS = ['#E8473B', '#F28C28', '#F7C531', '#5DB14E', '#3A5BC7']
const STAR_COLORS = ['#F7C531', '#F49CBB', '#7CC3EE', '#5DB14E', '#F28C28', '#8E5CC4']
const KEY_COLORS = ['#E8473B', '#F28C28', '#F7C531', '#5DB14E', '#7CC3EE', '#3A5BC7', '#8E5CC4', '#F49CBB']
const HOLD_MS = 700
const MAX_DRAW_POINTS = 4000
// Palloncino: gravità leggera, spinta del colpo, punti della mano che lo toccano (punte e palmo)
const BALLOON_GRAVITY = 0.00011
const BALLOON_PUSH = 0.017
const BALLOON_POINTS = [0, 4, 5, 8, 9, 12, 13, 16, 17, 20]
const newBalloon = (color = 0): Balloon => ({ x: 0.5, y: -0.1, vx: 0, vy: 0.002, color, hitAt: 0, fellAt: 0 })

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
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [level, setLevelState] = useState<1 | 2>(1)

  // Il ciclo dei fotogrammi legge sempre i valori aggiornati da qui
  const live = useRef({
    mode: 'stars' as Mode,
    level: 1 as 1 | 2,
    sound,
    voice,
    profile,
    caught: 0,
    target: 0,
    correct: 0,
    holdFrom: 0,
    pauseUntil: 0,
    streak: 0,
    best: 0,
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

  // Cosa dire e preparare quando un'attività comincia (con la fotocamera accesa)
  const begin = useCallback(
    (m: Mode) => {
      if (m === 'count') return newTarget()
      const hint = MODE_HINT[m]
      if (hint) say(t(`hands.${hint}`))
    },
    [newTarget, say, t]
  )

  // «Termina il gioco»: fotocamera spenta, si torna alla schermata d'inizio
  const end = () => {
    stop()
    try {
      if (live.current.voice) speechSynthesis.cancel()
    } catch {
      // voce non disponibile
    }
    setStatus('idle')
    setSeen(false)
    setShown(null)
  }

  const setMode = (m: Mode) => {
    live.current.mode = m
    setModeState(m)
    if (streamRef.current) begin(m)
  }

  const setLevel = (l: 1 | 2) => {
    live.current.level = l
    setLevelState(l)
    if (streamRef.current) say(t(l === 2 ? 'hands.level2Hint' : 'hands.catchHint'))
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
    let balloon = newBalloon()
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
      // Le stesse punte con il dito (0 pollice … 4 mignolo), per il livello 2 delle stelle
      const fingerTips = result.landmarks.flatMap((hand) => FINGERTIPS.map((i, finger) => ({ x: px(hand[i])[0], y: px(hand[i])[1], finger })))
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
        // Livello 1: qualsiasi dito prende qualsiasi stella. Livello 2: stelle
        // dei colori delle dita, si prendono solo con il dito dello stesso
        // colore (con quello sbagliato la stella rimbalza un po' più in là).
        // KUMI guarda dal suo angolo
        const two = L.level === 2
        for (let i = stars.length - 1; i >= 0; i--) if (stars[i].level !== L.level) stars.splice(i, 1)
        while (stars.length < 3)
          stars.push({ x: 0.12 + rand() * 0.76, y: 0.12 + rand() * 0.6, color: Math.floor(rand() * (two ? FINGER_COLORS.length : STAR_COLORS.length)), born: time, level: L.level, bumpUntil: 0 })
        for (let i = stars.length - 1; i >= 0; i--) {
          const s = stars[i]
          const color = two ? FINGER_COLORS[s.color] : STAR_COLORS[s.color]
          const age = (time - s.born) / 1000
          const sx = (s.x + Math.sin(age * 1.3 + i) * 0.02) * w
          const sy = (s.y + Math.cos(age * 1.1 + i) * 0.02) * h
          const r = 26 * u * Math.min(1, age * 3)
          const shake = time < s.bumpUntil ? Math.sin(time / 30) * 6 * u : 0
          drawStar(ctx, sx + shake, sy, r, age, color)
          const touching = fingerTips.filter(({ x, y }) => Math.hypot(x - sx, y - sy) < r + 12 * u)
          if (!touching.length) continue
          if (!two || touching.some((tip) => tip.finger === s.color)) {
            stars.splice(i, 1)
            burst(sx, sy, [color, '#FFFFFF', '#FFC93C'])
            if (L.sound) tone(s.color + 3, 0.12)
            scored()
          } else if (time > s.bumpUntil) {
            // Dito sbagliato: «boing» e la stella si sposta lontano dal dito
            s.bumpUntil = time + 600
            const away = touching[0]
            s.x = Math.min(0.88, Math.max(0.12, s.x + (sx > away.x ? 0.12 : -0.12)))
            s.y = Math.min(0.72, Math.max(0.12, s.y + (sy > away.y ? 0.08 : -0.08)))
            if (L.sound) tone(15, 0.08, 0.18)
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
            // Con la voce si aspetta che KUMI finisca «Bravo! Sono…» prima della domanda nuova
            const pause = L.voice ? 3200 : 1600
            L.pauseUntil = time + pause
            L.correct += 1
            setGood(true)
            burst(w / 2, h / 2, ['#F7C531', '#E8473B', '#7CC3EE', '#5DB14E', '#F49CBB'], 40)
            if (L.sound) melody([0, 4, 7, 11], 110)
            say(t('hands.countGood', { n: L.target }))
            if (L.correct % 5 === 0) reward()
            setTimeout(() => live.current.mode === 'count' && streamRef.current && newTarget(), pause)
          }
        } else if (shownNow !== L.target) L.holdFrom = 0
      }

      if (L.mode === 'balloon') {
        drawKumi(ctx, kumi, w - 64 * u, h - 62 * u, 110 * u, time, !!first)
        const b = balloon
        const radius = 0.075
        if (b.fellAt) {
          // Caduto: dopo un attimo ne scende uno nuovo dall'alto
          if (time - b.fellAt > 1400) balloon = newBalloon((b.color + 1) % KEY_COLORS.length)
        } else {
          // Si muove in coordinate 0–1 (y verso il basso), rimbalza sui lati
          b.vy += BALLOON_GRAVITY
          b.vx *= 0.99
          b.x += b.vx
          b.y += b.vy
          if (b.x < radius || b.x > 1 - radius) {
            b.x = Math.min(1 - radius, Math.max(radius, b.x))
            b.vx = -b.vx * 0.8
          }
          // Colpo: un punto della mano lo tocca mentre scende (o dopo un attimo dall'ultimo colpo)
          const hit = result.landmarks
            .flatMap((hand) => BALLOON_POINTS.map((i) => ({ x: 1 - hand[i].x, y: hand[i].y })))
            .find((p) => Math.hypot((p.x - b.x) * (w / h), p.y - b.y) < radius * 1.15)
          if (hit && time - b.hitAt > 280 && (b.vy > -0.004 || time - b.hitAt > 700)) {
            b.hitAt = time
            b.vy = -BALLOON_PUSH
            b.vx = Math.max(-0.008, Math.min(0.008, (b.x - hit.x) * 0.12))
            b.color = (b.color + 1) % KEY_COLORS.length
            L.streak += 1
            setStreak(L.streak)
            if (L.streak > L.best) {
              L.best = L.streak
              setBest(L.best)
            }
            burst(b.x * w, b.y * h, [KEY_COLORS[b.color], '#FFFFFF'], 8)
            if (L.sound) tone(Math.min(15, L.streak), 0.12, 0.25)
            scored()
          }
          if (b.y > 1 + radius) {
            b.fellAt = time
            if (L.streak > 0) {
              if (L.sound) melody([7, 4, 0], 120)
              say(t('hands.balloonFell'))
            }
            L.streak = 0
            setStreak(0)
          }
        }
        if (!b.fellAt) drawBalloon(ctx, b.x * w, b.y * h, radius * h, KEY_COLORS[b.color], u, time)
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
  const counter = mode === 'stars' || mode === 'bubbles' ? caught : mode === 'balloon' ? streak : null

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

      {/* Prendi le stelle: livello 1 (qualsiasi dito) o 2 (dito dello stesso colore) */}
      {mode === 'stars' && (
        <div className="flex flex-wrap items-center justify-center gap-2" role="radiogroup" aria-label={t('hands.levelLabel')}>
          {([1, 2] as const).map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              onClick={() => setLevel(l)}
              className={`flex min-h-10 items-center gap-1.5 rounded-full border-[3px] border-[#2B2D52] px-4 text-sm font-extrabold text-[#2B2D52] shadow-[2px_2px_0_#2B2D52] ${level === l ? 'bg-[#FFC93C]' : 'bg-white'}`}
            >
              {t('hands.level', { n: l })}
              {l === 2 && (
                <span className="flex -space-x-1" aria-hidden>
                  {FINGER_COLORS.map((c) => (
                    <span key={c} className="h-3 w-3 rounded-full border-2 border-[#2B2D52]" style={{ background: c }} />
                  ))}
                </span>
              )}
            </button>
          ))}
          {level === 2 && <p className="w-full text-center text-xs font-bold text-[#61648A]">{t('hands.level2Hint')}</p>}
        </div>
      )}

      {/* Fotocamera */}
      <div className="flex min-h-[180px] flex-1 items-center justify-center [container-type:size]">
        <div className="relative">
          <KidChip />
          <div className="relative mx-auto aspect-[4/3] w-[min(calc(100cqw-104px),calc((100cqh-6px)*1.333))] min-w-[220px] overflow-hidden rounded-[22px] border-[3px] border-[#2B2D52] bg-[#E6ECF8] shadow-[5px_5px_0_#2B2D52]">
            <video ref={videoRef} playsInline muted className="hidden" />
            <canvas ref={canvasRef} className={`block h-full w-full object-cover ${running ? '' : 'hidden'}`} />

            {running && counter !== null && (
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border-[3px] border-[#2B2D52] bg-white px-2.5 py-1 text-lg font-extrabold tabular-nums text-[#2B2D52]" aria-label={`${t(mode === 'balloon' ? 'hands.balloonHits' : 'hands.caught')}: ${counter}`}>
                <Star className="h-5 w-5 fill-[#FFC93C] text-[#2B2D52]" aria-hidden /> {counter}
              </span>
            )}
            {running && mode === 'balloon' && best > 0 && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border-[3px] border-[#2B2D52] bg-[#FFF3C4] px-2.5 py-1 text-sm font-extrabold tabular-nums text-[#2B2D52]">
                <Trophy className="h-4 w-4" aria-hidden /> {t('hands.balloonBest', { n: best })}
              </span>
            )}
            {running && mode === 'count' && target > 0 && (
              <div className={`absolute inset-x-2 top-2 flex items-center justify-between gap-2 rounded-2xl border-[3px] border-[#2B2D52] px-3 py-1.5 font-extrabold text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] ${good || fingersDone ? 'bg-[#C8F0D2]' : 'bg-white'}`} role="status">
                <span className="text-base leading-tight sm:text-lg">{good ? t('hands.countGood', { n: target }) : t('hands.countAsk', { n: target })}</span>
                <span className="text-4xl tabular-nums">{shown ?? '–'}</span>
              </div>
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

      {/* Termina: fotocamera spenta in qualsiasi attività */}
      {running && (
        <div className="flex justify-center">
          <KidsButton onClick={end}>
            <Power className="h-5 w-5" /> {t('hands.end')}
          </KidsButton>
        </div>
      )}
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

// Palloncino colorato con riflesso, nodino e filo che ondeggia
function drawBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, u: number, time: number) {
  ctx.save()
  ctx.lineWidth = 2.5 * u
  ctx.strokeStyle = '#2B2D52'
  ctx.beginPath()
  ctx.moveTo(x, y + r * 1.15)
  ctx.quadraticCurveTo(x + Math.sin(time / 300) * r * 0.4, y + r * 1.8, x, y + r * 2.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - r * 0.15, y + r * 1.22)
  ctx.lineTo(x + r * 0.15, y + r * 1.22)
  ctx.lineTo(x, y + r * 1.05)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x, y, r * 0.9, r * 1.1, 0, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 4 * u
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(x - r * 0.35, y - r * 0.45, r * 0.18, r * 0.3, -0.5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fill()
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
