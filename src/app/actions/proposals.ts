'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { localizedPath, notifyUser } from '@/lib/push'
import {
  PROPOSAL_LIMITS,
  PROPOSAL_TOPICS,
  REPORT_REASONS,
  STAFF_PUBLIC_STATUSES,
  type Proposal,
  type ProposalForm,
  type ProposalSort,
  type ProposalStatus,
  type ReportReason,
} from '@/lib/proposals'

// Proposte della community: tutte le regole sono nelle funzioni del database
// (proposal_save, proposal_vote, proposal_report, proposal_staff_set); qui
// la validazione dei campi e le notifiche.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Result<T> = { success: true; data: T } | { success: false; message: string }

const normalize = (row: Record<string, unknown>): Proposal => ({ ...(row as unknown as Proposal), votes_count: Number(row.votes_count) || 0 })
// Codice dell'errore alzato dal database (raise exception 'codice')
const codeOf = (error: { message?: string } | null) => {
  const known = ['plan_required', 'weekly_limit', 'pending_limit', 'disabled', 'not_votable', 'not_editable', 'invalid', 'not_logged_in']
  return known.find((k) => error?.message?.includes(k)) ?? 'saveError'
}

export async function listProposals(sort: ProposalSort): Promise<Proposal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('proposals_feed', { p_sort: sort === 'mine' ? 'new' : sort, p_mine: sort === 'mine', p_limit: 100 })
  if (error) {
    console.error('[proposte] elenco:', error.message)
    return []
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalize)
}

// Le più sostenute (striscia della pagina Community)
export async function topProposals(limit = 3): Promise<Proposal[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('proposals_feed', { p_sort: 'top', p_mine: false, p_limit: limit })
  return ((data ?? []) as Record<string, unknown>[]).map(normalize)
}

export async function getProposal(id: string): Promise<Proposal | null> {
  if (!UUID_RE.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('proposal_get', { p_id: id }).maybeSingle()
  return data ? normalize(data as Record<string, unknown>) : null
}

// Chi può proporre: Base o Pro (o Staff); quante proposte fatte questa settimana
export async function proposeAccess(): Promise<{ canPropose: boolean; reason: 'plan' | 'week' | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { canPropose: false, reason: 'plan' }
  const [{ data: plan }, { data: staff }, { count }] = await Promise.all([
    supabase.rpc('can_use_tool', { p_tool: 'link-in-bio' }).maybeSingle<{ allowed: boolean }>(),
    supabase.rpc('admin_is_staff', { p_uid: user.id }),
    supabase.from('community_proposals').select('id', { count: 'exact', head: true }).eq('author_id', user.id).gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ])
  if (staff) return { canPropose: true, reason: null }
  if (!plan?.allowed) return { canPropose: false, reason: 'plan' }
  if ((count ?? 0) >= 1) return { canPropose: false, reason: 'week' }
  return { canPropose: true, reason: null }
}

export async function saveProposal(form: ProposalForm, editId?: string): Promise<Result<{ id: string }>> {
  const title = String(form.title ?? '').trim().replace(/\s+/g, ' ')
  const body = String(form.body ?? '').trim()
  if (!PROPOSAL_TOPICS.includes(form.topic)) return { success: false, message: 'invalid' }
  if (title.length < PROPOSAL_LIMITS.titleMin || title.length > PROPOSAL_LIMITS.titleMax) return { success: false, message: 'titleLength' }
  if (body.length < PROPOSAL_LIMITS.bodyMin || body.length > PROPOSAL_LIMITS.bodyMax) return { success: false, message: 'bodyLength' }
  if (editId && !UUID_RE.test(editId)) return { success: false, message: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('proposal_save', {
    p_id: editId ?? null,
    p_title: title,
    p_body: body,
    p_topic: form.topic,
    p_tool: form.topic === 'existing' ? String(form.toolName ?? '').slice(0, 60) : null,
  })
  if (error || !data) {
    console.error('[proposte] salvataggio:', error?.message)
    return { success: false, message: codeOf(error) }
  }
  return { success: true, data: { id: data as string } }
}

export async function voteProposal(id: string, on: boolean): Promise<Result<{ votes: number }>> {
  if (!UUID_RE.test(id)) return { success: false, message: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('proposal_vote', { p_id: id, p_on: on })
  if (error) return { success: false, message: codeOf(error) }
  return { success: true, data: { votes: Number(data) || 0 } }
}

export async function reportProposal(id: string, reason: ReportReason, note: string): Promise<Result<null>> {
  if (!UUID_RE.test(id) || !REPORT_REASONS.includes(reason)) return { success: false, message: 'invalid' }
  const supabase = await createClient()
  const { error } = await supabase.rpc('proposal_report', { p_id: id, p_reason: reason, p_note: String(note ?? '').slice(0, PROPOSAL_LIMITS.note) })
  if (error) return { success: false, message: codeOf(error) }
  return { success: true, data: null }
}

export async function similarProposals(text: string): Promise<{ id: string; title: string; votes_count: number; status: ProposalStatus }[]> {
  const value = String(text ?? '').trim().slice(0, PROPOSAL_LIMITS.titleMax)
  if (value.length < 6) return []
  const supabase = await createClient()
  const { data } = await supabase.rpc('proposals_similar', { p_text: value })
  return (data ?? []) as { id: string; title: string; votes_count: number; status: ProposalStatus }[]
}

// ——— Staff ———

function service() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
}

export type AdminProposal = Proposal & { author_id: string | null; author_email: string | null; reports: { reason: ReportReason; note: string | null; created_at: string }[] }

export async function adminListProposals(view: 'pending' | 'reported' | 'published'): Promise<{ rows: AdminProposal[]; error: string | null }> {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { rows: [], error: 'Non autorizzato' }
  const db = service()
  let query = db
    .from('community_proposals')
    .select('id, title, body, topic, tool_name, status, votes_count, reports_count, staff_reply, staff_note, created_at, published_at, status_changed_at, author_id')
    .limit(200)
  if (view === 'pending') query = query.eq('status', 'pending').order('created_at')
  else if (view === 'reported') query = query.gt('reports_count', 0).order('reports_count', { ascending: false })
  else query = query.in('status', [...STAFF_PUBLIC_STATUSES]).order('votes_count', { ascending: false })
  const { data, error } = await query
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as (Record<string, unknown> & { id: string; author_id: string | null })[]
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter((x): x is string => !!x))]
  const ids = rows.map((r) => r.id)
  const [{ data: people }, { data: reports }] = await Promise.all([
    authorIds.length ? db.from('profiles').select('id, first_name, last_name, email').in('id', authorIds) : Promise.resolve({ data: [] }),
    ids.length ? db.from('community_proposal_reports').select('proposal_id, reason, note, created_at').in('proposal_id', ids).eq('status', 'open') : Promise.resolve({ data: [] }),
  ])
  const person = new Map((people ?? []).map((p) => [p.id as string, p]))
  return {
    rows: rows.map((r) => {
      const p = r.author_id ? person.get(r.author_id) : null
      return {
        ...(normalize(r) as Proposal),
        is_mine: false,
        my_vote: false,
        author_id: r.author_id,
        author_name: p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null,
        author_email: (p?.email as string | undefined) ?? null,
        reports: (reports ?? []).filter((x) => x.proposal_id === r.id).map((x) => ({ reason: x.reason as ReportReason, note: x.note as string | null, created_at: x.created_at as string })),
      }
    }),
    error: null,
  }
}

