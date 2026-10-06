import { SITE_URL } from '@/lib/siteUrl'
import type { MyProfile } from '@/lib/myProfile'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { isActiveSubscription } from './subscriptionGate'
import { fetchDirectSponsored, type SponsoredProfile } from './directAffiliates'
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
  // Anche come promessa: il profilo serve solo dopo le letture, che così
  // partono senza aspettarlo.
  profileInput: MyProfile | null | Promise<MyProfile | null>,
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

  // Letture indipendenti tutte insieme: nodo matrice dell'utente, la stella
  // (i Kumani attivi fino al 5° livello; cognome e codice solo dei propri
  // invitati diretti, per gli altri il codice mascherato) con i numeri della
  // rete contati dal database, lo sponsor (il KUMI) e gli invitati diretti.
  // Senza albero (dashboard e Community) bastano i conteggi del riepilogo.
  const [{ data: userNode }, treeData, { data: sponsorData }, directData, wallet, { data: achievementRows }] = await Promise.all([
    tree
      ? supabase.from('matrix_nodes').select('id, parent_id, path, level, position, depth, created_at').eq('user_id', user.id).maybeSingle<MatrixNodeRow>()
      : Promise.resolve({ data: null, error: null }),
    tree ? loadDownlineTree(supabase) : Promise.resolve(null),
    supabase
      .rpc('get_my_sponsor')
      .maybeSingle<{ first_name: string | null; last_name: string | null; referral_code: string | null }>(),
    tree ? fetchDirectSponsored(supabase).then((list) => ({ list, summary: null })) : loadNetworkSummary(supabase),
    getMyNetworkWallet(supabase),
    // Qualifiche raggiunte (il database le ricalcola e dà i voucher premio)
    supabase.rpc('my_rank_achievements'),
  ])
  const profile = await profileInput
  const downlineData = (treeData?.rows ?? []).map((node) => ({ ...node, first_name: node.first_name ?? undefined }))
  const downlineError = treeData?.error ?? null
  const directSponsored = directData.list

  // Solo chi ha un abbonamento attivo appare visivamente nell'albero della
  // matrice: chi si registra ma non attiva l'abbonamento resta comunque
  // posizionato nella struttura reale (per lo spillover), ma non è mostrato
  // qui — appare invece nella lista "Non ancora KUMANI".
  const activeDownlineForTree = downlineData.filter((node) => node.is_active)

  // Costruisci il rootNode
  const correctRootId = userNode?.id || downlineData[0]?.parent_id || `root-${user.id}`
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
  const userNodeId = userNode?.id

  // Statistiche rapide (su tutta la discendenza, attivi e no): di norma le
  // conta il database (get_my_network_totals); se la funzione manca si
  // ricavano dall'elenco completo come prima.
  // matrix_nodes.depth is absolute (from the global matrix root), not
  // relative to the viewed user — anyone placed via spillover has a
  // nonzero depth themselves, so it must be subtracted to get "how many
  // levels below ME" rather than "how many levels below the company root".
  // I livelli si contano dal percorso in matrice (sempre esatto): i nodi
  // radice (account KUMANI e chi è in cima a una propria struttura) hanno
  // depth 0 salvato, mentre i loro figli partono da 2, e il conto veniva
  // un livello in più (es. "fino al 5° livello" con 4 livelli).
  const levelOf = (node: { depth: number; path?: string | null }) => (node.path ? String(node.path).split('.').length - 1 : node.depth)
  const rootDepth = userNode ? levelOf(userNode) : 0
  const totals = treeData?.totals
  const totalDownline = totals ? totals.total_downline : downlineData.length
  const maxDownlineDepth = totals
    ? totals.max_depth
    : downlineData.reduce((max: number, node) => Math.max(max, levelOf(node) - rootDepth), 0)

  // Invitati diretti (profiles.sponsor_id) con abbonamento attivo, non i
  // figli nella matrice (matrix_nodes.parent_id, bloccati a 5 dallo spillover)
  const directActiveSponsored = directSponsored.filter(isActiveSubscription)
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
  const directSponsorInSpilloverCount = totals
    ? totals.direct_in_spillover
    : (() => {
        const downlineNodeByUserId = new Map(downlineData.map((d) => [d.user_id, d]))
        return directSponsored.filter((p) => {
          const node = downlineNodeByUserId.get(p.id)
          return node ? node.parent_id !== userNodeId : false
        }).length
      })()

  // Nella stella: chi occupa uno dei 5 posti diretti senza essere un
  // proprio invitato è arrivato dalla community (colore diverso)
  const directIds = new Set(directSponsored.map((p) => p.id))
  const receivedNodes = activeDownlineForTree.filter((node) => node.parent_id === userNodeId && !directIds.has(node.user_id))
  const receivedIds = receivedNodes.map((node) => node.user_id)
  const receivedKumani = receivedNodes.map((node) => ({ first_name: node.first_name ?? null, joined_at: node.created_at }))

  // Conteggi del riepilogo (dashboard e Community): senza albero li dà il
  // database, altrimenti si contano gli elenchi appena letti
  const summary = directData.summary
  const activeKumaniCount = summary ? summary.active_direct : activeKumani.length
  const pendingKumaniCount = summary ? summary.pending_direct : pendingKumani.length
  const receivedKumaniCount = summary ? summary.received : receivedKumani.length
  const directSponsorCount = activeKumaniCount

  // Qualifiche: le registra il database con attivazioni e KU Points
  // confermati (dopo i giorni del recesso); quelli in conferma si mostrano a parte
  const { ranks, confirmedPoints: networkPointsEarned, activations: networkActivations } = wallet
  // Con la data e i giorni dall'iscrizione (schede "Prossimi obiettivi")
  const achievements = (achievementRows ?? []) as { rank_key: string; achieved_at: string; days: number }[]
  const achievedKeys = achievements.map((row) => row.rank_key)
  const currentRank = getCurrentRank(achievedKeys, ranks)
  const newlyAchievedRank = getNewlyAchievedRank(achievedKeys, profile?.qualifications_seen || [], ranks)
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
    // Per il riepilogo: senza albero gli elenchi qui sopra restano vuoti
    activeKumaniCount,
    pendingKumaniCount,
    receivedKumaniCount,
    receivedIds,
    currentRank,
    newlyAchievedRank,
    ranks,
    networkPointsEarned,
    networkActivations,
    achievedKeys,
    achievements,
    blackPlusEvery: wallet.blackPlusEvery,
    networkPendingActivations: wallet.pendingActivations,
    networkPendingPoints: wallet.pendingPoints,
    pointsConfirmDays: wallet.confirmDays,
    loginUrl,
  }
}

