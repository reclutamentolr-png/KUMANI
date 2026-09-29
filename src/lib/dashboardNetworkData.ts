import { SITE_URL } from '@/lib/siteUrl'
import type { MyProfile } from '@/lib/myProfile'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isActiveSubscription } from './subscriptionGate'
import { fetchDirectSponsored } from './directAffiliates'
import { getCurrentRank, getNewlyAchievedRank, getUnclaimedRankBonuses } from './ranks'

/**
 * Everything the "rete" (network) section needs: matrix tree, KUMI
 * (sponsor), qualifications/rank, and the KUMANI / Non ancora KUMANI
 * lists. Extracted from dashboard/page.tsx so both the Tipo 1 layout
 * (rendered inline) and the dedicated /dashboard/rete page (Tipo 2) share
 * one source of truth instead of duplicating these queries.
 */
export async function getDashboardNetworkData(
  supabase: SupabaseClient,
  user: { id: string },
  profile: MyProfile | null,
  locale: string
) {
  // Bonus da riscuotere (vedi claimNetworkBonuses): partono subito, uno
  // dopo l'altro come prima, ma in parallelo alle letture invece che dopo.
  const claims = claimNetworkBonuses(supabase)

  // Letture indipendenti tutte insieme: nodo matrice dell'utente, i propri
  // discendenti (solo nome e stato attivo, calcolati dal database: niente
  // cognome o codice di chi è finito sotto di noi), lo sponsor (il KUMI) e
  // gli invitati diretti.
  const [{ data: userNode }, { data: downlineRows, error: matrixError }, { data: sponsorData }, directSponsored] = await Promise.all([
    supabase.from('matrix_nodes').select('*').eq('user_id', user.id).single(),
    supabase.rpc('get_my_downline'),
    supabase
      .rpc('get_my_sponsor')
      .maybeSingle<{ first_name: string | null; last_name: string | null; referral_code: string | null }>(),
    fetchDirectSponsored(supabase),
  ])
  const downlineData = ((downlineRows ?? []) as Array<{
    id: string
    user_id: string
    parent_id: string | null
    path: string
    level: number
    position: number
    depth: number
    created_at: string
    first_name: string | null
    is_active: boolean
  }>).map((node) => ({ ...node, first_name: node.first_name ?? undefined }))

  const downlineError = matrixError

  // Solo chi ha un abbonamento attivo appare visivamente nell'albero della
  // matrice: chi si registra ma non attiva l'abbonamento resta comunque
  // posizionato nella struttura reale (per lo spillover), ma non è mostrato
  // qui — appare invece nella lista "Non ancora KUMANI".
  const activeDownlineForTree = (downlineData || []).filter((node) => node.is_active)

  // Costruisci il rootNode
  const correctRootId = userNode?.id || (downlineData && downlineData.length > 0 ? downlineData[0].parent_id : `root-${user.id}`)
  const rootNode = {
    id: correctRootId,
    user_id: user.id,
    parent_id: userNode?.parent_id || null,
    path: userNode?.path || 'root',
    level: userNode?.level || 1,
    position: userNode?.position || 1,
    depth: userNode?.depth || 0,
    created_at: userNode?.created_at || new Date().toISOString(),
    username: profile?.username ?? undefined,
    first_name: profile?.first_name ?? undefined,
    last_name: profile?.last_name ?? undefined,
    referral_code: profile?.referral_code ?? undefined,
    country_code: profile?.country_code ?? undefined,
  }

  // Statistiche rapide
  const totalDownline = downlineData?.length || 0
  // matrix_nodes.depth is absolute (from the global matrix root), not
  // relative to the viewed user — anyone placed via spillover has a
  // nonzero depth themselves, so it must be subtracted to get "how many
  // levels below ME" rather than "how many levels below the company root".
  const rootDepth = userNode?.depth ?? 0
  const maxDownlineDepth = (downlineData || []).reduce(
    (max: number, node: { depth: number }) => Math.max(max, node.depth - rootDepth),
    0
  )
  const userNodeId = userNode?.id

  // QUALIFICHE — basate su quanti utenti QUESTO utente ha sponsorizzato
  // personalmente (profiles.sponsor_id) E CHE SONO ATTIVI (abbonamento
  // pagante), non sui figli diretti nella matrice (matrix_nodes.parent_id,
  // level1Count, che è bloccato a 5 dallo spillover) e non su sponsorizzati
  // non paganti: Rising Star/Diamond misurano un team di persone attive,
  // non solo registrate.
  const directActiveSponsored = directSponsored.filter(isActiveSubscription)
  const directSponsorCount = directActiveSponsored.length
  const directSponsoredWithStatus = directSponsored.map((p) => ({ ...p, is_active: isActiveSubscription(p) }))
  // "I tuoi KUMANI" mostra solo chi ha attivato l'abbonamento; chi si è
  // registrato ma non ha ancora attivato finisce in "Non ancora KUMANI",
  // con un promemoria WhatsApp pronto da inviare.
  const activeKumani = directSponsoredWithStatus.filter((p) => p.is_active)
  const pendingKumani = directSponsoredWithStatus.filter((p) => !p.is_active)

  // Quanti sponsorizzati diretti NON sono finiti in uno dei 5 posti diretti
  // della matrice (matrix_nodes.parent_id === userNodeId) ma sono stati
  // spostati più in profondità dallo spillover perché quei posti erano già
  // occupati — sono comunque "diretti" (sponsor_id), solo non posizionati
  // direttamente sotto di lui nell'albero.
  const downlineNodeByUserId = new Map(
    (downlineData || []).map((d: { user_id: string; parent_id: string | null }) => [d.user_id, d])
  )
  const directSponsorInSpilloverCount = directSponsored.filter((p) => {
    const node = downlineNodeByUserId.get(p.id)
    return node ? node.parent_id !== userNodeId : false
  }).length

  const currentRank = getCurrentRank(directSponsorCount)
  const newlyAchievedRank = getNewlyAchievedRank(directSponsorCount, profile?.qualifications_seen || [])

  // Silently credits network_points for any rank tier reached but not yet
  // claimed — independent of qualifications_seen (the popup dismissal
  // flag), so someone who reached a rank before this feature existed still
  // gets the bonus the next time their dashboard loads, without a popup.
  // claim_rank_bonus() recomputes the active-affiliate count itself and is
  // guarded against double-award, so calling it here on every dashboard
  // load (from either Tipo 1 or the /dashboard/rete page) is safe.
  const unclaimedBonuses = getUnclaimedRankBonuses(directSponsorCount, profile?.rank_bonuses_claimed || [])
  for (const rank of unclaimedBonuses) {
    await supabase.rpc('claim_rank_bonus', { p_rank_key: rank.key })
  }
  await claims

  const loginUrl = `${SITE_URL}/${locale}/login`

  return {
    rootNode,
    downlineData,
    activeDownlineForTree,
    downlineError,
    totalDownline,
    maxDownlineDepth,
    sponsorData,
    directSponsored,
    directActiveSponsored,
    directSponsorCount,
    activeKumani,
    pendingKumani,
    directSponsorInSpilloverCount,
    currentRank,
    newlyAchievedRank,
    loginUrl,
  }
}

