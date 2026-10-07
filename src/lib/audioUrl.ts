// Gli audio (suoni della natura, Neurobalance) stanno nel bucket pubblico
// «audio» di Supabase Storage, non in public/: così ogni deploy su Vercel
// non se li porta dietro (circa 95 MB a versione).
export function audioUrl(file: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${file}`
}
