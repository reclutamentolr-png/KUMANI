// KUMANI VOX: trascrizione della voce nel telefono (Whisper con il tempo di
// ogni parola), in un Web Worker per non bloccare la pagina. La libreria e il
// modello si scaricano al primo uso e poi restano nella cache del browser:
// l'audio non lascia mai il dispositivo.
//
// Messaggi in entrata: { type: 'transcribe', audio: Float32Array (16 kHz mono), language: 'it', model: 'base' | 'small' }
// In uscita: { type: 'download', file, loaded, total } · { type: 'transcribing' } · { type: 'result', words: [{ text, start, end }] } · { type: 'error', message }

const LIBRARY = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1'
const MODELS = { base: 'onnx-community/whisper-base_timestamped', small: 'onnx-community/whisper-small_timestamped' }

let lib = null
const pipelines = {}

async function getPipeline(model) {
  if (!lib) lib = await import(/* webpackIgnore: true */ LIBRARY)
  if (!pipelines[model]) {
    lib.env.allowLocalModels = false
    pipelines[model] = lib.pipeline('automatic-speech-recognition', MODELS[model] || MODELS.base, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress') self.postMessage({ type: 'download', file: p.file, loaded: p.loaded, total: p.total })
      },
    })
  }
  try {
    return await pipelines[model]
  } catch (err) {
    delete pipelines[model]
    throw err
  }
}

self.onmessage = async (event) => {
  const { type, audio, language, model } = event.data || {}
  if (type !== 'transcribe') return
  try {
    const asr = await getPipeline(model)
    self.postMessage({ type: 'transcribing' })
    const out = await asr(audio, {
      language: language || 'italian',
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    })
    // Il testo resta com'è (con lo spazio davanti): chi lo riceve attacca alla
    // parola precedente i pezzi senza spazio, come «'acqua» dopo «d»
    const words = (out.chunks || [])
      .map((c) => ({ text: String(c.text || ''), start: Number(c.timestamp?.[0] ?? 0), end: Number(c.timestamp?.[1] ?? c.timestamp?.[0] ?? 0) }))
      .filter((w) => w.text.trim())
    self.postMessage({ type: 'result', words })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) })
  }
}
