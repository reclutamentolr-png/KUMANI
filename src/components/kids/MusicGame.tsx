'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, Bot, Dices, Eraser, Gauge, ListMusic, Play, Save, Square, Trash2, Wind } from 'lucide-react'
import { PALETTE, drawingById } from '@/lib/kids/catalog'
import { assembleCreature } from '@/lib/kids/creature'
import { KIDS_SVG_CSS, applyPivots } from '@/lib/kids/moves'
import { newId, type KidProfile, type Song } from '@/lib/kids/storage'
import { KidsButton, KidsIconButton } from './ColorStage'
import { INSTRUMENTS, melody, playNote, type Instrument } from './kidsAudio'
import type { KidsActions } from './actions'

// «La musica dei colori»: ogni pastello è una nota. Il bambino colora i fiori
// della fila, preme «Suona» e il suo personaggio balla sulla melodia che ha
// «dipinto». Le note sono di una scala pentatonica: qualunque combinazione
// suona bene. Le canzoni restano nel telefono.

const rand = () => Math.random()
const now = () => Date.now()

// 8 colori dell'arcobaleno = 8 note (do re mi sol la do re mi)
const NOTE_COLORS = ['red', 'orange', 'yellow', 'green', 'lightBlue', 'blue', 'purple', 'pink'].map((key) => PALETTE.find((p) => p.key === key)!)
const STEPS = 12
const TEMPOS = [560, 400, 270]
const MAX_SONGS = 12
const INSTRUMENT_ICON: Record<Instrument, typeof Bell> = { xilofono: ListMusic, flauto: Wind, campanelle: Bell, robot: Bot }

const emptySong = (): (number | null)[] => Array(STEPS).fill(null)

