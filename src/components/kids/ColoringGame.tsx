'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BookImage, Dices, Eraser, Hand, LayoutGrid, Lock, Moon, Music, Share2, Star, Undo2, Volume2, VolumeX, ArrowUp, MessageCircle, MessageCircleOff } from 'lucide-react'
import { DRAWINGS, ERASER, drawingById, paletteFor, pickDrawing } from '@/lib/kids/catalog'
import { KIDS_SVG_CSS, applyPivots, type Move } from '@/lib/kids/moves'
import type { CurrentDrawing, KidProfile } from '@/lib/kids/storage'
import { melody, speak, tone } from './kidsAudio'

export type GameActions = {
  // Chiede il codice del genitore, poi esegue (uscire, condividere, stampare)
  askParent: (purpose: 'exit' | 'share', then: () => void) => void
  openAlbum: () => void
  openShare: (drawingId: string, fills: Record<string, string>) => void
  switchChild: () => void
  saveFinished: (drawingId: string, fills: Record<string, string>) => void
}

// Ora e caso solo nei gestori degli eventi (mai durante il disegno della pagina)
const now = () => Date.now()
const rand = () => Math.random()

const MOVE_ICONS: Record<Move, typeof Hand> = { saluta: Hand, balla: Music, salta: ArrowUp, nanna: Moon }

