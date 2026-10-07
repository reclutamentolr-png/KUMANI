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

type ActiveSource = { source: AudioBufferSourceNode; gain: GainNode }

export class NatureSoundsEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private current: ActiveSource | null = null
  private buffers = new Map<NaturePreset, AudioBuffer>()
  private pendingLoads = new Map<NaturePreset, Promise<AudioBuffer>>()

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

  private async loadBuffer(ctx: AudioContext, preset: NaturePreset): Promise<AudioBuffer> {
    const cached = this.buffers.get(preset)
    if (cached) return cached

    const pending = this.pendingLoads.get(preset)
    if (pending) return pending

    const promise = (async () => {
      const res = await fetch(NATURE_SOUND_FILES[preset])
      if (!res.ok) throw new Error(`Failed to fetch nature sound: ${preset}`)
      const arrayBuffer = await res.arrayBuffer()
      const decoded = await ctx.decodeAudioData(arrayBuffer)
      this.buffers.set(preset, decoded)
      this.pendingLoads.delete(preset)
      return decoded
    })()
    this.pendingLoads.set(preset, promise)
    return promise
  }

  // Fades the currently playing source out (if any) while fading the new
  // one in, instead of a hard cut — smoother when switching between
  // soundscapes mid-session.
  async start(preset: NaturePreset, volume = 0.6) {
    const ctx = this.ensure()
    await ctx.resume()
    this.master!.gain.value = volume

    const buffer = await this.loadBuffer(ctx, preset)
    // The engine may have been stopped (or asked to play something else)
    // while this decode was in flight — bail out rather than starting a
    // now-stale source.
    if (!this.ctx) return

    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS)
    source.connect(gain).connect(this.master!)
    source.start()

    const previous = this.current
    this.current = { source, gain }

    if (previous) {
      previous.gain.gain.cancelScheduledValues(now)
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now)
      previous.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS)
      setTimeout(() => {
        try { previous.source.stop() } catch {}
        previous.source.disconnect()
        previous.gain.disconnect()
      }, CROSSFADE_SECONDS * 1000 + 100)
    }
  }

  setVolume(v: number) {
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
    }
  }

  fadeStop(seconds = 0.8) {
    if (!this.ctx || !this.current) return this.stop()
    const { source, gain } = this.current
    const now = this.ctx.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + seconds)
    this.current = null
    setTimeout(() => {
      try { source.stop() } catch {}
      source.disconnect()
      gain.disconnect()
    }, seconds * 1000 + 100)
  }

  stop() {
    if (this.current) {
      try { this.current.source.stop() } catch {}
      this.current.source.disconnect()
      this.current.gain.disconnect()
      this.current = null
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {})
      this.ctx = null
      this.master = null
    }
    this.buffers.clear()
    this.pendingLoads.clear()
  }
}
