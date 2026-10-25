'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUp, Broom, Eraser, Hand, Moon, Music, Star, Undo2 } from 'lucide-react'
import { ERASER, paletteFor } from '@/lib/kids/catalog'
import { KIDS_SVG_CSS, applyPivots, type Move } from '@/lib/kids/moves'
import type { Drawing } from '@/lib/kids/types'
import type { CurrentDrawing, KidProfile } from '@/lib/kids/storage'
import { melody, speak, tone } from './kidsAudio'
import Kumi from './Kumi'

// Foglio da colorare e animare, usato da «Colora e Anima» e da «Crea il tuo
// animale»: tocchi per colorare, missioni, risveglio con i complimenti,
// movimenti. Chi lo usa decide dove salvare lo stato (onState).

// Ora e caso solo nei gestori degli eventi (mai durante il disegno della pagina)
const now = () => Date.now()
const rand = () => Math.random()

const MOVE_ICONS: Record<Move, typeof Hand> = { saluta: Hand, balla: Music, salta: ArrowUp, nanna: Moon }

export default function ColorStage({
  drawing,
  state,
  onState,
  profile,
  sound,
  voice,
  missions = true,
  praise,
  onFinished,
  children,
}: {
  drawing: Drawing
  state: CurrentDrawing
  onState: (next: Partial<CurrentDrawing>, extra?: Partial<KidProfile>) => void
  profile: KidProfile
  sound: boolean
  voice: boolean
  missions?: boolean
  // Complimenti a disegno finito: scritti (con il nome) e detti dalla voce (senza)
  praise: () => { text: string; voice: string }
  onFinished: (fills: Record<string, string>) => void
  // Pulsanti in più nella riga delle azioni
  children?: React.ReactNode
}) {
  const t = useTranslations('kids')
  const locale = useLocale()
  const palette = useMemo(() => paletteFor(profile.age), [profile.age])
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [colorIndex, setColorIndex] = useState(0)
  const [eraser, setEraser] = useState(false)
  const [mode, setMode] = useState<Move>('saluta')
  // Ogni passo annullabile: un pezzo colorato oppure «Pulisci» (tutti i colori di prima)
  const [undo, setUndo] = useState<{ key: string; list: ({ part: string; prev: string | null } | { all: Record<string, string> })[] }>({ key: '', list: [] })
  const [bubble, setBubble] = useState<{ text: string; key: number; cheer?: boolean } | null>(null)
  const [hint, setHint] = useState<{ text: string; color: string; x: number; y: number; key: number } | null>(null)
  const fills = state.fills
  const awake = state.awake
  // «Annulla» vale solo per il disegno in corso
  const undoList = undo.key === drawing.svg ? undo.list : []

  const say = useCallback((text: string) => voice && speak(text, locale), [voice, locale])
  const beep = useCallback((i: number, v?: number) => sound && tone(i, v), [sound])

  // Disegno mostrato: SVG, perni e colori salvati
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
  const mission = missions && profile.age >= 5 && !awake ? state.mission : null
  useEffect(() => {
    if (!missions || profile.age < 5 || awake || state.mission) return
    const free = drawing.figure.filter((p) => !fills[p])
    if (!free.length) return
    const part = free[Math.floor(rand() * free.length)]
    const color = palette[Math.floor(rand() * palette.length)].hex
    onState({ mission: { part, color } })
  }, [missions, profile.age, awake, state.mission, drawing, fills, palette, onState])

  const colorName = (hex: string) => {
    const c = palette.find((p) => p.hex === hex)
    return c ? t(`colors.${c.key}`) : ''
  }
  const partName = (part: string) => (t.has(`parts.${part}`) ? t(`parts.${part}`) : '')

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

  // Con cheer KUMI arriva ballando a fare i complimenti
  const showBubble = (text: string, cheer = false) => setBubble({ text, key: now(), cheer })
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
    const hex = eraser ? ERASER : (palette[colorIndex]?.hex ?? ERASER)
    const prev = fills[part] ?? null
    // Sveglio e stesso colore: la figura fa un saltello (solletico)
    if ((prev ?? ERASER) === hex) {
      if (awake && drawing.figure.includes(part)) {
        hop()
        if (sound) melody([4, 7], 90)
      }
      return
    }
    const nextFills = { ...fills }
    if (hex === ERASER) delete nextFills[part]
    else nextFills[part] = hex
    target
      .closest('svg')
      ?.querySelectorAll(`[data-r="${part}"]`)
      .forEach((el) => {
        el.classList.remove('flash')
        requestAnimationFrame(() => el.classList.add('flash'))
      })
    setUndo({ key: drawing.svg, list: [...undoList.slice(-49), { part, prev }] })
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
    if (!awake && drawing.figure.every((p) => nextFills[p])) {
      next = { ...next, awake: true, mission: null }
      extra = { ...extra, stars: (extra.stars ?? profile.stars) + 1 }
      setMode('saluta')
      setTimeout(() => {
        sparkle()
        hop()
        if (sound) melody([0, 2, 4, 7, 11], 120)
        // Il nome si legge nel fumetto; la voce dice la frase senza nome
        const p = praise()
        showBubble(p.text, true)
        say(p.voice)
      }, 250)
      onFinished(nextFills)
    }
    onState(next, extra)
  }

  const undoLast = () => {
    const last = undoList[undoList.length - 1]
    if (!last) return
    setUndo({ key: drawing.svg, list: undoList.slice(0, -1) })
    if ('all' in last) return onState({ fills: last.all, awake: drawing.figure.every((p) => last.all[p]) })
    const nextFills = { ...fills }
    if (last.prev) nextFills[last.part] = last.prev
    else delete nextFills[last.part]
    onState({ fills: nextFills })
  }

  // «Pulisci»: foglio di nuovo bianco e figura che torna a dormire («Annulla» lo riporta indietro)
  const clearAll = () => {
    if (!Object.keys(fills).length) return
    setUndo({ key: drawing.svg, list: [...undoList.slice(-49), { all: fills }] })
    setBubble(null)
    setMode('saluta')
    if (sound) melody([7, 4, 0], 90)
    onState({ fills: {}, awake: false })
  }

  const setMove = (m: Move) => {
    setMode(m)
    beep(['saluta', 'balla', 'salta', 'nanna'].indexOf(m) * 3, 0.1)
    showBubble(t(`moveSay.${m}`, { name: profile.name }))
    say(t(`moveVoice.${m}`))
  }

  const svgClass = `kids-svg block h-full w-full ${awake ? `alive mode-${mode}` : 'asleep'}`
  const missing = drawing.figure.filter((p) => !fills[p]).length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <style>{KIDS_SVG_CSS}</style>

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
          <span key={`hint-${hint.key}`} className="kids-hint pointer-events-none absolute -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-xl bg-[#2B2D52] px-3 py-1 text-sm font-extrabold text-white" style={{ left: hint.x, top: hint.y }}>
            <span className="mr-1 inline-block h-3 w-3 rounded-full border-2 border-white align-[-1px]" style={{ background: hint.color }} />
            {hint.text}
          </span>
        )}
        {bubble && (
          <div key={`bubble-${bubble.key}`} className="kids-bubble absolute inset-x-3 top-3 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-3 py-2 text-center text-base font-extrabold leading-snug text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] sm:px-4 sm:py-3 sm:text-lg" role="status">
            {bubble.text}
          </div>
        )}
        {bubble?.cheer && (
          <span key={`kumi-${bubble.key}`} className="kids-kumi pointer-events-none absolute bottom-1 left-1 w-[22%] min-w-16 max-w-28">
            <Kumi move="dance" className="block h-auto w-full" />
          </span>
        )}
        {!awake && <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs font-bold text-[#2B2D52]/70">{t('partsLeft', { count: missing })}</p>}
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
        <KidsButton onClick={undoLast} disabled={!undoList.length}>
          <Undo2 className="h-5 w-5" /> {t('undo')}
        </KidsButton>
        <KidsButton onClick={clearAll} disabled={!Object.keys(fills).length}>
          <Broom className="h-5 w-5" /> {t('clean')}
        </KidsButton>
        {children}
      </div>

      <style>{`
        .kids-hint { animation: kidsHint 1.3s ease forwards; }
        .kids-bubble { animation: kidsBubble .35s ease; }
        .kids-kumi { animation: kidsKumi .5s cubic-bezier(.3,1.5,.6,1); }
        @keyframes kidsKumi { from { opacity: 0; transform: translateY(60%) scale(.6); } to { opacity: 1; transform: none; } }
        @keyframes kidsHint { 0% { opacity: 0; margin-top: 8px; } 15% { opacity: 1; margin-top: 0; } 75% { opacity: 1; } 100% { opacity: 0; margin-top: -10px; } }
        @keyframes kidsBubble { from { opacity: 0; transform: translateY(-8px) scale(.95); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}

// Pulsanti grandi dell'Angolo Bambini
export function KidsButton({ onClick, disabled, accent, children, label }: { onClick: () => void; disabled?: boolean; accent?: boolean; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex min-h-12 items-center gap-2 rounded-2xl border-[3px] border-[#2B2D52] px-4 text-base font-extrabold shadow-[3px_3px_0_#2B2D52] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-40 ${accent ? 'bg-[#FF6A3D] text-white' : 'bg-white text-[#2B2D52]'}`}
    >
      {children}
    </button>
  )
}

export function KidsIconButton({ label, onClick, children, active, small }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={`flex ${small ? 'h-10 w-10 sm:h-12 sm:w-12' : 'h-12 w-12'} shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#2B2D52] text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none ${active ? 'bg-[#FFC93C]' : 'bg-white'}`}>
      {children}
    </button>
  )
}