export default function ColoringGame({
  profile,
  sound,
  voice,
  onToggleSound,
  onToggleVoice,
  onProfileChange,
  actions,
}: {
  profile: KidProfile
  sound: boolean
  voice: boolean
  onToggleSound: () => void
  onToggleVoice: () => void
  onProfileChange: (profile: KidProfile) => void
  actions: GameActions
}) {
  const t = useTranslations('kids')
  const locale = useLocale()
  const palette = useMemo(() => paletteFor(profile.age), [profile.age])
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [colorIndex, setColorIndex] = useState(0)
  const [eraser, setEraser] = useState(false)
  const [mode, setMode] = useState<Move>('saluta')
  const [undo, setUndo] = useState<{ part: string; prev: string | null }[]>([])
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null)
  const [hint, setHint] = useState<{ text: string; color: string; x: number; y: number; key: number } | null>(null)
  const [chooser, setChooser] = useState(false)

  // Disegno in corso (ripreso da dove era rimasto) o uno nuovo a caso
  const current: CurrentDrawing = useMemo(() => {
    if (profile.current && drawingById(profile.current.drawingId)) return profile.current
    const d = pickDrawing({ age: profile.age, gender: profile.gender, recent: profile.recent, done: profile.done })
    return { drawingId: d.id, fills: {}, awake: false, mission: null }
  }, [profile])
  const drawing = drawingById(current.drawingId)!
  const fills = current.fills
  const awake = current.awake

  // Il disegno scelto a caso si salva subito: riaprendo si ritrova lo stesso
  useEffect(() => {
    if (!profile.current) onProfileChange({ ...profile, recent: [...profile.recent, current.drawingId].slice(-6), current })
  }, [profile, current, onProfileChange])

  const say = useCallback((text: string) => voice && speak(text, locale), [voice, locale])
  const beep = useCallback((i: number, v?: number) => sound && tone(i, v), [sound])

  const update = useCallback(
    (next: Partial<CurrentDrawing>, extra: Partial<KidProfile> = {}) => {
      onProfileChange({ ...profile, ...extra, current: { ...current, ...next } })
    },
    [profile, current, onProfileChange]
  )

  // Disegno mostrato: SVG del disegno, perni e colori salvati
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.innerHTML = drawing.svg
    applyPivots(svg)
  }, [drawing])
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    svg.querySelectorAll<SVGElement>('[data-r]').forEach((el) => {
      el.style.fill = fills[el.getAttribute('data-r') ?? ''] ?? ERASER
    })
  }, [fills, drawing])

  // Missione per chi ha almeno 5 anni: «Colora la pancia di rosso»
  const mission = profile.age >= 5 && !awake ? current.mission : null
  useEffect(() => {
    if (profile.age < 5 || awake || current.mission) return
    const free = drawing.figure.filter((p) => !fills[p])
    if (!free.length) return
    const part = free[Math.floor(rand() * free.length)]
    const color = palette[Math.floor(rand() * palette.length)].hex
    update({ mission: { part, color } })
  }, [profile.age, awake, current.mission, drawing, fills, palette, update])

  const colorName = (hex: string) => {
    const c = palette.find((p) => p.hex === hex)
    return c ? t(`colors.${c.key}`) : ''
  }
  const partName = (part: string) => (t.has(`parts.${part}`) ? t(`parts.${part}`) : '')
  const praise = () => t('praise', { name: profile.name, gender: profile.gender })

  const sparkle = () => {
    const svg = svgRef.current
    if (!svg) return
    const colors = ['#FFC93C', '#FF6A3D', '#7CC3EE', '#F49CBB', '#5DB14E']
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2
      const r = 110 + rand() * 70
      const x = 200 + r * Math.cos(a)
      const y = 230 + r * Math.sin(a) * 0.9
      const k = 6 + rand() * 7
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      s.setAttribute('d', `M${x} ${y - k} L${x + k * 0.3} ${y - k * 0.3} L${x + k} ${y} L${x + k * 0.3} ${y + k * 0.3} L${x} ${y + k} L${x - k * 0.3} ${y + k * 0.3} L${x - k} ${y} L${x - k * 0.3} ${y - k * 0.3} Z`)
      s.setAttribute('fill', colors[i % colors.length])
      s.setAttribute('class', 'spark')
      s.style.animationDelay = `${rand() * 0.25}s`
      svg.appendChild(s)
      setTimeout(() => s.remove(), 1300)
    }
  }
  const hop = () => {
    const fig = svgRef.current?.querySelector('[data-role="figure"]')
    if (!fig) return
    fig.classList.remove('waking')
    void (fig as SVGGraphicsElement).getBBox()
    fig.classList.add('waking')
    setTimeout(() => fig.classList.remove('waking'), 750)
  }

  const showBubble = (text: string) => setBubble({ text, key: now() })
  useEffect(() => {
    if (!bubble) return
    const timer = setTimeout(() => setBubble(null), 5000)
    return () => clearTimeout(timer)
  }, [bubble])
  useEffect(() => {
    if (!hint) return
    const timer = setTimeout(() => setHint(null), 1300)
    return () => clearTimeout(timer)
  }, [hint])

  const onTap = (ev: React.MouseEvent<SVGSVGElement>) => {
    const target = (ev.target as Element).closest('[data-r]')
    if (!target) return
    const part = target.getAttribute('data-r') ?? ''
    const hex = eraser ? ERASER : palette[colorIndex]?.hex ?? ERASER
    const prev = fills[part] ?? null
    // Sveglio e stesso colore: la figura fa un saltello (solletico)
    if ((prev ?? ERASER) === hex) {
      if (awake && drawing.figure.includes(part)) {
        hop()
        melody([4, 7], 90)
      }
      return
    }
    const nextFills = { ...fills }
    if (hex === ERASER) delete nextFills[part]
    else nextFills[part] = hex
    target.closest('svg')?.querySelectorAll(`[data-r="${part}"]`).forEach((el) => {
      el.classList.remove('flash')
      requestAnimationFrame(() => el.classList.add('flash'))
    })
    setUndo((u) => [...u.slice(-49), { part, prev }])
    beep(eraser ? 15 : colorIndex)
    const box = stageRef.current?.getBoundingClientRect()
    if (box) setHint({ text: partName(part), color: hex, x: ev.clientX - box.left, y: ev.clientY - box.top, key: now() })

    let extra: Partial<KidProfile> = {}
    let next: Partial<CurrentDrawing> = { fills: nextFills }
    // Missione compiuta
    if (mission && mission.part === part && mission.color === hex) {
      extra = { stars: profile.stars + 1 }
      next = { ...next, mission: null }
      setTimeout(() => sound && melody([0, 4, 7, 11], 110), 200)
      say(t('missionDone', { gender: profile.gender }))
    } else if (hex !== ERASER) {
      say(`${partName(part)} ${colorName(hex)}`.trim())
    }
    // Figura tutta colorata: si sveglia, fa i complimenti e va nell'album
    const finished = !awake && drawing.figure.every((p) => nextFills[p])
    if (finished) {
      next = { ...next, awake: true, mission: null }
      extra = {
        ...extra,
        stars: (extra.stars ?? profile.stars) + 1,
        done: profile.done.includes(drawing.id) ? profile.done : [...profile.done, drawing.id],
      }
      setMode('saluta')
      setTimeout(() => {
        sparkle()
        hop()
        if (sound) melody([0, 2, 4, 7, 11], 120)
        const text = praise()
        showBubble(text)
        say(text)
      }, 250)
      actions.saveFinished(drawing.id, nextFills)
    }
    update(next, extra)
  }

  const undoLast = () => {
    const last = undo[undo.length - 1]
    if (!last) return
    setUndo((u) => u.slice(0, -1))
    const nextFills = { ...fills }
    if (last.prev) nextFills[last.part] = last.prev
    else delete nextFills[last.part]
    update({ fills: nextFills })
  }

  const startDrawing = (id?: string) => {
    const d = id ? drawingById(id)! : pickDrawing({ age: profile.age, gender: profile.gender, recent: [...profile.recent, current.drawingId], done: profile.done })
    setUndo([])
    setBubble(null)
    setMode('saluta')
    setChooser(false)
    onProfileChange({
      ...profile,
      recent: [...profile.recent.filter((r) => r !== d.id), d.id].slice(-6),
      current: { drawingId: d.id, fills: {}, awake: false, mission: null },
    })
    say(t('newDrawingSay', { drawing: t(`drawings.${d.id}`) }))
  }

  const setMove = (m: Move) => {
    setMode(m)
    beep(['saluta', 'balla', 'salta', 'nanna'].indexOf(m) * 3, 0.1)
    const line = t(`moveSay.${m}`, { name: profile.name })
    showBubble(line)
    say(line)
  }

  const svgClass = `kids-svg block h-full w-full ${awake ? `alive mode-${mode}` : 'asleep'}`
  const missing = drawing.figure.filter((p) => !fills[p]).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <style>{KIDS_SVG_CSS}</style>

      {/* Barra in alto: bambino, stelle, album, disegni, lucchetto */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={actions.switchChild} className="flex min-w-0 items-center gap-2 rounded-full border-[3px] border-[#2B2D52] bg-white py-1 pl-1 pr-3 font-extrabold text-[#2B2D52]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg text-white" style={{ background: profile.color }}>
            {profile.name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{profile.name}</span>
        </button>
        <span className="flex items-center gap-1 rounded-full bg-[#FFC93C] px-3 py-1.5 font-extrabold text-[#2B2D52]" aria-label={t('starsLabel', { count: profile.stars })}>
          <Star className="h-5 w-5 fill-current" aria-hidden /> {profile.stars}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <IconButton label={t('album')} onClick={actions.openAlbum}><BookImage className="h-6 w-6" /></IconButton>
          <IconButton label={t('chooseDrawing')} onClick={() => setChooser(true)}><LayoutGrid className="h-6 w-6" /></IconButton>
          <IconButton label={t('exit')} onClick={() => actions.askParent('exit', () => {})}><Lock className="h-6 w-6" /></IconButton>
        </div>
      </div>

      {/* Missione */}
      {mission && (
        <button type="button" onClick={() => say(t('missionSay', { part: partName(mission.part), color: colorName(mission.color) }))} className="flex items-center justify-center gap-2 rounded-2xl border-[3px] border-[#2B2D52] bg-[#FFF3C4] px-3 py-2 text-base font-extrabold text-[#2B2D52]">
          <Star className="h-5 w-5 shrink-0 text-[#F2A900]" aria-hidden />
          <span>
            {t.rich('mission', {
              part: () => <span className="rounded-full bg-white px-2">{partName(mission.part)}</span>,
              color: () => (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2">
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-[#2B2D52]" style={{ background: mission.color }} />
                  {colorName(mission.color)}
                </span>
              ),
            })}
          </span>
        </button>
      )}

      {/* Foglio da colorare */}
      <div ref={stageRef} className="relative mx-auto aspect-[400/440] w-full max-w-[min(100%,calc((100dvh-330px)*0.909))] min-h-[220px] overflow-hidden rounded-[22px] border-[3px] border-[#2B2D52] bg-white shadow-[5px_5px_0_#2B2D52]">
        <svg ref={svgRef} viewBox="0 0 400 440" className={svgClass} onClick={onTap} role="img" aria-label={t(`drawings.${drawing.id}`)} />
        {hint && hint.text && (
          <span key={hint.key} className="kids-hint pointer-events-none absolute -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-xl bg-[#2B2D52] px-3 py-1 text-sm font-extrabold text-white" style={{ left: hint.x, top: hint.y }}>
            <span className="mr-1 inline-block h-3 w-3 rounded-full border-2 border-white align-[-1px]" style={{ background: hint.color }} />
            {hint.text}
          </span>
        )}
        {bubble && (
          <div key={bubble.key} className="kids-bubble absolute inset-x-3 top-3 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-3 py-2 text-center text-base font-extrabold sm:px-4 sm:py-3 sm:text-lg leading-snug text-[#2B2D52] shadow-[3px_3px_0_#2B2D52]" role="status">
            {bubble.text}
          </div>
        )}
        {!awake && (
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-bold text-[#2B2D52]/70">{t('partsLeft', { count: missing })}</p>
        )}
      </div>

      {/* Pastelli tondi */}
      <div className="flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('colorsLabel')}>
        {palette.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setColorIndex(i)
              setEraser(false)
              beep(i, 0.07)
            }}
            aria-label={t(`colors.${c.key}`)}
            aria-pressed={!eraser && colorIndex === i}
            className={`h-11 w-11 rounded-full border-[3px] border-[#2B2D52] transition-transform sm:h-12 sm:w-12 ${!eraser && colorIndex === i ? 'scale-110 ring-4 ring-[#2B2D52] ring-offset-2' : ''}`}
            style={{ background: c.hex }}
          />
        ))}
        <button
          type="button"
          onClick={() => setEraser(true)}
          aria-label={t('eraser')}
          aria-pressed={eraser}
          className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#2B2D52] bg-white text-[#2B2D52] sm:h-12 sm:w-12 ${eraser ? 'scale-110 ring-4 ring-[#2B2D52] ring-offset-2' : ''}`}
        >
          <Eraser className="h-5 w-5" />
        </button>
      </div>

      {/* Movimenti (quando è sveglio) */}
      {awake && (
        <div className="grid grid-cols-4 gap-2">
          {(['saluta', 'balla', 'salta', 'nanna'] as Move[]).map((m) => {
            const Icon = MOVE_ICONS[m]
            return (
              <button key={m} type="button" onClick={() => setMove(m)} aria-pressed={mode === m} className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border-[3px] border-[#2B2D52] text-sm font-extrabold text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] ${mode === m ? 'bg-[#FFC93C]' : 'bg-white'}`}>
                <Icon className="h-6 w-6" aria-hidden />
                {t(`moves.${m}`)}
              </button>
            )
          })}
        </div>
      )}

      {/* Azioni */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ActionButton onClick={undoLast} disabled={!undo.length}><Undo2 className="h-5 w-5" /> {t('undo')}</ActionButton>
        <ActionButton onClick={() => startDrawing()} accent><Dices className="h-5 w-5" /> {t('newDrawing')}</ActionButton>
        {awake && <ActionButton onClick={() => actions.openShare(drawing.id, fills)}><Share2 className="h-5 w-5" /> {t('saveShare')}</ActionButton>}
        <IconButton label={sound ? t('soundOff') : t('soundOn')} onClick={onToggleSound}>{sound ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}</IconButton>
        <IconButton label={voice ? t('voiceOff') : t('voiceOn')} onClick={onToggleVoice}>{voice ? <MessageCircle className="h-6 w-6" /> : <MessageCircleOff className="h-6 w-6" />}</IconButton>
      </div>

      {/* Scegli il disegno */}
      {chooser && (
        <div className="fixed inset-0 z-10 flex flex-col bg-[#F3F7FB] p-4" role="dialog" aria-modal="true" aria-label={t('chooseDrawing')}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#2B2D52]">{t('chooseDrawing')}</h2>
            <button type="button" onClick={() => setChooser(false)} className="rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 py-2 font-extrabold text-[#2B2D52]">
              {t('close')}
            </button>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto pb-6 sm:grid-cols-4 md:grid-cols-5">
            {DRAWINGS.map((d) => (
              <button key={d.id} type="button" onClick={() => startDrawing(d.id)} className="relative overflow-hidden rounded-2xl border-[3px] border-[#2B2D52] bg-white p-1 text-center">
                <svg viewBox="0 0 400 440" className="kids-svg asleep pointer-events-none block w-full" dangerouslySetInnerHTML={{ __html: d.svg }} aria-hidden />
                <span className="block truncate px-1 pb-1 text-sm font-extrabold text-[#2B2D52]">{t(`drawings.${d.id}`)}</span>
                {profile.done.includes(d.id) && (
                  <span className="absolute right-1 top-1 rounded-full bg-[#FFC93C] p-1 text-[#2B2D52]" aria-label={t('doneBadge')}>
                    <Star className="h-4 w-4 fill-current" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      <style>{`
        .kids-hint { animation: kidsHint 1.3s ease forwards; }
        .kids-bubble { animation: kidsBubble .35s ease; }
        @keyframes kidsHint { 0% { opacity: 0; margin-top: 8px; } 15% { opacity: 1; margin-top: 0; } 75% { opacity: 1; } 100% { opacity: 0; margin-top: -10px; } }
        @keyframes kidsBubble { from { opacity: 0; transform: translateY(-8px) scale(.95); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-[#2B2D52] bg-white text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
      {children}
    </button>
  )
}

function ActionButton({ onClick, disabled, accent, children }: { onClick: () => void; disabled?: boolean; accent?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 items-center gap-2 rounded-2xl border-[3px] border-[#2B2D52] px-4 text-base font-extrabold shadow-[3px_3px_0_#2B2D52] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-40 ${accent ? 'bg-[#FF6A3D] text-white' : 'bg-white text-[#2B2D52]'}`}
    >
      {children}
    </button>
  )
}
