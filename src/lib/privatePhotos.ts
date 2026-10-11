import { createClient as createServiceClient } from '@supabase/supabase-js'

// Foto con dati personali (CV, oggetti delle ricevute): stanno in spazi
// privati e si mostrano solo con un link firmato che scade, generato dal
// server dopo i controlli della pagina. Un vecchio link copiato o finito in
// un motore di ricerca smette di funzionare.
export type PrivatePhotoBucket = 'cv-photos' | 'receipt-photos-v2'

export async function signedPhotoUrl(bucket: PrivatePhotoBucket, path: string | null | undefined, seconds = 3600): Promise<string | null> {
  if (!path) return null
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, seconds)
  if (error) {
    console.error(`[privatePhotos] ${bucket}:`, error.message)
    return null
  }
  return data.signedUrl
}