type MatrixNodeRow = {
  id: string
  parent_id: string | null
  path: string
  level: number
  position: number
  depth: number
  created_at: string
}

type DownlineRow = MatrixNodeRow & {
  user_id: string
  first_name: string | null
  is_active: boolean
  // Solo dei propri invitati diretti (vedi 20261221100000_downline_star_navigation.sql)
  last_name?: string | null
  referral_code?: string | null
  masked_code?: string | null
  is_my_direct?: boolean
  sponsored_by_parent?: boolean
  // Kumani attivi sotto di lui, a qualunque profondità (get_my_downline_star)
  active_downline_count?: number
}

type NetworkTotals = { total_downline: number; max_depth: number; direct_in_spillover: number }

// Livelli della stella che si possono vedere (MatrixTree: fino al 5° sotto il titolare)
const STAR_MAX_DEPTH = 5

/**
 * La stella: solo i Kumani attivi fino al 5° livello, con i numeri della
 * rete contati dal database (20270122100000_network_scaling.sql), così chi
 * sta in cima non legge tutta la matrice. Se le funzioni nuove non ci sono
 * ancora, si torna all'elenco completo di get_my_downline().
 */
async function loadDownlineTree(
  supabase: SupabaseClient
): Promise<{ rows: DownlineRow[]; totals: NetworkTotals | null; error: { message: string } | null }> {
  const [star, totals] = await Promise.all([
    supabase.rpc('get_my_downline_star', { p_max_depth: STAR_MAX_DEPTH }),
    supabase.rpc('get_my_network_totals').maybeSingle<NetworkTotals>(),
  ])
  if (!star.error && !totals.error) {
    return {
      rows: (star.data ?? []) as DownlineRow[],
      totals: totals.data ?? { total_downline: 0, max_depth: 0, direct_in_spillover: 0 },
      error: null,
    }
  }
  const { data, error } = await supabase.rpc('get_my_downline')
  return { rows: (data ?? []) as DownlineRow[], totals: null, error }
}

type NetworkSummary = { active_direct: number; pending_direct: number; received: number }

/**
 * Riepilogo senza albero: solo i conteggi (my_network_summary), non gli
 * elenchi con i telefoni. Se la funzione manca, gli elenchi come prima.
 */
async function loadNetworkSummary(supabase: SupabaseClient): Promise<{ list: SponsoredProfile[]; summary: NetworkSummary | null }> {
  const { data, error } = await supabase.rpc('my_network_summary').maybeSingle<NetworkSummary>()
  if (!error) return { list: [], summary: data ?? { active_direct: 0, pending_direct: 0, received: 0 } }
  const [list, received] = await Promise.all([
    fetchDirectSponsored(supabase),
    supabase.rpc('my_received_kumani').then(({ data: rows, error: receivedError }) => (receivedError ? [] : ((rows ?? []) as unknown[]))),
  ])
  const active = list.filter(isActiveSubscription).length
  return { list, summary: { active_direct: active, pending_direct: list.length - active, received: received.length } }
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
      // Qualifiche e premi ricalcolati dopo aver mostrato la pagina
      // (my_rank_achievements ora legge soltanto)
      await client.rpc('refresh_my_qualifications')
    } catch (error) {
      console.error('[deferNetworkClaims]', error)
    }
  })
}
