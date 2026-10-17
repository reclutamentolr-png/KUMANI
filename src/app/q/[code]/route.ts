import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildVcardContent, qrItemHref, type QrContentType, type QrItemType, type VcardDestination } from '@/lib/qrPro'

interface QrDestinationRow {
  content_type: QrContentType
  destination: Record<string, string>
}

function buildTargetUrl(row: QrDestinationRow): string | null {
  return row.content_type === 'multi' ? null : qrItemHref(row.content_type as QrItemType, row.destination)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const supabase = await createClient()
  const { data } = (await supabase
    .rpc('register_qr_pro_click', {
      p_code: code,
      p_referrer: request.headers.get('referer'),
      p_user_agent: request.headers.get('user-agent'),
    })
    .single()) as { data: QrDestinationRow | null }

  if (!data) {
    return NextResponse.redirect(new URL('/qr-non-attivo', request.url), 307)
  }

  // «Più contatti»: la pagina con un pulsante per contatto
  if (data.content_type === 'multi') {
    return NextResponse.redirect(new URL(`/qr/${encodeURIComponent(code)}`, request.url), 307)
  }

  if (data.content_type === 'vcard') {
    const vcard = data.destination as unknown as VcardDestination
    const vcf = buildVcardContent(vcard)
    const rawName = [vcard.firstName, vcard.lastName]
      .filter(Boolean)
      .join('-')
      .replace(/[\u0000-\u001f\u007f"\\/]/g, '')
      .trim()
    // Fallback ASCII sicuro (header HTTP accetta solo Latin-1) + filename* UTF-8 per i nomi non latini
    const asciiName =
      rawName
        .replace(/[^A-Za-z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '') || 'contact'
    const utf8Name = encodeURIComponent(`${rawName || 'contact'}.vcf`).replace(
      /['()*]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
    )
    return new NextResponse(vcf, {
      status: 200,
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
        'Content-Disposition': `attachment; filename="${asciiName}.vcf"; filename*=UTF-8''${utf8Name}`,
      },
    })
  }

  const target = buildTargetUrl(data)
  if (!target && data.content_type === 'link') {
    // Destinazione non http(s): non reindirizziamo
    return new NextResponse('Not found', { status: 404 })
  }
  if (!target) {
    return NextResponse.redirect(new URL('/qr-non-attivo', request.url), 307)
  }

  return NextResponse.redirect(target, 307)
}
