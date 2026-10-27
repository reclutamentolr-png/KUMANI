import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Manuale Antitruffa in PDF, per chi è iscritto: «Scarica» (mode=pdf) lo
// salva, «Stampa» (mode=print) lo apre nel browser per stamparlo. Ogni volta
// si conta in guide_downloads (Admin → Manuale Antitruffa). I file li crea
// scripts/manual-pdf.mjs in private/manuale.
export const dynamic = 'force-dynamic'

const LANGS = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = request.nextUrl.searchParams
  const asked = params.get('lang') ?? 'it'
  const lang = LANGS.includes(asked) ? asked : 'it'
  const mode = params.get('mode') === 'print' ? 'print' : 'pdf'

  let pdf: Buffer
  try {
    pdf = await readFile(path.join(process.cwd(), 'private', 'manuale', `manuale-antitruffa-${lang}.pdf`))
  } catch {
    // Lingua senza PDF: si usa l'italiano
    try {
      pdf = await readFile(path.join(process.cwd(), 'private', 'manuale', 'manuale-antitruffa-it.pdf'))
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  // Il conteggio non deve mai bloccare il download
  await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
    .from('guide_downloads')
    .insert({ user_id: user.id, locale: lang, mode })
    .then(
      () => null,
      () => null
    )

  const name = `KUMANI-Manuale-Antitruffa-${lang.toUpperCase()}.pdf`
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${mode === 'pdf' ? 'attachment' : 'inline'}; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
