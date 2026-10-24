// Angolo Bambini: suoni e voce del telefono (gratis, nessun servizio esterno).
// I browser fanno partire l'audio solo dopo un tocco: il primo tocco lo sblocca.

import { NOTES } from '@/lib/kids/catalog'

let ctx: AudioContext | null = null

function audio() {
  try {
    ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function tone(index: number, volume = 0.12, length = 0.35) {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = 'triangle'
  osc.frequency.value = NOTES[((index % NOTES.length) + NOTES.length) % NOTES.length]
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
  osc.connect(gain).connect(a.destination)
  osc.start(t)
  osc.stop(t + length + 0.05)
}

export function melody(notes = [0, 2, 4, 7], gap = 130) {
  notes.forEach((n, k) => setTimeout(() => tone(n, 0.1), k * gap))
}

const VOICE_LANG: Record<string, string> = { it: 'it-IT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', de: 'de-DE', ru: 'ru-RU' }

export function speak(text: string, locale: string) {
  try {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = VOICE_LANG[locale] ?? 'it-IT'
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2).toLowerCase()))
    if (voice) u.voice = voice
    u.rate = 0.95
    u.pitch = 1.15
    speechSynthesis.cancel()
    speechSynthesis.speak(u)
  } catch {
    // voce non disponibile: restano le scritte
  }
}
