import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { DOC_BUCKET } from '@/lib/documents'
import { verifyAdmin } from '@/lib/verifyAdmin'

// Download di un file "Doc KUMANI": solo per chi ha fatto l'accesso. Il file
// sta in un bucket privato: si rimanda a un link firmato valido un minuto.
export async function GET(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  // Con il client dell'utente: le regole del database lasciano passare solo i file
  // pubblicati. Lo Staff può scaricare anche quelli nascosti, per controllarli.
  let { data: file } = await supabase.from('kumani_document_files').select('storage_path, file_name').eq('id', fileId).maybeSingle()
  if (!file && (await verifyAdmin('settings.read'))) {
    ;({ data: file } = await service.from('kumani_document_files').select('storage_path, file_name').eq('id', fileId).maybeSingle())
  }
  if (!file) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const view = request.nextUrl.searchParams.get('view') === '1'
  const { data, error } = await service.storage.from(DOC_BUCKET).createSignedUrl(file.storage_path, 60, view ? undefined : { download: file.file_name })
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  return NextResponse.redirect(data.signedUrl)
}
