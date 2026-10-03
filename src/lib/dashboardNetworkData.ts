import { SITE_URL } from '@/lib/siteUrl'
import type { MyProfile } from '@/lib/myProfile'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { isActiveSubscription } from './subscriptionGate'
import { fetchDirectSponsored } from './directAffiliates'
import { getCurrentRank, getNewlyAchievedRank } from './ranks'
import { getMyNetworkWallet } from './networkWallet'

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
  locale: string,
  // tree: albero completo della rete (solo la pagina "La mia rete"; la
  // dashboard mostra un riepilogo e non lo carica, altrimenti chi sta in
  // cima leggerebbe tutta la matrice; nella stella si possono aprire le
  // stelle dei propri Kumani fino al 5° livello). claims: 'inline' riscuote i bonus
  // prima di rispondere, 'skip' li lascia a deferNetworkClaims().
  options: { tree?: boolean; claims?: 'inline' | 'skip' } = {}
) {
  const { tree = true, claims: claimsMode = 'inline' } = options
  // Bonus da riscuotere (vedi claimNetworkBonuses): partono subito, uno
  // dopo l'altro come prima, ma in parallelo alle letture invece che dopo.
  const claims = claimsMode === 'inline' ? claimNetworkBonuses(supabase) : Promise.resolve()

  // Letture indipendenti tutte insieme: nodo matrice dell'utente, i propri
  // discendenti (nome e stato attivo; cognome e codice solo dei propri
  // invitati diretti, per gli altri il codice mascherato), lo sponsor (il KUMI) e
  // gli invitati diretti.
  const [{ data: userNode }, { data: downlineRows, error: matrixError }, { data: sponsorData }, directSponsored, wallet, receivedRows] = await Promise.all([
    tree ? supabase.from('matrix_nodes').select('*').eq('user_id', user.id).single() : Promise.resolve({ data: null, error: null }),
    tree ? supabase.rpc('get_my_downline') : Promise.resolve({ data: null, error: null }),
    supabase
      .rpc('get_my_sponsor')
      .maybeSingle<{ first_name: string | null; last_name: string | null; referral_code: string | null }>(),
    fetchDirectSponsored(supabase),
    getMyNetworkWallet(supabase),
    // Ricevuti dalla community (nei propri 5 posti, invitati da altri): con
    // l'albero si ricavano da lì, altrimenti li conta il database
    tree
      ? Promise.resolve(null)
      : supabase
          .rpc('my_received_kumani')
          .then(({ data, error }) => (error ? [] : ((data ?? []) as { first_name: string | null; joined_at: string }[]))),
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
    // Solo dei propri invitati diretti (vedi 20261221100000_downline_star_navigation.sql)
    last_name?: string | null
    referral_code?: string | null
    masked_code?: string | null
    is_my_direct?: boolean
    sponsored_by_parent?: boolean
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

  // Invitati diretti (profiles.sponsor_id) con abbonamento attivo, non i
  // figli nella matrice (matrix_nodes.parent_id, bloccati a 5 dallo spillover)
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

  // Nella stella: chi occupa uno dei 5 posti diretti senza essere un
  // proprio invitato è arrivato dalla community (colore diverso)
  const directIds = new Set(directSponsored.map((p) => p.id))
  const receivedNodes = activeDownlineForTree.filter((node) => node.parent_id === userNodeId && !directIds.has(node.user_id))
  const receivedIds = receivedNodes.map((node) => node.user_id)
  const receivedKumani =
    receivedRows ?? receivedNodes.map((node) => ({ first_name: node.first_name ?? null, joined_at: node.created_at }))

  // Qualifiche (solo badge): Punti Community guadagnati in totale, soglie
  // dei pacchetti voucher
  const { ranks, earnedTotal: networkPointsEarned } = wallet
  const currentRank = getCurrentRank(networkPointsEarned, ranks)
  const newlyAchievedRank = getNewlyAchievedRank(networkPointsEarned, profile?.qualifications_seen || [], ranks)
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
    receivedKumani,
    receivedIds,
    currentRank,
    newlyAchievedRank,
    ranks,
    networkPointsEarned,
    loginUrl,
  }
}

export type DashboardNetworkData = Awaited<ReturnType<typeof getDashboardNetworkData>>

// Bonus della rete riscossi a ogni apertura della dashboard (idempotente e
// verificato dal database). I Punti Community delle attivazioni arrivano
// invece dal webhook di Stripe (award_activation_points); i vecchi bonus
// (qualifiche, 6° diretto, ringraziamento, extra Pro) non esistono più.
async function claimNetworkBonuses(supabase: SupabaseClient) {
  // "Bonus Accoglienza": pays out for matrix slots filled since the last
  // check, whether by personal sponsorship or by someone else's spillover
  // landing in one of this Kumano's 5 direct positions.
  await supabase.rpc('claim_matrix_slot_bonus')
}

// Riscuote i bonus della rete DOPO aver risposto (non cambiano nulla di
// quello che la pagina mostra: i punti sono già stati letti), così la
// pagina non aspetta 5 richieste in fila. Dopo la risposta i cookie non si
// possono più leggere: si usa il token della sessione appena verificata.
export async function deferNetworkClaims(supabase: SupabaseClient) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return
  after(async () => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    try {
      await claimNetworkBonuses(client)
    } catch (error) {
      console.error('[deferNetworkClaims]', error)
    }
  })
}