// Stato e risposta dello Staff; avvisi all'autore e, se pianificata o
// realizzata, a chi l'ha sostenuta
export async function adminSetProposal(id: string, status: ProposalStatus, reply: string | null, note: string | null): Promise<{ success: boolean; error: string | null }> {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!UUID_RE.test(id)) return { success: false, error: 'Proposta non valida' }
  if ((status === 'changes' || status === 'rejected') && !String(note ?? '').trim()) return { success: false, error: 'Scrivi il motivo per l’autore' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('proposal_staff_set', { p_id: id, p_status: status, p_reply: reply, p_note: note })
    .maybeSingle<{ author_id: string | null; title: string; old_status: ProposalStatus; new_status: ProposalStatus; rewarded_ku: number }>()
  if (error || !data) return { success: false, error: error?.message ?? 'Errore' }

  const changed = data.old_status !== data.new_status
  const stamp = new Date().toISOString().slice(0, 16)
  if (data.author_id && changed) {
    const kind = data.new_status === 'changes' ? 'Changes' : data.new_status === 'rejected' ? 'Rejected' : data.old_status === 'pending' ? 'Published' : 'Status'
    await notifyUser(
      data.author_id,
      'staff',
      (t, locale) => ({
        title: t(`proposal${kind}Title`),
        body: t(`proposal${kind}Body`, { title: data.title, status: t(`proposalStatus_${data.new_status}`), ku: data.rewarded_ku }),
        url: localizedPath(locale, `/community/proposte/${id}`),
        tag: `proposal-${id}`,
      }),
      { kind: `proposal_${data.new_status}`, ref: `${id}:${stamp}` }
    )
  }
  if (changed && (data.new_status === 'planned' || data.new_status === 'done')) {
    const { data: voters } = await service().from('community_proposal_votes').select('user_id').eq('proposal_id', id).limit(2000)
    for (const v of voters ?? []) {
      if (v.user_id === data.author_id) continue
      await notifyUser(
        v.user_id as string,
        'staff',
        (t, locale) => ({
          title: t('proposalSupportedTitle'),
          body: t('proposalSupportedBody', { title: data.title, status: t(`proposalStatus_${data.new_status}`) }),
          url: localizedPath(locale, `/community/proposte/${id}`),
          tag: `proposal-${id}`,
        }),
        { kind: `proposal_supported_${data.new_status}`, ref: id }
      )
    }
  }
  return { success: true, error: null }
}

export async function adminCloseProposalReports(id: string): Promise<{ success: boolean; error: string | null }> {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!UUID_RE.test(id)) return { success: false, error: 'Proposta non valida' }
  const { error } = await service().from('community_proposal_reports').update({ status: 'closed' }).eq('proposal_id', id).eq('status', 'open')
  return { success: !error, error: error?.message ?? null }
}
