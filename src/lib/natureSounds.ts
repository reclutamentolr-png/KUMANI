// Real-recording nature soundscapes (replaces the earlier procedural
// synthesis — kept authentic instead of "zero file, zero cost" now that
// licensed recordings are available in the Supabase «audio» bucket).
import { audioUrl } from './audioUrl'

export type NaturePreset =
  | 'rain' | 'ocean' | 'wind' | 'stream'
  | 'fire' | 'forest' | 'night' | 'storm'

export const NATURE_SOUND_FILES: Record<NaturePreset, string> = {
  rain: audioUrl('rain.mp3'),
  ocean: audioUrl('ocean.mp3'),
  wind: audioUrl('wind.mp3'),
  stream: audioUrl('river.mp3'),
  fire: audioUrl('fire.mp3'),
  forest: audioUrl('forest.mp3'),
  night: audioUrl('night.mp3'),
  storm: audioUrl('thunderstorm.mp3'),
}

const CROSSFADE_SECONDS = 1.2

// I file si ascoltano in streaming (elemento <audio> collegato al mixer),
// non più scaricati e decodificati interi in memoria: «Foresta» decodificata
// occupava 100-200 MB e su iPhone poteva far chiudere la scheda. Il volume
// passa dal mixer (su iPhone il volume dell'elemento <audio> non si cambia).
type ActiveSource = { audio: HTMLAudioElement; node: MediaElementAudioSourceNode; gain: GainNode }

export class NatureSoundsEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private current: ActiveSource | null = null
  // Cresce a ogni start/stop: un avvio superato da un altro non parte
  private generation = 0

  private ensure(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.6
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  private release(active: ActiveSource) {
    try {
      active.audio.pause()
      active.audio.removeAttribute('src')
      active.audio.load()
    } catch {}
    active.node.disconnect()
    active.gain.disconnect()
  }

  // Fades the currently playing source out (if any) while fading the new
  // one in, instead of a hard cut — smoother when switching between
  // soundscapes mid-session.
  async start(preset: NaturePreset, volume = 0.6) {
    const ctx = this.ensure()
    await ctx.resume()
    this.master!.gain.value = volume
    const generation = ++this.generation

    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.loop = true
    audio.preload = 'auto'
    audio.src = NATURE_SOUND_FILES[preset]
    const node = ctx.createMediaElementSource(audio)
    const gain = ctx.createGain()
    gain.gain.value = 0
    node.connect(gain).connect(this.master!)
    const active: ActiveSource = { audio, node, gain }

    try {
      await audio.play()
    } catch (error) {
      this.release(active)
      throw error
    }
    // Fermato o sostituito mentre partiva: non si sovrappone
    if (generation !== this.generation || !this.ctx) {
      this.release(active)
      return
    }

    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS)

    const previous = this.current
    this.current = active

    if (previous) {
      previous.gain.gain.cancelScheduledValues(now)
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now)
      previous.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS)
      setTimeout(() => this.release(previous), CROSSFADE_SECONDS * 1000 + 100)
    }
  }

  setVolume(v: number) {
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
    }
  }

  fadeStop(seconds = 0.8) {
    this.generation++
    if (!this.ctx || !this.current) return this.stop()
    const active = this.current
    const now = this.ctx.currentTime
    active.gain.gain.cancelScheduledValues(now)
    active.gain.gain.setValueAtTime(active.gain.gain.value, now)
    active.gain.gain.linearRampToValueAtTime(0, now + seconds)
    this.current = null
    setTimeout(() => {
      this.release(active)
      // Niente da suonare: il mixer si ferma (batteria)
      if (!this.current) this.ctx?.suspend().catch(() => {})
    }, seconds * 1000 + 100)
  }

  stop() {
    this.generation++
    if (this.current) {
      this.release(this.current)
      this.current = null
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
      this.master = null
    }
  }
}
