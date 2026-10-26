// Angolo Bambini: suoni e voce del telefono (gratis, nessun servizio esterno).
// I browser fanno partire l'audio solo dopo un tocco: il primo tocco lo sblocca.

import { NOTES } from '@/lib/kids/catalog'

let ctx: AudioContext | null = null

function audio() {
  try {
    // iPhone: senza «playback» i suoni restano muti con il telefono in
    // silenzioso (Safari 17 e successivi; prima la proprietà non c'è)
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (session && session.type !== 'playback') session.type = 'playback'
    ctx = ctx ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// iPhone: suoni e voce partono solo se il primo è avviato da un tocco. Al
// primo tocco nell'Angolo Bambini si «sbloccano» con un suono muto e una frase
// vuota, così anche le frasi di KUMI dette dopo (con un ritardo) si sentono.
let unlocked = false
export function unlockAudio() {
  const a = audio()
  if (a) {
    const buffer = a.createBuffer(1, 1, 22050)
    const source = a.createBufferSource()
    source.buffer = buffer
    source.connect(a.destination)
    source.start(0)
  }
  if (!unlocked && 'speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      speechSynthesis.speak(u)
    } catch {
      // voce non disponibile
    }
  }
  unlocked = !!a && a.state === 'running'
  return unlocked
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

// La voce più naturale tra quelle del telefono: prima le voci «neurali»
// (Edge «Natural», Google, iPhone «Avanzata/Premium»), poi le altre della
// lingua giusta. Le voci arrivano dopo l'apertura della pagina: si ricalcola
// quando il browser le annuncia.
const BETTER = [
  [/natural|neural/i, 60],
  [/premium/i, 55],
  [/enhanced|avanzat|migliorat|améliorée|mejorada|melhorada|erweitert|улучшен/i, 50],
  [/online/i, 30],
  [/google/i, 25],
] as const
let cached: { lang: string; voice: SpeechSynthesisVoice | null } | null = null

function bestVoice(lang: string) {
  if (cached?.lang === lang && cached.voice) return cached.voice
  const all = speechSynthesis.getVoices()
  const base = lang.slice(0, 2).toLowerCase()
  const same = all.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(base))
  let best: SpeechSynthesisVoice | null = null
  let bestScore = -1
  for (const v of same) {
    let score = v.lang.toLowerCase().replace('_', '-') === lang.toLowerCase() ? 5 : 0
    for (const [re, points] of BETTER) if (re.test(v.name)) score += points
    // Voci di riserva molto robotiche (es. eSpeak) in fondo
    if (/espeak|compact/i.test(v.name)) score -= 40
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  cached = { lang, voice: best }
  return best
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.addEventListener?.('voiceschanged', () => (cached = null))
}

export function speak(text: string, locale: string) {
  try {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = VOICE_LANG[locale] ?? 'it-IT'
    const voice = bestVoice(u.lang)
    if (voice) u.voice = voice
    // Un po' più lenta e appena più acuta: più vicina a chi parla ai bambini,
    // senza l'effetto «cartone» che rende la voce ancora più finta
    u.rate = 0.92
    u.pitch = 1.08
    // Safari: «cancel» subito prima di «speak» a volte cancella anche la
    // frase nuova, quindi solo se c'è davvero qualcosa da interrompere
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel()
    // iPhone: la voce a volte resta «in pausa» dopo un'interruzione
    if (speechSynthesis.paused) speechSynthesis.resume()
    speechSynthesis.speak(u)
  } catch {
    // voce non disponibile: restano le scritte
  }
}

// «La musica dei colori»: una nota con il timbro di uno strumento
export const INSTRUMENTS = ['xilofono', 'flauto', 'campanelle'] as const
export type Instrument = (typeof INSTRUMENTS)[number]

export function playNote(index: number, instrument: Instrument) {
  const a = audio()
  if (!a) return
  const t = a.currentTime
  const freq = NOTES[((index % NOTES.length) + NOTES.length) % NOTES.length] * (instrument === 'campanelle' ? 2 : 1)
  const shape = { xilofono: ['triangle', 0.16, 0.01, 0.4], flauto: ['sine', 0.18, 0.06, 0.55], campanelle: ['sine', 0.12, 0.005, 0.9] } as const
  const [type, volume, attack, length] = shape[instrument]
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
  osc.connect(gain).connect(a.destination)
  osc.start(t)
  osc.stop(t + length + 0.05)
}
