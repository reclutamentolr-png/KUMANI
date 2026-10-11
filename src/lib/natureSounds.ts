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

// Equalizzatore a 10 bande sul suono (come un mixer): ogni cursore va da 0 a
// 100, 50 = neutro, ±12 dB agli estremi. Bassi = tuoni, onde e corpo;
// medi = scroscio e gocce; alti = fruscio e aria.
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
export const EQ_NEUTRAL = EQ_BANDS.map(() => 50)
const EQ_MAX_DB = 12
export const eqToDb = (value: number) => ((Math.max(0, Math.min(100, value)) - 50) / 50) * EQ_MAX_DB

// Atmosfere pronte: valori delle 10 bande (dai bassi agli acuti), uguali per
// tutti i suoni; «surprise» li sceglie a caso
export const NATURE_MOODS: { id: string; values: number[] | null }[] = [
  { id: 'natural', values: [...EQ_NEUTRAL] },
  { id: 'soft', values: [44, 46, 50, 52, 54, 50, 44, 38, 32, 28] },
  { id: 'full', values: [68, 70, 66, 60, 54, 50, 48, 46, 44, 42] },
  { id: 'distant', values: [70, 68, 62, 52, 40, 30, 22, 16, 12, 8] },
  { id: 'sleep', values: [74, 72, 64, 54, 42, 32, 24, 18, 12, 6] },
  { id: 'focus', values: [36, 40, 46, 54, 60, 60, 56, 50, 44, 38] },
  { id: 'surprise', values: null },
]

// I file si ascoltano in streaming (elemento <audio> collegato al mixer),
// non più scaricati e decodificati interi in memoria: «Foresta» decodificata
// occupava 100-200 MB e su iPhone poteva far chiudere la scheda. Il volume
// passa dal mixer (su iPhone il volume dell'elemento <audio> non si cambia).
type ActiveSource = { audio: HTMLAudioElement; node: MediaElementAudioSourceNode; gain: GainNode; preset: NaturePreset }

export class NatureSoundsEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  // Ingresso dell'equalizzatore: suono principale e secondo suono passano da qui
  private eqInput: GainNode | null = null
  private filters: BiquadFilterNode[] = []
  private eqValues: number[] = [...EQ_NEUTRAL]
  private current: ActiveSource | null = null
  // Secondo suono «sotto» quello principale, con il suo volume
  private layer: ActiveSource | null = null
  private layerVolume = 0.35
  // Crescono a ogni avvio o arresto: un avvio superato da un altro non parte
  private generation = 0
  private layerGeneration = 0

  private ensure(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = 0.6
      this.master.connect(ctx.destination)
      // Catena: ingresso → 10 filtri → volume generale
      this.eqInput = ctx.createGain()
      let previous: AudioNode = this.eqInput
      this.filters = EQ_BANDS.map((frequency, index) => {
        const filter = ctx.createBiquadFilter()
        filter.type = index === 0 ? 'lowshelf' : index === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking'
        filter.frequency.value = frequency
        filter.Q.value = 1.1
        filter.gain.value = eqToDb(this.eqValues[index])
        previous.connect(filter)
        previous = filter
        return filter
      })
      previous.connect(this.master)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
    return this.ctx
  }

  // Valori 0-100 per le 10 bande; smooth: secondi del passaggio (animazione)
  setEq(values: number[], smooth = 0.08) {
    this.eqValues = EQ_BANDS.map((_, index) => values[index] ?? 50)
    if (!this.ctx) return
    const now = this.ctx.currentTime
    this.filters.forEach((filter, index) => filter.gain.setTargetAtTime(eqToDb(this.eqValues[index]), now, smooth))
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

  // Nuova sorgente collegata all'equalizzatore, a volume zero (poi sale)
  private async open(ctx: AudioContext, preset: NaturePreset): Promise<ActiveSource> {
    const audio = new Audio()
    audio.crossOrigin = 'anonymous'
    audio.loop = true
    audio.preload = 'auto'
    audio.src = NATURE_SOUND_FILES[preset]
    const node = ctx.createMediaElementSource(audio)
    const gain = ctx.createGain()
    gain.gain.value = 0
    node.connect(gain).connect(this.eqInput!)
    const active: ActiveSource = { audio, node, gain, preset }
    try {
      await audio.play()
    } catch (error) {
      this.release(active)
      throw error
    }
    return active
  }

  private fadeOut(active: ActiveSource, seconds: number) {
    if (!this.ctx) return this.release(active)
    const now = this.ctx.currentTime
    active.gain.gain.cancelScheduledValues(now)
    active.gain.gain.setValueAtTime(active.gain.gain.value, now)
    active.gain.gain.linearRampToValueAtTime(0, now + seconds)
    setTimeout(() => this.release(active), seconds * 1000 + 100)
  }

  // Fades the currently playing source out (if any) while fading the new
  // one in, instead of a hard cut — smoother when switching between
  // soundscapes mid-session.
  async start(preset: NaturePreset, volume = 0.6) {
    const ctx = this.ensure()
    await ctx.resume()
    this.master!.gain.value = volume
    const generation = ++this.generation
    const active = await this.open(ctx, preset)
    // Fermato o sostituito mentre partiva: non si sovrappone
    if (generation !== this.generation || !this.ctx) {
      this.release(active)
      return
    }
    const now = ctx.currentTime
    active.gain.gain.setValueAtTime(0, now)
    active.gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS)
    const previous = this.current
    this.current = active
    if (previous) this.fadeOut(previous, CROSSFADE_SECONDS)
  }

  // Secondo suono sotto quello principale: null lo toglie
  async setLayer(preset: NaturePreset | null) {
    const generation = ++this.layerGeneration
    const previous = this.layer
    this.layer = null
    if (previous) this.fadeOut(previous, CROSSFADE_SECONDS)
    if (!preset || !this.ctx) return
    const ctx = this.ctx
    const active = await this.open(ctx, preset)
    if (generation !== this.layerGeneration || !this.ctx || !this.current) {
      this.release(active)
      return
    }
    const now = ctx.currentTime
    active.gain.gain.setValueAtTime(0, now)
    active.gain.gain.linearRampToValueAtTime(this.layerVolume, now + CROSSFADE_SECONDS)
    this.layer = active
  }

  setLayerVolume(v: number) {
    this.layerVolume = v
    if (this.ctx && this.layer) this.layer.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
  }

  setVolume(v: number) {
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
    }
  }

  // Pausa e ripresa senza perdere suono, mixer e secondo suono
  async pause() {
    this.current?.audio.pause()
    this.layer?.audio.pause()
    await this.ctx?.suspend().catch(() => {})
  }

  async resume() {
    await this.ctx?.resume().catch(() => {})
    await Promise.all([this.current?.audio.play(), this.layer?.audio.play()]).catch(() => {})
  }

  fadeStop(seconds = 0.8) {
    this.generation++
    this.layerGeneration++
    if (!this.ctx || !this.current) return this.stop()
    const active = this.current
    const layer = this.layer
    this.current = null
    this.layer = null
    this.fadeOut(active, seconds)
    if (layer) this.fadeOut(layer, seconds)
    setTimeout(() => {
      // Niente da suonare: il mixer si ferma (batteria)
      if (!this.current) this.ctx?.suspend().catch(() => {})
    }, seconds * 1000 + 150)
  }

  stop() {
    this.generation++
    this.layerGeneration++
    if (this.current) this.release(this.current)
    if (this.layer) this.release(this.layer)
    this.current = null
    this.layer = null
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
      this.master = null
      this.eqInput = null
      this.filters = []
    }
  }
}
