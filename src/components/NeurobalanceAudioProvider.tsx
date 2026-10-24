'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { awardNeurobalancePoint } from '@/app/actions/neurobalance'
import { EQ_NEUTRAL, NATURE_MOODS, NatureSoundsEngine, type NaturePreset } from '@/lib/natureSounds'
import { presets, specialSounds, tracks, MIN_LISTEN_SECONDS_FOR_POINT, type Preset, type SpecialSound, type Track } from '@/lib/neurobalancePresets'

interface NeurobalanceAudioValue {
  presets: Preset[]
  specialSounds: SpecialSound[]
  tracks: Track[]
  selectedTrack: Track | null
  selectedId: string
  isPlaying: boolean
  remaining: number
  volume: number
  selectedSpecialSound: SpecialSound | null
  activeNature: NaturePreset | null
  natureLoading: NaturePreset | null
  natureVolume: number
  // Mixer della natura (riquadro nero): equalizzatore, atmosfere, animazione,
  // spegnimento automatico, pausa e secondo suono
  natureEq: number[]
  natureMood: string | null
  natureAnimate: boolean
  naturePaused: boolean
  natureTimerMinutes: number | null
  natureTimerEndsAt: number | null
  natureLayer: NaturePreset | null
  natureLayerVolume: number
  setNatureBand: (index: number, value: number) => void
  applyNatureMood: (id: string) => void
  toggleNatureAnimate: () => void
  toggleNaturePause: () => Promise<void>
  setNatureTimer: (minutes: number | null) => void
  toggleNatureLayer: (id: NaturePreset) => Promise<void>
  setNatureLayerVolume: (volume: number) => void
  // Qualcosa scelto da quando si è aperta la pagina (all'inizio nulla è preimpostato)
  hasSelection: boolean
  // Scelta una sessione, una frequenza o un audio registrato (non solo la natura)
  sessionChosen: boolean
  handlePresetCardClick: (preset: Preset) => Promise<void>
  // Prepara una sessione senza farla partire (es. «Routine della sera»)
  choosePreset: (id: string) => void
  handleSpecialSoundCardClick: (sound: SpecialSound) => Promise<void>
  handleTrackCardClick: (track: Track) => Promise<void>
  togglePlayback: () => Promise<void>
  resetSession: () => void
  setVolume: (volume: number) => void
  toggleNature: (id: NaturePreset) => Promise<void>
  setNatureVolume: (volume: number) => void
  stopEverything: () => void
}

const NeurobalanceAudioContext = createContext<NeurobalanceAudioValue | null>(null)

export function useNeurobalanceAudio() {
  const ctx = useContext(NeurobalanceAudioContext)
  if (!ctx) throw new Error('useNeurobalanceAudio must be used within NeurobalanceAudioProvider')
  return ctx
}

