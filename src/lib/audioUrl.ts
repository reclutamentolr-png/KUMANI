// Gli audio (suoni della natura, Neurobalance) non stanno in public/: così
// ogni deploy su Vercel non se li porta dietro (circa 95 MB a versione).
// Si servono da Cloudflare R2 (traffico gratuito) quando è impostato
// NEXT_PUBLIC_AUDIO_BASE_URL, altrimenti dal bucket pubblico «audio» di
// Supabase Storage, che ha gli stessi file.
const BASE =
  process.env.NEXT_PUBLIC_AUDIO_BASE_URL?.replace(/\/+$/, '') ||
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio`

export function audioUrl(file: string): string {
  return `${BASE}/${file}`
}
