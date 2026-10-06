import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { DOC_BUCKET, DOC_LOCALES } from '@/lib/documents'

// Presentazione KUMANI in PDF, aperta a tutti: è il link che si allega ai
// messaggi WhatsApp (per esempio quando si regala un voucher), così chi non è
// ancora iscritto vede bene di cosa si tratta. Prende la presentazione
// pubblicata in Admin → Documenti nella lingua richiesta (altrimenti in
// italiano) e rimanda a un link firmato per vederla nel browser.
export async function GET(request: NextRequest) {
  const asked = request.nextUrl.searchParams.get('lang') ?? 'it'
  const lang = (DOC_LOCALES as readonly string[]).includes(asked) ? asked : 'it'
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: files } = await service
    .from('kumani_document_files')
    .select('storage_path, locale, kumani_documents!inner(category, is_published, sort_order)')
    .eq('format', 'pdf')
    .eq('kumani_documents.category', 'presentation')
    .eq('kumani_documents.is_published', true)
    .in('locale', lang === 'it' ? ['it'] : [lang, 'it'])
  const file = files?.find((f) => f.locale === lang) ?? files?.[0]
  if (!file) return NextResponse.redirect(new URL(`/${lang}`, request.url))

  const { data } = await service.storage.from(DOC_BUCKET).createSignedUrl(file.storage_path, 60 * 60)
  if (!data?.signedUrl) return NextResponse.redirect(new URL(`/${lang}`, request.url))
  return NextResponse.redirect(data.signedUrl)
}
