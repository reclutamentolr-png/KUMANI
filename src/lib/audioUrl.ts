// Gli audio (suoni della natura, Neurobalance) non stanno in public/: così
// ogni deploy su Vercel non se li porta dietro (circa 95 MB a versione).
// Si servono da Cloudflare R2 (bucket kumani-audio, traffico gratuito) sul
// dominio impostato in NEXT_PUBLIC_AUDIO_BASE_URL.
const BASE = (process.env.NEXT_PUBLIC_AUDIO_BASE_URL || 'https://audio.kumani.io').replace(/\/+$/, '')

export function audioUrl(file: string): string {
  return `${BASE}/${file}`
}