export default function MusicGame({
  profile,
  sound,
  onProfileChange,
  actions,
}: {
  profile: KidProfile
  sound: boolean
  onProfileChange: (profile: KidProfile) => void
  actions: KidsActions
}) {
  const t = useTranslations('kids')
  const [notes, setNotes] = useState<(number | null)[]>(emptySong)
  const [color, setColor] = useState<number | null>(0)
  const [instrument, setInstrument] = useState<Instrument>('xilofono')
  const [tempo, setTempo] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState(-1)
  const [list, setList] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dancerRef = useRef<SVGSVGElement>(null)

  // Chi balla: la creatura del bambino se l'ha colorata, altrimenti l'orsetto
  const creature = profile.creature
  const current = profile.current
  const dancer = useMemo(() => {
    if (creature?.awake) return { svg: assembleCreature(creature.sel).svg, fills: creature.fills }
    const bear = drawingById('orsetto')!
    const done = current?.drawingId === 'orsetto' ? current.fills : null
    return { svg: bear.svg, fills: done ?? { testa: '#D9A86C', orecchioSx: '#D9A86C', orecchioDx: '#D9A86C', corpo: '#D9A86C', braccioSx: '#D9A86C', braccioDx: '#D9A86C', piedeSx: '#9A6234', piedeDx: '#9A6234', pancia: '#F1D9B5', muso: '#F1D9B5', naso: '#3B3A4A', fiocco: '#E8473B', cielo: '#7CC3EE', prato: '#5DB14E', sole: '#F7C531', raggi: '#F7C531' } }
  }, [creature, current])

  useEffect(() => {
    const svg = dancerRef.current
    if (!svg) return
    svg.innerHTML = dancer.svg
    applyPivots(svg)
    svg.querySelectorAll<SVGElement>('[data-r]').forEach((el) => {
      el.style.fill = dancer.fills[el.getAttribute('data-r') ?? ''] ?? '#FFFFFF'
    })
  }, [dancer])

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setPlaying(false)
    setStep(-1)
  }, [])
  useEffect(() => stop, [stop])

  const hop = () => {
    const fig = dancerRef.current?.querySelector('[data-role="figure"]')
    if (!fig) return
    fig.classList.remove('waking')
    void (fig as SVGGraphicsElement).getBBox()
    fig.classList.add('waking')
  }

  const play = () => {
    if (playing) return stop()
    setPlaying(true)
    let i = 0
    const tick = () => {
      setStep(i)
      const n = notes[i]
      if (n !== null && n !== undefined) {
        if (sound) playNote(n, instrument)
        hop()
      }
      i += 1
      if (i >= STEPS) {
        timer.current = setTimeout(() => {
          stop()
          if (sound) melody([0, 4, 7], 110)
        }, TEMPOS[tempo])
        return
      }
      timer.current = setTimeout(tick, TEMPOS[tempo])
    }
    tick()
  }

  const tapStep = (i: number) => {
    const next = [...notes]
    // Stesso colore di nuovo (o gomma): il fiore torna vuoto, cioè una pausa
    next[i] = color === null || notes[i] === color ? null : color
    setNotes(next)
    if (next[i] !== null && sound) playNote(next[i]!, instrument)
  }

  const randomSong = () => {
    stop()
    // Melodia a caso che «cammina» tra note vicine, con qualche pausa
    let n = Math.floor(rand() * 4)
    const song = Array.from({ length: STEPS }, (_, i) => {
      if (i % 4 === 3 && rand() < 0.4) return null
      n = Math.max(0, Math.min(7, n + Math.round(rand() * 4 - 2)))
      return n
    })
    setNotes(song)
  }

  const songs = profile.songs ?? []
  const saveSong = () => {
    if (notes.every((n) => n === null)) return actions.toast(t('musicEmpty'))
    // Canzone uguale a una già salvata: niente doppione e niente stella in più
    const same = (song: Song) => song.instrument === instrument && song.tempo === tempo && song.notes.every((n, i) => n === notes[i])
    if (songs.some(same)) return actions.toast(t('musicSaved'))
    const song: Song = { id: newId(), name: t('musicSongName', { name: profile.name, n: songs.length + 1 }), notes, instrument, tempo, createdAt: now() }
    onProfileChange({ ...profile, songs: [song, ...songs].slice(0, MAX_SONGS), stars: profile.stars + 1 })
    if (sound) melody([0, 2, 4, 7], 110)
    actions.toast(t('musicSaved'))
  }
  const loadSong = (song: Song) => {
    stop()
    setNotes([...song.notes, ...emptySong()].slice(0, STEPS))
    setInstrument((INSTRUMENTS as readonly string[]).includes(song.instrument) ? (song.instrument as Instrument) : 'xilofono')
    setTempo(song.tempo)
    setList(false)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <style>{KIDS_SVG_CSS}</style>

      {/* Chi balla */}
      <div className="relative mx-auto aspect-[400/440] w-full max-w-[min(70%,calc((100dvh-470px)*0.909))] min-h-[150px] overflow-hidden rounded-[22px] border-[3px] border-[#2B2D52] bg-white shadow-[5px_5px_0_#2B2D52]">
        <svg ref={dancerRef} viewBox="0 0 400 440" className={`kids-svg pointer-events-none block h-full w-full alive ${playing ? 'mode-balla' : 'mode-saluta'}`} aria-hidden />
      </div>

      {/* I fiori della canzone */}
      <div className="grid grid-cols-6 gap-2" role="group" aria-label={t('musicTrack')}>
        {notes.map((n, i) => (
          <button
            key={i}
            type="button"
            onClick={() => tapStep(i)}
            aria-label={n === null ? t('musicPause', { n: i + 1 }) : t('musicNote', { n: i + 1, color: t(`colors.${NOTE_COLORS[n].key}`) })}
            className={`relative aspect-square rounded-full border-[3px] transition-transform ${step === i ? 'scale-110 border-[#FF6A3D] ring-4 ring-[#FFC93C]' : 'border-[#2B2D52]'} ${n === null ? 'border-dashed bg-white' : ''}`}
            style={n === null ? undefined : { background: NOTE_COLORS[n].hex }}
          >
            <span className="absolute inset-x-0 -bottom-5 text-center text-[10px] font-bold text-[#61648A]">{i + 1}</span>
          </button>
        ))}
      </div>

      {/* Pastelli = note (toccarli fa sentire la nota) */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label={t('colorsLabel')}>
        {NOTE_COLORS.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setColor(i)
              if (sound) playNote(i, instrument)
            }}
            aria-label={t(`colors.${c.key}`)}
            aria-pressed={color === i}
            className={`h-11 w-11 rounded-full border-[3px] border-[#2B2D52] transition-transform sm:h-12 sm:w-12 ${color === i ? 'scale-110 ring-4 ring-[#2B2D52] ring-offset-2' : ''}`}
            style={{ background: c.hex }}
          />
        ))}
        <button type="button" onClick={() => setColor(null)} aria-label={t('eraser')} aria-pressed={color === null} className={`flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#2B2D52] bg-white text-[#2B2D52] sm:h-12 sm:w-12 ${color === null ? 'scale-110 ring-4 ring-[#2B2D52] ring-offset-2' : ''}`}>
          <Eraser className="h-5 w-5" />
        </button>
      </div>

      {/* Strumento e velocità */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {INSTRUMENTS.map((ins) => {
          const Icon = INSTRUMENT_ICON[ins]
          return (
            <KidsIconButton
              key={ins}
              label={t(`instruments.${ins}`)}
              active={instrument === ins}
              onClick={() => {
                setInstrument(ins)
                if (sound) playNote(4, ins)
              }}
            >
              <Icon className="h-6 w-6" />
            </KidsIconButton>
          )
        })}
        <KidsButton onClick={() => setTempo((v) => (v + 1) % TEMPOS.length)} label={t('musicSpeed')}>
          <Gauge className="h-5 w-5" /> {t(`tempo.${tempo}`)}
        </KidsButton>
      </div>

      {/* Azioni */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <KidsButton onClick={play} accent>
          {playing ? <Square className="h-5 w-5" /> : <Play className="h-5 w-5" />} {playing ? t('musicStop') : t('musicPlay')}
        </KidsButton>
        <KidsButton onClick={randomSong} label={t('musicRandom')}>
          <Dices className="h-5 w-5" /> {t('musicRandom')}
        </KidsButton>
        <KidsButton onClick={() => (stop(), setNotes(emptySong()))} label={t('musicClear')}>
          <Trash2 className="h-5 w-5" />
        </KidsButton>
        <KidsButton onClick={saveSong} label={t('musicSave')}>
          <Save className="h-5 w-5" />
        </KidsButton>
        <KidsButton onClick={() => setList(true)} label={t('musicMySongs')}>
          <ListMusic className="h-5 w-5" /> {songs.length}
        </KidsButton>
      </div>

      {/* Le mie canzoni */}
      {list && (
        <div className="fixed inset-0 z-10 flex flex-col bg-[#F3F7FB] p-4" role="dialog" aria-modal="true" aria-label={t('musicMySongs')}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#2B2D52]">{t('musicMySongs')}</h2>
            <button type="button" onClick={() => setList(false)} className="rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 py-2 font-extrabold text-[#2B2D52]">
              {t('close')}
            </button>
          </div>
          {songs.length === 0 ? (
            <p className="m-auto max-w-xs text-center text-lg font-bold text-[#61648A]">{t('musicNoSongs')}</p>
          ) : (
            <div className="grid gap-3 overflow-y-auto pb-6">
              {songs.map((song) => (
                <div key={song.id} className="flex items-center gap-2 rounded-2xl border-[3px] border-[#2B2D52] bg-white p-2">
                  <button type="button" onClick={() => loadSong(song)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="flex shrink-0 gap-0.5">
                      {song.notes.map((n, i) => (
                        <span key={i} className="h-4 w-2.5 rounded-sm border border-[#2B2D52]/40" style={{ background: n === null ? '#fff' : NOTE_COLORS[n]?.hex }} />
                      ))}
                    </span>
                    <span className="truncate font-extrabold text-[#2B2D52]">{song.name}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={t('musicDelete')}
                    onClick={() => actions.askParent('manage', () => onProfileChange({ ...profile, songs: songs.filter((s) => s.id !== song.id) }))}
                    className="rounded-xl p-2 text-red-700"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
