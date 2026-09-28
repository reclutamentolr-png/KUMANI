import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'

const VALID_TYPES = ['phishing', 'scam', 'impersonation', 'other']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await hasActiveToolAccess(supabase, user.id, 'svat'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { qrData, type } = body

  if (!qrData || typeof qrData !== 'string') {
    return NextResponse.json({ error: 'qrData required' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  }

  const { error } = await supabase.from('svat_qc_reports').insert({
    qr_data: qrData,
    type,
    user_id: user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await awardToolPoint('svat')
  return NextResponse.json({ success: true })
}
