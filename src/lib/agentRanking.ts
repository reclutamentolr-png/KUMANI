import { createClient as createServiceClient } from '@supabase/supabase-js'

// Classifica degli agenti per attivazioni (prime vendite non annullate), con
// clienti collegati e rinnovi. Usata dall'Admin e, per la sola posizione,
// dalla zona Agenti. Solo lato server.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type AgentRanking = {
  person: { id: string; name: string; code: string | null; email: string | null }
  agentCode: string
  active: boolean
  customers: number
  activeCustomers: number
  firstSales: number
  renewals: number
  commissionCents: number
}[]

export async function agentRankingData(): Promise<AgentRanking> {
  const [{ data: agents }, { data: commissions }, { data: customers }] = await Promise.all([
    db().from('agents').select('user_id, code, is_active'),
    db().from('agent_commissions').select('agent_id, kind, status, commission_cents'),
    db().from('profiles').select('agent_id, subscription_status, subscription_expires_at').not('agent_id', 'is', null),
  ])
  const ids = (agents ?? []).map((a) => a.user_id)
  const { data: profiles } = ids.length
    ? await db().from('profiles').select('id, first_name, last_name, referral_code, email').in('id', ids)
    : { data: [] }
  const persons = new Map(
    (profiles ?? []).map((p) => [p.id, { id: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—', code: p.referral_code, email: p.email }])
  )
  const now = Date.now()
  return (agents ?? [])
    .map((a) => {
      const own = (commissions ?? []).filter((c) => c.agent_id === a.user_id && c.status !== 'cancelled')
      const mine = (customers ?? []).filter((c) => c.agent_id === a.user_id)
      return {
        person: persons.get(a.user_id) ?? { id: a.user_id, name: '—', code: null, email: null },
        agentCode: a.code,
        active: a.is_active,
        customers: mine.length,
        activeCustomers: mine.filter(
          (c) => c.subscription_status === 'active' && (!c.subscription_expires_at || new Date(c.subscription_expires_at).getTime() > now)
        ).length,
        firstSales: own.filter((c) => c.kind === 'first').length,
        renewals: own.filter((c) => c.kind === 'renewal').length,
        commissionCents: own.reduce((sum, c) => sum + (c.commission_cents ?? 0), 0),
      }
    })
    .sort((a, b) => b.firstSales - a.firstSales || b.activeCustomers - a.activeCustomers || b.renewals - a.renewals)
}

// Posizione di un agente (tra quelli attivi) per attivazioni
export async function agentRankingPosition(agentId: string): Promise<{ position: number; total: number } | null> {
  const ranking = (await agentRankingData()).filter((a) => a.active)
  const index = ranking.findIndex((a) => a.person.id === agentId)
  return index === -1 ? null : { position: index + 1, total: ranking.length }
}