// Monta una sola volta nel layout root (sopravvive quindi a ogni
// navigazione client-side, Neurobalance -> Mandala compreso): prima questo
// stato/motore audio viveva dentro NeurobalancePlayer e NatureMixer, quindi
// smontava (e zittiva l'audio) ogni volta che si lasciava /app/
// neurobalance. Spostandolo qui la sessione resta attiva ovunque nell'app,
// controllabile dal mini player fluttuante (FloatingAudioPlayer).
export function NeurobalanceAudioProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('neurobalance')
  // Nome del suono per il lettore di sistema (schermata di blocco)
  const natureTitle = (id: NaturePreset) => t(`naturePresets.${id}.label`)
  const [selectedId, setSelectedId] = useState(presets[0].id)
  const [isPlaying, setIsPlaying] = useState(false)
  const [remaining, setRemaining] = useState(presets[0].duration * 60)
  const [volume, setVolumeState] = useState(0.18)
  const [selectedSpecialSound, setSelectedSpecialSound] = useState<SpecialSound | null>(null)
  // Audio registrato in riproduzione (campane tibetane, meditazione)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  const trackRef = useRef<HTMLAudioElement | null>(null)

  const [activeNature, setActiveNature] = useState<NaturePreset | null>(null)
  const [natureLoading, setNatureLoading] = useState<NaturePreset | null>(null)
  const [natureVolume, setNatureVolumeState] = useState(0.6)
  const [natureEq, setNatureEq] = useState<number[]>([...EQ_NEUTRAL])
  const [natureMood, setNatureMood] = useState<string | null>('natural')
  const [natureAnimate, setNatureAnimate] = useState(false)
  const [naturePaused, setNaturePaused] = useState(false)
  const [natureTimerMinutes, setNatureTimerMinutes] = useState<number | null>(null)
  const [natureTimerEndsAt, setNatureTimerEndsAt] = useState<number | null>(null)
  const [natureLayer, setNatureLayerState] = useState<NaturePreset | null>(null)
  const [natureLayerVolume, setNatureLayerVolumeState] = useState(0.35)
  const [hasSelection, setHasSelection] = useState(false)
  const [sessionChosen, setSessionChosen] = useState(false)
  // Valori di partenza dell'animazione (l'atmosfera scelta o i cursori mossi a mano)
  const eqBaseRef = useRef<number[]>([...EQ_NEUTRAL])
  const eqRef = useRef<number[]>([...EQ_NEUTRAL])

  const audioContextRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const oscillatorsRef = useRef<OscillatorNode[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Il KU Point deve riflettere un vero ascolto, non un click — vedi
  // MIN_LISTEN_SECONDS_FOR_POINT in lib/neurobalancePresets.ts.
  const listenedSecondsRef = useRef(0)
  const pointAwardedRef = useRef(false)
  const natureEngineRef = useRef<NatureSoundsEngine | null>(null)
  // Un solo audio alla volta: ogni avvio prende un numero nuovo; un avvio
  // ancora in caricamento quando ne parte un altro (clic veloci) si annulla
  // invece di suonare insieme al nuovo.
  const sessionRef = useRef(0)

  useEffect(() => {
    natureEngineRef.current = new NatureSoundsEngine()
    return () => natureEngineRef.current?.stop()
  }, [])

  useEffect(() => {
    if (!isPlaying || selectedTrack) return
    timerRef.current = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          oscillatorsRef.current.forEach((oscillator) => oscillator.stop())
          oscillatorsRef.current = []
          setIsPlaying(false)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPlaying, selectedTrack])

  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume
    // Il cursore va da 0 a 0,4 (toni generati): per i file si porta su 0–1
    if (trackRef.current) trackRef.current.volume = Math.min(1, volume / 0.4)
  }, [volume])

  useEffect(() => {
    if (!isPlaying || pointAwardedRef.current) return
    const interval = setInterval(() => {
      listenedSecondsRef.current += 1
      if (listenedSecondsRef.current >= MIN_LISTEN_SECONDS_FOR_POINT && !pointAwardedRef.current) {
        pointAwardedRef.current = true
        awardNeurobalancePoint()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isPlaying])

  const stopAudio = () => {
    sessionRef.current++
    oscillatorsRef.current.forEach((oscillator) => oscillator.stop())
    oscillatorsRef.current = []
    setIsPlaying(false)
    // Motore audio a riposo finché non si riparte (batteria)
    audioContextRef.current?.suspend().catch(() => {})
  }

  // Ferma e scarica l'audio registrato (passando a un tono o a un'altra traccia)
  const stopTrack = () => {
    const audio = trackRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    trackRef.current = null
    setSelectedTrack(null)
  }

  const playTrack = async (track: Track) => {
    const session = ++sessionRef.current
    const audio = new Audio()
    const opus = audio.canPlayType('audio/webm; codecs="opus"') !== ''
    audio.src = `${track.src}.${opus ? 'webm' : 'm4a'}`
    audio.preload = 'auto'
    audio.volume = Math.min(1, volume / 0.4)
    audio.addEventListener('timeupdate', () => {
      setRemaining(Math.max(0, Math.ceil((Number.isFinite(audio.duration) ? audio.duration : track.duration) - audio.currentTime)))
    })
    audio.addEventListener('ended', () => {
      setIsPlaying(false)
      setRemaining(track.duration)
    })
    trackRef.current = audio
    setSelectedTrack(track)
    setRemaining(track.duration)
    try {
      await audio.play()
      if (session !== sessionRef.current) {
        audio.pause()
        return
      }
      setIsPlaying(true)
    } catch (err) {
      if (session !== sessionRef.current) return
      console.error('[NeurobalanceAudio] failed to play track:', track.id, err)
      setIsPlaying(false)
    }
  }

  const playWith = async (carrier: number, beat: number, durationSeconds: number) => {
    const session = ++sessionRef.current
    const audioContext = audioContextRef.current ?? new AudioContext()
    audioContextRef.current = audioContext
    await audioContext.resume()
    if (session !== sessionRef.current) return
    const gain = audioContext.createGain()
    gain.gain.value = volume
    gain.connect(audioContext.destination)
    gainRef.current = gain
    const left = audioContext.createOscillator()
    const right = audioContext.createOscillator()
    const leftPanner = audioContext.createStereoPanner()
    const rightPanner = audioContext.createStereoPanner()
    left.frequency.value = carrier
    right.frequency.value = carrier + beat
    leftPanner.pan.value = -1
    rightPanner.pan.value = 1
    left.connect(leftPanner).connect(gain)
    right.connect(rightPanner).connect(gain)
    left.start()
    right.start()
    oscillatorsRef.current = [left, right]
    setRemaining(durationSeconds)
    setIsPlaying(true)
  }

  const togglePlayback = async () => {
    // Audio registrato: pausa e ripresa dallo stesso punto
    if (selectedTrack && trackRef.current) {
      if (isPlaying) {
        trackRef.current.pause()
        setIsPlaying(false)
      } else {
        await trackRef.current.play().catch(() => {})
        setIsPlaying(true)
      }
      return
    }
    if (isPlaying) {
      stopAudio()
      return
    }
    const selected = presets.find((preset) => preset.id === selectedId) ?? presets[0]
    const carrier = selectedSpecialSound?.frequency ?? selected.carrier
    const beat = selectedSpecialSound ? 4 : selected.beat
    const full = selectedSpecialSound ? 15 * 60 : selected.duration * 60
    // Ripresa dopo «Pausa»: si continua dal tempo che restava, non da capo
    await playWith(carrier, beat, remaining > 0 && remaining < full ? remaining : full)
  }

  const handlePresetCardClick = async (preset: Preset) => {
    const isThisPlaying = isPlaying && !selectedTrack && !selectedSpecialSound && selectedId === preset.id
    setHasSelection(true)
    setSessionChosen(true)
    stopAudio()
    stopTrack()
    if (isThisPlaying) return
    setSelectedSpecialSound(null)
    setSelectedId(preset.id)
    await playWith(preset.carrier, preset.beat, preset.duration * 60)
  }

  // Sceglie una sessione senza avviarla (il suono parte solo con «Play»,
  // come chiedono i browser); se qualcosa sta già suonando non si tocca
  const choosePreset = (id: string) => {
    const preset = presets.find((p) => p.id === id)
    if (!preset || isPlaying) return
    stopTrack()
    setHasSelection(true)
    setSessionChosen(true)
    setSelectedSpecialSound(null)
    setSelectedId(preset.id)
    setRemaining(preset.duration * 60)
  }

  const handleSpecialSoundCardClick = async (sound: SpecialSound) => {
    const isThisPlaying = isPlaying && selectedSpecialSound?.id === sound.id
    setHasSelection(true)
    setSessionChosen(true)
    stopAudio()
    stopTrack()
    if (isThisPlaying) return
    setSelectedSpecialSound(sound)
    await playWith(sound.frequency, 4, 15 * 60)
  }

  const handleTrackCardClick = async (track: Track) => {
    setHasSelection(true)
    setSessionChosen(true)
    // La stessa traccia: pausa o ripresa; un'altra: si riparte da capo
    if (selectedTrack?.id === track.id && trackRef.current) {
      await togglePlayback()
      return
    }
    stopAudio()
    stopTrack()
    setSelectedSpecialSound(null)
    await playTrack(track)
  }

  const resetSession = () => {
    if (selectedTrack && trackRef.current) {
      trackRef.current.pause()
      trackRef.current.currentTime = 0
      setIsPlaying(false)
      setRemaining(selectedTrack.duration)
      return
    }
    const selected = presets.find((preset) => preset.id === selectedId) ?? presets[0]
    stopAudio()
    setRemaining(selectedSpecialSound ? 15 * 60 : selected.duration * 60)
  }

  // Fine del suono della natura: si azzerano pausa, secondo suono e timer
  const endNature = () => {
    natureEngineRef.current?.fadeStop()
    setActiveNature(null)
    setNaturePaused(false)
    setNatureLayerState(null)
    setNatureTimerEndsAt(null)
  }

  const toggleNature = async (id: NaturePreset) => {
    const eng = natureEngineRef.current
    if (!eng || natureLoading) return
    setHasSelection(true)
    if (activeNature === id) {
      endNature()
      return
    }
    setNatureLoading(id)
    try {
      eng.setEq(eqRef.current, 0.01)
      await eng.start(id, natureVolume)
      setActiveNature(id)
      setNaturePaused(false)
      // Il secondo suono non può essere uguale al principale
      if (natureLayer === id) {
        setNatureLayerState(null)
        void eng.setLayer(null)
      }
      if (natureTimerMinutes && !natureTimerEndsAt) setNatureTimerEndsAt(Date.now() + natureTimerMinutes * 60_000)
    } catch (err) {
      console.error('[NeurobalanceAudio] failed to start nature sound:', id, err)
    } finally {
      setNatureLoading(null)
    }
  }

  const applyEq = (values: number[], smooth?: number) => {
    eqRef.current = values
    setNatureEq(values)
    natureEngineRef.current?.setEq(values, smooth)
  }

  const setNatureBand = (index: number, value: number) => {
    const next = eqRef.current.slice()
    next[index] = Math.max(0, Math.min(100, Math.round(value)))
    eqBaseRef.current = next
    setNatureMood(null)
    applyEq(next)
  }

  const applyNatureMood = (id: string) => {
    const mood = NATURE_MOODS.find((m) => m.id === id)
    if (!mood) return
    const values = mood.values ? [...mood.values] : EQ_NEUTRAL.map(() => Math.round(20 + Math.random() * 60))
    eqBaseRef.current = values
    setNatureMood(id)
    applyEq(values, 0.25)
  }

  const toggleNatureAnimate = () => setNatureAnimate((on) => !on)

  // Animazione: i cursori si muovono piano attorno ai valori scelti
  useEffect(() => {
    if (!natureAnimate || !activeNature || naturePaused) return
    const interval = setInterval(() => {
      const next = eqRef.current.map((value, index) => {
        const base = eqBaseRef.current[index]
        const drift = value + (Math.random() * 12 - 6) + (base - value) * 0.25
        return Math.max(0, Math.min(100, Math.round(drift)))
      })
      applyEq(next, 1.2)
    }, 1800)
    return () => clearInterval(interval)
  }, [natureAnimate, activeNature, naturePaused])

  // Lettore di sistema (schermata di blocco, centro di controllo, cuffie):
  // play e pausa comandano il nostro motore; a suono fermato il lettore sparisce
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    if (!activeNature) {
      ms.metadata = null
      ms.playbackState = 'none'
      for (const action of ['play', 'pause', 'stop'] as MediaSessionAction[]) {
        try {
          ms.setActionHandler(action, null)
        } catch {}
      }
      return
    }
    ms.metadata = new MediaMetadata({ title: natureTitle(activeNature), artist: 'KUMANI NeuroBalance' })
    ms.playbackState = naturePaused ? 'paused' : 'playing'
    const eng = natureEngineRef.current
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => void eng?.resume().then(() => setNaturePaused(false))],
      ['pause', () => void eng?.pause().then(() => setNaturePaused(true))],
      ['stop', () => endNature()],
    ]
    for (const [action, handler] of handlers) {
      try {
        ms.setActionHandler(action, handler)
      } catch {}
    }
    // endNature e natureTitle leggono solo setter e ref stabili
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNature, naturePaused])

  // Tornando sulla pagina (schermo riacceso, cambio app) il motore riparte
  // se il suono doveva essere in riproduzione
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && activeNature && !naturePaused) void natureEngineRef.current?.resume()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [activeNature, naturePaused])

  const toggleNaturePause = async () => {
    const eng = natureEngineRef.current
    if (!eng || !activeNature) return
    if (naturePaused) {
      await eng.resume()
      setNaturePaused(false)
    } else {
      await eng.pause()
      setNaturePaused(true)
    }
  }

  // Spegnimento automatico: null = mai
  const setNatureTimer = (minutes: number | null) => {
    setNatureTimerMinutes(minutes)
    setNatureTimerEndsAt(minutes && activeNature ? Date.now() + minutes * 60_000 : null)
  }

  useEffect(() => {
    if (!natureTimerEndsAt) return
    const wait = Math.max(0, natureTimerEndsAt - Date.now())
    const timeout = setTimeout(() => {
      natureEngineRef.current?.fadeStop(4)
      setActiveNature(null)
      setNaturePaused(false)
      setNatureLayerState(null)
      setNatureTimerEndsAt(null)
    }, wait)
    return () => clearTimeout(timeout)
  }, [natureTimerEndsAt])

  const toggleNatureLayer = async (id: NaturePreset) => {
    const eng = natureEngineRef.current
    if (!eng || !activeNature || id === activeNature) return
    const next = natureLayer === id ? null : id
    setNatureLayerState(next)
    try {
      await eng.setLayer(next)
    } catch (err) {
      console.error('[NeurobalanceAudio] failed to start second sound:', id, err)
      setNatureLayerState(null)
    }
  }

  const setNatureLayerVolume = (v: number) => {
    setNatureLayerVolumeState(v)
    natureEngineRef.current?.setLayerVolume(v)
  }

  const setNatureVolume = (v: number) => {
    setNatureVolumeState(v)
    natureEngineRef.current?.setVolume(v)
  }

  const stopEverything = () => {
    stopAudio()
    stopTrack()
    endNature()
  }

  return (
    <NeurobalanceAudioContext.Provider
      value={{
        presets,
        specialSounds,
        tracks,
        selectedTrack,
        selectedId,
        isPlaying,
        remaining,
        volume,
        selectedSpecialSound,
        activeNature,
        natureLoading,
        natureVolume,
        natureEq,
        natureMood,
        natureAnimate,
        naturePaused,
        natureTimerMinutes,
        natureTimerEndsAt,
        natureLayer,
        natureLayerVolume,
        setNatureBand,
        applyNatureMood,
        toggleNatureAnimate,
        toggleNaturePause,
        setNatureTimer,
        toggleNatureLayer,
        setNatureLayerVolume,
        hasSelection,
        sessionChosen,
        handlePresetCardClick,
        choosePreset,
        handleSpecialSoundCardClick,
        handleTrackCardClick,
        togglePlayback,
        resetSession,
        setVolume: setVolumeState,
        toggleNature,
        setNatureVolume,
        stopEverything,
      }}
    >
      {children}
    </NeurobalanceAudioContext.Provider>
  )
}
