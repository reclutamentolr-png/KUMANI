// VeriFoto: indizi raccolti su una foto e verdetto combinato.
// Nessun controllo da solo è una prova: il verdetto mette insieme segnali
// diversi e lo dice chiaramente ("probabilmente", mai "certamente").

export type Signal = 'ai' | 'real' | 'edited' | 'neutral'

export type Clue = {
  id: string
  signal: Signal
  // Peso nel verdetto: 3 = quasi una prova (Content Credentials AI),
  // 2 = indizio forte (rilevatore, parametri di generazione), 1 = indizio
  weight: 1 | 2 | 3
  // Chiave di testo (namespace verifoto) e valori da inserire
  textKey: string
  values?: Record<string, string>
  source: string
}

export type ProvenanceScan = {
  hasC2pa: boolean
  // Strumento dichiarato nei Content Credentials o nei metadati XMP
  generator: string | null
  // IPTC / C2PA: immagine creata (o composta) con AI
  aiSourceType: 'trained' | 'composite' | null
  // PNG con i parametri di generazione (Stable Diffusion, ComfyUI…)
  generationParams: boolean
  // Programma di modifica dichiarato
  software: string | null
}

export type CameraInfo = {
  make: string | null
  model: string | null
  takenAt: string | null
  exposure: boolean
}

export type DetectorResult =
  | { status: 'ok'; aiScore: number; generator: string | null }
  | { status: 'quota' | 'user_limit' | 'unavailable' | 'error' | 'not_allowed' }

export type Verdict = 'ai' | 'uncertain' | 'likely_real'

// Generatori AI riconoscibili nei metadati (nomi come compaiono nei file)
const AI_GENERATORS: [RegExp, string][] = [
  [/openai|chatgpt|dall[-·\s]?e|gpt-4o|gpt-image/i, 'OpenAI (ChatGPT / DALL·E)'],
  [/firefly/i, 'Adobe Firefly'],
  [/midjourney/i, 'Midjourney'],
  [/stable[\s_-]?diffusion|stability\.ai|sdxl|automatic1111|comfyui/i, 'Stable Diffusion'],
  [/imagen|gemini|nano[\s-]?banana/i, 'Google Imagen / Gemini'],
  [/bing image creator|microsoft designer|designer\.microsoft/i, 'Microsoft Designer'],
  [/meta ai|imagine with meta/i, 'Meta AI'],
  [/flux|black forest labs/i, 'FLUX'],
  [/ideogram/i, 'Ideogram'],
  [/leonardo\.ai|leonardo ai/i, 'Leonardo AI'],
  [/runway/i, 'Runway'],
]

export function aiGeneratorName(text: string | null | undefined): string | null {
  if (!text) return null
  for (const [pattern, name] of AI_GENERATORS) if (pattern.test(text)) return name
  return null
}

const EDITORS = /photoshop|lightroom|gimp|snapseed|picsart|facetune|canva|pixelmator|affinity photo|faceapp|remini/i

export function buildClues(scan: ProvenanceScan, camera: CameraInfo, detector: DetectorResult | null): Clue[] {
  const clues: Clue[] = []
  const declaredAi = aiGeneratorName(scan.generator)

  if (scan.aiSourceType === 'trained') {
    clues.push({ id: 'sourceType', signal: 'ai', weight: 3, textKey: 'clueSourceTypeAi', source: 'IPTC / C2PA' })
  } else if (scan.aiSourceType === 'composite') {
    clues.push({ id: 'sourceType', signal: 'ai', weight: 2, textKey: 'clueSourceTypeComposite', source: 'IPTC / C2PA' })
  }
  if (scan.hasC2pa) {
    if (declaredAi) {
      clues.push({ id: 'c2pa', signal: 'ai', weight: 3, textKey: 'clueC2paAi', values: { tool: declaredAi }, source: 'Content Credentials (C2PA)' })
    } else {
      clues.push({
        id: 'c2pa',
        signal: 'neutral',
        weight: 1,
        textKey: scan.generator ? 'clueC2paOther' : 'clueC2paPresent',
        values: { tool: scan.generator ?? '' },
        source: 'Content Credentials (C2PA)',
      })
    }
  } else if (declaredAi) {
    clues.push({ id: 'generator', signal: 'ai', weight: 2, textKey: 'clueGeneratorAi', values: { tool: declaredAi }, source: 'XMP' })
  }
  if (scan.generationParams) {
    clues.push({ id: 'params', signal: 'ai', weight: 2, textKey: 'clueGenerationParams', source: 'PNG' })
  }
  if (scan.software && !aiGeneratorName(scan.software) && EDITORS.test(scan.software)) {
    clues.push({ id: 'software', signal: 'edited', weight: 1, textKey: 'clueEditor', values: { software: scan.software }, source: 'EXIF' })
  }

  if (camera.make && camera.model && camera.takenAt && camera.exposure) {
    clues.push({
      id: 'camera',
      signal: 'real',
      weight: 1,
      textKey: 'clueCamera',
      values: { camera: `${camera.make} ${camera.model}`.trim() },
      source: 'EXIF',
    })
  } else {
    clues.push({ id: 'camera', signal: 'neutral', weight: 1, textKey: 'clueNoCamera', source: 'EXIF' })
  }

  if (detector?.status === 'ok') {
    const pct = String(Math.round(detector.aiScore * 100))
    if (detector.aiScore >= 0.85) {
      clues.push({ id: 'detector', signal: 'ai', weight: 2, textKey: 'clueDetectorAi', values: { pct, tool: detector.generator ?? '' }, source: 'Sightengine' })
    } else if (detector.aiScore <= 0.15) {
      clues.push({ id: 'detector', signal: 'real', weight: 2, textKey: 'clueDetectorReal', values: { pct }, source: 'Sightengine' })
    } else {
      clues.push({ id: 'detector', signal: 'neutral', weight: 1, textKey: 'clueDetectorUnsure', values: { pct }, source: 'Sightengine' })
    }
  }
  return clues
}

// Verdetto: un indizio "quasi prova" (peso 3) decide; altrimenti si sommano
// i pesi. Senza rilevatore e senza certificati resta "da verificare".
export function verdictOf(clues: Clue[]): { verdict: Verdict; score: number } {
  const sum = (signal: Signal) => clues.filter((c) => c.signal === signal).reduce((s, c) => s + c.weight, 0)
  const ai = sum('ai')
  const real = sum('real')
  if (clues.some((c) => c.signal === 'ai' && c.weight === 3)) return { verdict: 'ai', score: Math.min(95, 80 + ai * 3) }
  // Punteggio di "rischio AI" 0-100 (50 = nessuna indicazione), sempre
  // dentro la fascia del verdetto: basso 0-30, incerto 31-69, alto 70-100.
  const raw = Math.max(5, Math.min(95, 50 + ai * 15 - real * 12))
  if (ai >= 2 && ai > real) return { verdict: 'ai', score: Math.max(raw, RISK_HIGH) }
  if (real >= 2 && ai === 0) return { verdict: 'likely_real', score: Math.min(raw, RISK_LOW) }
  return { verdict: 'uncertain', score: Math.min(Math.max(raw, RISK_LOW + 1), RISK_HIGH - 1) }
}

// Fasce del rischio mostrate all'utente
export const RISK_LOW = 30
export const RISK_HIGH = 70
