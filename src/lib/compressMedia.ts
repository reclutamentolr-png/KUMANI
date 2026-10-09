// Compressione di video e audio nel browser prima del caricamento (KUMANI
// Sorpresa): MP4 H.264/AAC con lato lungo al massimo 1280 px e bitrate
// calcolato per restare sotto `maxBytes`. Usa l'encoder del dispositivo
// (WebCodecs, tramite mediabunny caricato solo quando serve): è molto più
// veloce della durata del video. Se il browser non sa comprimere restituisce
// null e si prova con il file originale (che deve già stare nel limite).

export class MediaTooLongError extends Error {}

const VIDEO_MAX_SIDE = 1280
const VIDEO_MAX_BPS = 2_500_000
const VIDEO_MIN_BPS = 250_000
const AUDIO_BPS = 96_000
// Margine per l'intestazione del file e le oscillazioni dell'encoder
const SAFETY = 0.85

export async function compressVideo(file: File, maxBytes: number, onProgress?: (p: number) => void): Promise<File | null> {
  const mb = await import('mediabunny')
  if (!(await mb.canEncodeVideo('avc').catch(() => false))) return null
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track) return null
    const duration = await input.computeDuration()
    if (!duration || !Number.isFinite(duration)) return null
    const hasAudio = !!(await input.getPrimaryAudioTrack())
    const audioBps = hasAudio ? AUDIO_BPS : 0
    const videoBps = Math.min(VIDEO_MAX_BPS, (maxBytes * 8 * SAFETY) / duration - audioBps)
    if (videoBps < VIDEO_MIN_BPS) throw new MediaTooLongError()

    const w = track.displayWidth
    const h = track.displayHeight
    const size = Math.max(w, h) > VIDEO_MAX_SIDE ? (w >= h ? { width: VIDEO_MAX_SIDE } : { height: VIDEO_MAX_SIDE }) : {}
    const target = new mb.BufferTarget()
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target })
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { ...size, codec: 'avc', quality: new mb.Quality({ bitrate: Math.round(videoBps) }), forceTranscode: true },
      audio: hasAudio ? { codec: 'aac', quality: new mb.Quality({ bitrate: audioBps }), numberOfChannels: 2 } : undefined,
    })
    if (!conversion.isValid) return null
    if (onProgress) conversion.onProgress = (p) => onProgress(p)
    await conversion.execute()
    if (!target.buffer) return null
    const out = new File([target.buffer], 'video.mp4', { type: 'video/mp4' })
    // Se per caso pesa di più (video già leggero), resta l'originale
    return out.size < file.size ? out : file
  } finally {
    input.dispose?.()
  }
}

export async function compressAudio(file: File, maxBytes: number, onProgress?: (p: number) => void): Promise<File | null> {
  const mb = await import('mediabunny')
  if (!(await mb.canEncodeAudio('aac').catch(() => false))) return null
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(file) })
  try {
    const duration = await input.computeDuration()
    if (!duration || !Number.isFinite(duration)) return null
    const bps = Math.min(128_000, (maxBytes * 8 * SAFETY) / duration)
    if (bps < 32_000) throw new MediaTooLongError()
    const target = new mb.BufferTarget()
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target })
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: { discard: true },
      audio: { codec: 'aac', quality: new mb.Quality({ bitrate: Math.round(bps) }), numberOfChannels: 2 },
    })
    if (!conversion.isValid) return null
    if (onProgress) conversion.onProgress = (p) => onProgress(p)
    await conversion.execute()
    if (!target.buffer) return null
    const out = new File([target.buffer], 'audio.m4a', { type: 'audio/mp4' })
    return out.size < file.size ? out : file
  } finally {
    input.dispose?.()
  }
}