export type DashboardNetworkData = Awaited<ReturnType<typeof getDashboardNetworkData>>

// Bonus della rete riscossi a ogni apertura della dashboard (tutti
// idempotenti e verificati dal database), uno dopo l'altro.
async function claimNetworkBonuses(supabase: SupabaseClient) {
  // "Bonus Struttura": pays out for matrix slots filled since the last
  // check, whether by personal sponsorship or by someone else's spillover
  // landing in one of this Kumano's 5 direct positions — see
  // claim_matrix_slot_bonus() for why spillover recipients otherwise get
  // nothing from the compensation plan. Idempotent and self-verifying, same
  // pattern as claim_rank_bonus above, safe to call on every dashboard load.
  await supabase.rpc('claim_matrix_slot_bonus')

  // Pays for direct sponsees beyond this Kumano's own 5 matrix slots (see
  // directSponsorInSpilloverCount above): claim_matrix_slot_bonus only
  // covers the 5 slots physically under this Kumano's node, so a 6th+
  // personal referral who spills over elsewhere in the tree otherwise earns
  // nothing here. Same idempotent, self-verifying pattern.
  await supabase.rpc('claim_sponsor_overflow_bonus')

  // "Ringraziamento attività": per chi si è iscritto senza invito ed è stato
  // abbinato a questo Kumano attivo, quando paga davvero il primo
  // abbonamento. Idempotente come i claim sopra.
  await supabase.rpc('claim_activity_thanks')

  // Extra Pro: invitato diretto che paga il piano Pro con carta (si somma
  // al Bonus Struttura). Idempotente: una volta per invitato.
  await supabase.rpc('claim_pro_invite_bonus')
}
