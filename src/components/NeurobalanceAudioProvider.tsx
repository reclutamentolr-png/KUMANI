'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { awardNeurobalancePoint } from '@/app/actions/neurobalance'
import { NatureSoundsEngine, type NaturePreset } from '@/lib/natureSounds'
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
  handlePresetCardClick: (preset: Preset) => Promise<void>
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
// smontava (e zittiva l'audio) ogni volta che si lasciava /marketplace/
// neurobalance. Spostandolo qui la sessione resta attiva ovunque nell'app,
// controllabile dal mini player fluttuante (FloatingAudioPlayer).
export function NeurobalanceAudioProvider({ children }: { children: ReactNode }) {
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
    stopAudio()
    stopTrack()
    if (isThisPlaying) return
    setSelectedSpecialSound(null)
    setSelectedId(preset.id)
    await playWith(preset.carrier, preset.beat, preset.duration * 60)
  }

  const handleSpecialSoundCardClick = async (sound: SpecialSound) => {
    const isThisPlaying = isPlaying && selectedSpecialSound?.id === sound.id
    stopAudio()
    stopTrack()
    if (isThisPlaying) return
    setSelectedSpecialSound(sound)
    await playWith(sound.frequency, 4, 15 * 60)
  }

  const handleTrackCardClick = async (track: Track) => {
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

  const toggleNature = async (id: NaturePreset) => {
    const eng = natureEngineRef.current
    if (!eng || natureLoading) return
    if (activeNature === id) {
      eng.fadeStop()
      setActiveNature(null)
      return
    }
    setNatureLoading(id)
    try {
      await eng.start(id, natureVolume)
      setActiveNature(id)
    } catch (err) {
      console.error('[NeurobalanceAudio] failed to start nature sound:', id, err)
    } finally {
      setNatureLoading(null)
    }
  }

  const setNatureVolume = (v: number) => {
    setNatureVolumeState(v)
    natureEngineRef.current?.setVolume(v)
  }

  const stopEverything = () => {
    stopAudio()
    stopTrack()
    natureEngineRef.current?.fadeStop()
    setActiveNature(null)
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
        handlePresetCardClick,
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
