import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildVcardContent, type MultiDestination, type VcardDestination } from '@/lib/qrPro'

// «Salva il contatto» nella pagina «Più contatti» di un QR Code PRO: la scheda
// (vCard) del contatto in posizione i. Lettura pubblica dei soli codici attivi,
// senza contare una nuova scansione (l'ha già contata /q/<codice>).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string; i: string }> }) {
  const { code, i } = await params
  const supabase = await createClient()
  const { data } = (await supabase.rpc('get_qr_pro_destination', { p_code: code }).single()) as {
    data: { content_type: string; destination: MultiDestination } | null
  }
  const item = data?.content_type === 'multi' ? data.destination.items?.[Number(i)] : null
  if (!item || item.type !== 'vcard') return new NextResponse('Not found', { status: 404 })
  const vcard = item.data as unknown as VcardDestination
  const name = [vcard.firstName, vcard.lastName].filter(Boolean).join('-').replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '') || 'contact'
  return new NextResponse(buildVcardContent(vcard), {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}.vcf"`,
    },
  })
}
