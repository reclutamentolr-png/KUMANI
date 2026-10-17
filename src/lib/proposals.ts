// «Proposte della community» (fase 1: proposte per KUMANI). Le regole
// (piano, limiti, sostegni anonimi, moderazione) stanno nelle funzioni del
// database proposal_* e proposals_*; qui tipi e costanti comuni.

export const PROPOSAL_TOPICS = ['existing', 'new', 'app'] as const
export type ProposalTopic = (typeof PROPOSAL_TOPICS)[number]

// pending = in attesa dello Staff; changes = modifica chiesta all'autore;
// rejected = rifiutata; le altre sono pubblicate
export const PROPOSAL_STATUSES = ['pending', 'changes', 'rejected', 'open', 'review', 'planned', 'done', 'declined'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]
export const PUBLISHED_STATUSES: ProposalStatus[] = ['open', 'review', 'planned', 'done', 'declined']
export const VOTABLE_STATUSES: ProposalStatus[] = ['open', 'review', 'planned']
// Stati che lo Staff dà a una proposta pubblicata
export const STAFF_PUBLIC_STATUSES = ['open', 'review', 'planned', 'done', 'declined'] as const

export const PROPOSAL_SORTS = ['top', 'new', 'done', 'mine'] as const
export type ProposalSort = (typeof PROPOSAL_SORTS)[number]

export const REPORT_REASONS = ['politics', 'against', 'ads', 'offensive', 'duplicate', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const PROPOSAL_LIMITS = { titleMin: 8, titleMax: 90, bodyMin: 20, bodyMax: 1200, reply: 1000, note: 300 } as const

export interface Proposal {
  id: string
  title: string
  body: string
  topic: ProposalTopic
  tool_name: string | null
  status: ProposalStatus
  votes_count: number
  staff_reply: string | null
  staff_note: string | null
  created_at: string
  published_at: string | null
  status_changed_at: string
  author_name: string | null
  author_verified?: boolean
  is_mine: boolean
  my_vote: boolean
  my_report?: boolean
}

export interface ProposalForm {
  topic: ProposalTopic
  toolName: string
  title: string
  body: string
}

// Colori dello stato (testo e sfondo con contrasto AA)
export const STATUS_STYLES: Record<ProposalStatus, string> = {
  pending: 'bg-[#f0ece2] text-[#5f594d]',
  changes: 'bg-[#fbf3dc] text-[#7a5a14]',
  rejected: 'bg-[#fdecea] text-[#a3261c]',
  open: 'bg-[#f0ece2] text-[#4a453b]',
  review: 'bg-[#fbf3dc] text-[#7a5a14]',
  planned: 'bg-[#e8f0ff] text-[#1e4fa3]',
  done: 'bg-[#e7f4ea] text-[#1d6b34]',
  declined: 'bg-[#efefef] text-[#555555]',
}
