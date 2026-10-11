import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defaultLocale } from '../../../../i18n'

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  const supabase = await createClient()
  const { data } = (await supabase
    .rpc('register_offer_click', {
      p_code: code,
      p_referrer: request.headers.get('referer'),
      p_user_agent: request.headers.get('user-agent'),
    })
    .single()) as { data: { code: string; locale: string } | null }

  if (!data) {
    return NextResponse.redirect(new URL('/qr-non-attivo', request.url), 307)
  }

  const path = data.locale && data.locale !== defaultLocale ? `/${data.locale}/offerte/${data.code}` : `/offerte/${data.code}`

  return NextResponse.redirect(new URL(path, request.url), 307)
}
