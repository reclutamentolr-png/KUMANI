'use client'

import dynamic from 'next/dynamic'
import { notify } from '@/lib/adminNotify'
import { SITE_URL } from '@/lib/siteUrl'
import AdminPanelLoading from '@/components/admin/AdminPanelLoading'
import AdminToaster from '@/components/admin/AdminToaster'
import { useState, useEffect, type ComponentProps } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, Permission } from '@/lib/admin-permissions'
import type MatrixTreeComponent from '@/components/MatrixTree'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import AdminUserPicker from '@/components/admin/AdminUserPicker'
import {
  adminUpdateProfile,
  adminSetToolEnabled,
  adminSetUserRole,
  adminGetUserRole,
  impersonateUser,
  createCoupon,
  listCoupons,
  revokeCoupon,
  listListingReports,
  adminListUsers,
  updateToolPlan,
  createVoucherBatch,
  listVoucherBatches,
  getVoucherBatchCodes,
  adminGetProfile,
  listSpotlightProfilesForModeration,
  moderateSpotlightProfile,
  dismissListingReport,
  deleteReportedListing,
  type StaffUserHit,
  adminGetUserMatrix,
} from '@/app/actions/admin'
import type {
  AdminUserRow,
  AdminProfileDetail,
  AdminProfileForm,
  MarketplaceToolUsage,
  AdminCouponRow,
  AdminVoucherBatch,
  ListingReport,
  AdminSpotlightProfile,
} from '@/lib/adminTypes'
import { SPOTLIGHT_HOME_MIN_POOL } from '@/lib/spotlight'
import type { ReportTab } from '@/components/admin/ReportsPanel'
import { startImpersonation } from '@/lib/impersonation'
import {
  LayoutDashboard,
  PlugZap,
  FileText,
  CalendarDays,
  Star,
  PanelsTopLeft,
  Coins,
  Users,
  GitBranch,
  ShoppingBag,
  Settings,
  Palette,
  BarChart3,
  Lock,
  ToggleLeft,
  ToggleRight,
  X,
  Save,
  Eye,
  Pencil,
  UserCog,
  Ticket,
  Trash2,
  BadgeCheck,
  Gift,
  PiggyBank,
  Calculator,
  Flag,
  MessageSquare,
  Megaphone,
  Crown,
  Mail,
  Send,
  ScanFace,
  HandCoins,
  Inbox,
  UserPen,
  UserX,
  HeartHandshake,
  Undo2,
  Hourglass,
  Grid3x3,
  Dices,
  ChevronDown,
  BellRing,
  Languages,
  Globe2,
  BriefcaseBusiness,
  MessageSquareQuote,
} from 'lucide-react'
import { askConfirm } from '@/lib/confirm'

// Ogni sezione dell'Admin si scarica solo quando la si apre
const loading = () => <AdminPanelLoading />
const KuManagementPanel = dynamic(() => import('@/components/admin/KuManagementPanel'), { loading })
const AffinityReportsPanel = dynamic(() => import('@/components/admin/AffinityReportsPanel'), { loading })
const LandingPagesPanel = dynamic(() => import('@/components/admin/LandingPagesPanel'), { loading })
const ReviewsPanel = dynamic(() => import('@/components/admin/ReviewsPanel'), { loading })
const ConvivioReportsPanel = dynamic(() => import('@/components/admin/ConvivioReportsPanel'), { loading })
const EventsAdminPanel = dynamic(() => import('@/components/admin/EventsAdminPanel'), { loading })
const TimebankAdminPanel = dynamic(() => import('@/components/admin/TimebankAdminPanel'), { loading })
const MosaicAdminPanel = dynamic(() => import('@/components/admin/MosaicAdminPanel'), { loading })
const FabulaAdminPanel = dynamic(() => import('@/components/admin/FabulaAdminPanel'), { loading })
const IdentityVerificationsPanel = dynamic(() => import('@/components/admin/IdentityVerificationsPanel'), { loading })
const ConvivioFeesPanel = dynamic(() => import('@/components/admin/ConvivioFeesPanel'), { loading })
const KordataShowcasePanel = dynamic(() => import('@/components/admin/KordataShowcasePanel'), { loading })
const AdminOverviewPanel = dynamic(() => import('@/components/admin/AdminOverviewPanel'), { loading })
const TrialCodesManager = dynamic(() => import('@/components/trials/TrialCodesManager'), { loading })
const GiftOrdersPanel = dynamic(() => import('@/components/admin/GiftOrdersPanel'), { loading })
const QualifiedMembersPanel = dynamic(() => import('@/components/admin/QualifiedMembersPanel'), { loading })
const ContactMessagesPanel = dynamic(() => import('@/components/admin/ContactMessagesPanel'), { loading })
const ProfileRequestsPanel = dynamic(() => import('@/components/admin/ProfileRequestsPanel'), { loading })
const AccountDeletionsPanel = dynamic(() => import('@/components/admin/AccountDeletionsPanel'), { loading })
const TranslatorsPanel = dynamic(() => import('@/components/admin/TranslatorsPanel'), { loading })
const LanguagesPanel = dynamic(() => import('@/components/admin/LanguagesPanel'), { loading })
const AgentsPanel = dynamic(() => import('@/components/admin/AgentsPanel'), { loading })
const WithdrawalsPanel = dynamic(() => import('@/components/admin/WithdrawalsPanel'), { loading })
const DonationsPanel = dynamic(() => import('@/components/admin/DonationsPanel'), { loading })
const HomeLayoutPanel = dynamic(() => import('@/components/admin/HomeLayoutPanel'), { loading })
const PlatformsPanel = dynamic(() => import('@/components/admin/PlatformsPanel'), { loading })
const EmailSetupPanel = dynamic(() => import('@/components/admin/EmailSetupPanel'), { loading })
const EmailComposePanel = dynamic(() => import('@/components/admin/EmailComposePanel'), { loading })
const PushPanel = dynamic(() => import('@/components/admin/PushPanel'), { loading })
const CostsPanel = dynamic(() => import('@/components/admin/CostsPanel'), { loading })
const DocumentsAdminPanel = dynamic(() => import('@/components/admin/DocumentsAdminPanel'), { loading })
const AdminLateSponsor = dynamic(() => import('@/components/admin/AdminLateSponsor'), { loading })
const AdminPasswordReset = dynamic(() => import('@/components/admin/AdminPasswordReset'), { loading })
const PassCodesPanel = dynamic(() => import('@/components/admin/PassCodesPanel'), { loading })
const ToolPassSetting = dynamic(() => import('@/components/admin/ToolPassSetting'), { loading })
const ReportsPanel = dynamic(() => import('@/components/admin/ReportsPanel'), { loading })
const MatrixTree = dynamic(() => import('@/components/MatrixTree'), { loading })
const AdminVouchersPanel = dynamic(() => import('@/components/admin/AdminVouchersPanel'), { loading })
const AdminFinancialsPanel = dynamic(() => import('@/components/admin/AdminFinancialsPanel'), { loading })
const AdminRewardsPanel = dynamic(() => import('@/components/admin/AdminRewardsPanel'), { loading })
const AdminMessagesPanel = dynamic(() => import('@/components/admin/AdminMessagesPanel'), { loading })
const AdminSettingsPanel = dynamic(() => import('@/components/admin/AdminSettingsPanel'), { loading })

// Strumenti e interruttori raggruppati come nel Marketplace. Le sezioni della
// piattaforma che non sono strumenti vanno in Community; il resto in "Altro".
const TOOL_GROUPS = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'security', label: 'Sicurezza e Verifica' },
  { id: 'personal', label: 'Organizzazione Personale' },
  { id: 'wellness', label: 'Benessere' },
  { id: 'lavoro', label: 'Lavoro' },
  { id: 'svago', label: 'Svago' },
  { id: 'community', label: 'Community' },
  { id: 'other', label: 'Altro' },
] as const
const PLATFORM_SWITCHES_COMMUNITY = new Set(['listings', 'chat', 'spotlight', 'convivio', 'events', 'timebank'])
const TOOL_CATEGORY: Map<string, string> = new Map(getMarketplaceTools((key) => key).map((tool) => [tool.toolName, tool.category]))
function toolCategoryOf(toolName: string): string {
  if (TOOL_CATEGORY.has(toolName)) return TOOL_CATEGORY.get(toolName)!
  if (PLATFORM_SWITCHES_COMMUNITY.has(toolName)) return 'community'
  return 'other'
}

// Gruppi del menu a sinistra, nell'ordine in cui compaiono
const MENU_GROUPS = [
  { id: 'general', label: 'Generale' },
  { id: 'users', label: 'Utenti' },
  { id: 'comms', label: 'Comunicazioni' },
  { id: 'rewards', label: 'Punti e premi' },
  { id: 'community', label: 'Community' },
  { id: 'kordata', label: 'Kordata' },
  { id: 'games', label: 'Giochi' },
] as const

// Nodo della matrice come lo vuole MatrixTree
type MatrixNode = ComponentProps<typeof MatrixTreeComponent>['rootNode']

type AdminDashboardProps = {
  userId: string
  permissions: Permission[]
  userName: string
  locale: string // ✅ AGGIUNTO: necessario per costruire il redirect URL
  initialSection?: string // da ?section= nell'URL, vedi admin/page.tsx
}

export default function AdminDashboard({ permissions, userName, locale, initialSection }: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState(initialSection || 'overview')
  // Scheda aperta in Statistiche e classifiche (dai pulsanti "Dettaglio")
  const [reportTab, setReportTab] = useState<ReportTab>('passes')
  const openReport = (tab: ReportTab) => {
    setReportTab(tab)
    setActiveSection('reports')
    window.scrollTo({ top: 0 })
  }
  // Menu a sinistra "a fisarmonica": un solo gruppo aperto alla volta.
  // undefined = segue la sezione aperta; null = tutti chiusi.
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined)
  // Strumenti e interruttori: gruppi chiusi finché non si aprono
  const [openToolGroups, setOpenToolGroups] = useState<Set<string>>(new Set())

  // Riflette la sezione attiva nell'URL (senza navigazione né reload), così
  // aggiornando la pagina si resta nella stessa voce del menu.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (activeSection === 'overview') url.searchParams.delete('section')
    else url.searchParams.set('section', activeSection)
    window.history.replaceState(window.history.state, '', url)
  }, [activeSection])
  const supabase = createClient()

  // Pallini oro nel menu: code da gestire + novità dall'ultima visita di
  // questo admin a ciascuna sezione (RPC admin_section_badges).
  const [badges, setBadges] = useState<Record<string, number>>({})
  const loadBadges = async () => {
    try {
      const { data, error } = await supabase.rpc('admin_section_badges')
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) return
      const next: Record<string, number> = {}
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const n = Number(value)
        if (Number.isFinite(n) && n > 0) next[key] = n
      }
      setBadges(next)
    } catch (error) {
      console.error('Errore caricamento pallini admin:', error)
    }
  }

  // Aggiornamento ogni 60 s, solo con la scheda visibile (e subito al ritorno).
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') loadBadges()
    }
    const interval = setInterval(tick, 60000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apertura di una sezione: segna come "vista" (azzera le novità, le code
  // restano finché non vengono gestite) e ricarica i pallini.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await supabase.rpc('admin_mark_section_seen', { p_section: activeSection })
      } catch (error) {
        console.error('Errore admin_mark_section_seen:', error)
      }
      if (!cancelled) await loadBadges()
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const badgeLabel = (count: number) => (count > 99 ? '99+' : String(count))

  const [onlineUsers, setOnlineUsers] = useState(0)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([])
  const [userCurrentRoleId, setUserCurrentRoleId] = useState<string>('none')
  const [isSaving, setIsSaving] = useState(false)

  const [matrixPickedUser, setMatrixPickedUser] = useState<StaffUserHit | null>(null)
  const [matrixData, setMatrixData] = useState<MatrixNode | null>(null)
  const [matrixDescendants, setMatrixDescendants] = useState<MatrixNode[]>([])
  const [matrixStats, setMatrixStats] = useState({ total: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 })
  const [loadingMatrix, setLoadingMatrix] = useState(false)

  const [marketplaceUsage, setMarketplaceUsage] = useState<MarketplaceToolUsage[]>([])
  const [savingTool, setSavingTool] = useState<string | null>(null)

  const [profileEditUser, setProfileEditUser] = useState<AdminProfileDetail | null>(null)
  const [profileForm, setProfileForm] = useState<AdminProfileForm>({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

  const [couponPickedUser, setCouponPickedUser] = useState<StaffUserHit | null>(null)
  const [coupons, setCoupons] = useState<AdminCouponRow[]>([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [couponForm, setCouponForm] = useState({ userId: '', title: '', description: '', expiresAt: '' })
  const [savingCoupon, setSavingCoupon] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)

  const [listingReports, setListingReports] = useState<ListingReport[]>([])
  const [loadingListingReports, setLoadingListingReports] = useState(false)

  const [spotlightProfiles, setSpotlightProfiles] = useState<AdminSpotlightProfile[]>([])
  const [loadingSpotlight, setLoadingSpotlight] = useState(false)

  const [voucherBatches, setVoucherBatches] = useState<AdminVoucherBatch[]>([])
  const [batchForm, setBatchForm] = useState<{ businessName: string; quantity: string; priceEur: string; invoiceRef: string; notes: string; plan: 'base' | 'pro' }>({ businessName: '', quantity: '10', priceEur: '400', invoiceRef: '', notes: '', plan: 'base' })
  const [creatingBatch, setCreatingBatch] = useState(false)
  const [couponArea, setCouponArea] = useState<'merchant' | 'community' | 'pass' | 'gifts' | 'trials'>('merchant')

  const loadOnlineUsers = async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen', fifteenMinutesAgo).is('guest_until', null)
      setOnlineUsers(count || 0)
    } catch (error) {
      console.error('Errore caricamento utenti online:', error)
    }
  }

  const loadUsers = async (silent = false) => {
    if (!silent) setLoadingUsers(true)
    const { users: data } = await adminListUsers()
    setUsers(data)
    setLoadingUsers(false)
  }

  const loadMatrixForUser = async (targetUserId: string) => {
    if (!targetUserId) {
      setMatrixData(null)
      setMatrixDescendants([])
      setMatrixStats({ total: 0, level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 })
      return
    }
    setLoadingMatrix(true)
    try {
      const result = await adminGetUserMatrix(targetUserId)
      const profile = result?.profile
      const userNode = result?.userNode
      const downlineData = result?.downline

      const correctRootId = userNode?.id || (downlineData && downlineData.length > 0 ? downlineData[0].parent_id : `root-${targetUserId}`)

      const rootNode = {
        id: correctRootId,
        user_id: targetUserId,
        parent_id: userNode?.parent_id || null,
        path: userNode?.path || 'root',
        level: userNode?.level || 1,
        position: userNode?.position || 1,
        depth: userNode?.depth || 0,
        created_at: userNode?.created_at || new Date().toISOString(),
        username: profile?.username,
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        referral_code: profile?.referral_code,
        country_code: profile?.country_code
      }

      setMatrixData(rootNode)
      // Nodi completi (con path) preparati da adminGetUserMatrix
      setMatrixDescendants((downlineData || []) as MatrixNode[])
      // "depth" è assoluta nella matrice: il livello 1 è il più alto sotto il titolare
      const rows = downlineData ?? []
      const top = rows.length ? Math.min(...rows.map((d) => d.depth)) : 0
      const atLevel = (n: number) => rows.filter((d) => d.depth - top + 1 === n).length
      setMatrixStats({ total: rows.length, level1: atLevel(1), level2: atLevel(2), level3: atLevel(3), level4: atLevel(4), level5: atLevel(5) })
    } catch (error) {
      console.error('Errore caricamento matrice:', error)
    } finally {
      setLoadingMatrix(false)
    }
  }

  const viewUserMatrix = (user: AdminUserRow) => {
    setActiveSection('matrix')
    setOpenGroup(undefined)
    setMatrixPickedUser({ id: user.id, first_name: user.first_name ?? null, last_name: user.last_name ?? null, referral_code: user.referral_code ?? null, email: user.email ?? null })
    setTimeout(() => {
      loadMatrixForUser(user.id)
    }, 100)
  }

  const loadMarketplaceData = async () => {
    const { data: tools } = await supabase.from('marketplace_settings').select('*').order('tool_name')
    const toolsList = tools || []

    const { data: usageRaw } = await supabase.from('marketplace_usage').select('tool_name')
    const usageCount: Record<string, number> = {}
    usageRaw?.forEach((u: { tool_name: string }) => {
      usageCount[u.tool_name] = (usageCount[u.tool_name] || 0) + 1
    })
    setMarketplaceUsage(
      toolsList.map(t => ({
        ...t,
        usage_count: usageCount[t.tool_name] || 0
      }))
    )
  }

  const loadCouponsData = async (silent = false) => {
    if (!silent) setLoadingCoupons(true)
    const [result, batchResult] = await Promise.all([listCoupons(), listVoucherBatches()])
    setCoupons(result.coupons)
    setVoucherBatches(batchResult.batches)
    setLoadingCoupons(false)
  }

  const handleCreateCoupon = async () => {
    setCouponError(null)
    if (!couponForm.userId || !couponForm.title.trim()) {
      setCouponError('Seleziona un utente e inserisci un titolo.')
      return
    }
    setSavingCoupon(true)
    const result = await createCoupon({
      userId: couponForm.userId,
      title: couponForm.title,
      description: couponForm.description,
      expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null,
    })
    setSavingCoupon(false)
    if (!result.success) {
      setCouponError(result.error || 'Errore durante la creazione del coupon.')
      return
    }
    setCouponForm({ userId: '', title: '', description: '', expiresAt: '' })
    setCouponPickedUser(null)
    await loadCouponsData(true)
  }

  const handleRevokeCoupon = async (couponId: string) => {
    if (!(await askConfirm('Revocare questo coupon? L\'operazione non è reversibile.'))) return
    const result = await revokeCoupon(couponId)
    if (result.success) {
      setCoupons((prev) => prev.filter((c) => c.id !== couponId))
    } else {
      notify(result.error || 'Errore durante la revoca del coupon.')
    }
  }

  const handleCreateBatch = async () => {
    const quantity = parseInt(batchForm.quantity, 10) || 0
    if (!(await askConfirm(`Generare ${quantity} coupon ${batchForm.plan === 'pro' ? 'PRO' : 'Base'} di attivazione per "${batchForm.businessName}"?`))) return
    setCreatingBatch(true)
    const result = await createVoucherBatch({
      businessName: batchForm.businessName,
      quantity,
      priceEur: batchForm.priceEur.trim() === '' ? null : Number(batchForm.priceEur.replace(',', '.')),
      invoiceRef: batchForm.invoiceRef,
      notes: batchForm.notes,
      plan: batchForm.plan,
    })
    setCreatingBatch(false)
    if (!result.success) {
      notify('❌ ' + result.error)
      return
    }
    setBatchForm({ businessName: '', quantity: '10', priceEur: '400', invoiceRef: '', notes: '', plan: 'base' })
    const { batches } = await listVoucherBatches()
    setVoucherBatches(batches)
    window.open(`/${locale}/admin/voucher-batch/${result.batchId}`, '_blank')
  }

  // CSV dei codici di un lotto (codice, stato, data di utilizzo).
  const downloadBatchCsv = async (batch: AdminVoucherBatch) => {
    const { codes } = await getVoucherBatchCodes(batch.id)
    const rows = [['codice', 'stato', 'usato_il'], ...codes.map((c) => [c.code, c.status === 'redeemed' ? 'usato' : c.status === 'revoked' ? 'revocato' : 'disponibile', c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString('it-IT') : ''])]
    const csv = rows.map((r) => r.join(';')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `coupon-${batch.business_name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadListingReportsData = async () => {
    setLoadingListingReports(true)
    const result = await listListingReports()
    setListingReports(result.reports)
    setLoadingListingReports(false)
  }

  const loadSpotlightData = async () => {
    setLoadingSpotlight(true)
    const result = await listSpotlightProfilesForModeration()
    setSpotlightProfiles(result.profiles)
    setLoadingSpotlight(false)
  }

  const handleModerateSpotlight = async (profileId: string, status: 'approved' | 'rejected') => {
    const result = await moderateSpotlightProfile(profileId, status)
    if (result.success) {
      setSpotlightProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, moderation_status: status } : p)))
      loadBadges()
    } else {
      notify(result.error || 'Errore durante la moderazione.')
    }
  }

  const handleDismissReport = async (reportId: string) => {
    const result = await dismissListingReport(reportId)
    if (result.success) {
      setListingReports((prev) => prev.filter((r) => r.id !== reportId))
      loadBadges()
    } else {
      notify(result.error || 'Errore durante la rimozione della segnalazione.')
    }
  }

  const handleDeleteReportedListing = async (listingId: string) => {
    if (!(await askConfirm('Eliminare definitivamente questo annuncio? L\'operazione non è reversibile.'))) return
    const result = await deleteReportedListing(listingId)
    if (result.success) {
      setListingReports((prev) => prev.filter((r) => r.listing_id !== listingId))
      loadBadges()
    } else {
      notify(result.error || 'Errore durante l\'eliminazione dell\'annuncio.')
    }
  }

  const changeToolPlan = async (toolName: string, plan: 'free' | 'base' | 'pro') => {
    setSavingTool(toolName)
    const result = await updateToolPlan(toolName, plan)
    if (result.success) await loadMarketplaceData()
    else notify('Errore: ' + (result.error || 'aggiornamento non riuscito'))
    setSavingTool(null)
  }

  const toggleToolEnabled = async (toolName: string, currentStatus: boolean) => {
    setSavingTool(toolName)
    const result = await adminSetToolEnabled(toolName, !currentStatus)
    if (result.success) {
      await loadMarketplaceData()
    } else {
      notify('Errore durante l\'aggiornamento: ' + (result.error || ''))
    }
    setSavingTool(null)
  }

  // Dati della sezione aperta (dopo le funzioni che li caricano)
  useEffect(() => {
    if (activeSection === 'overview') {
      // Caricamento dei dati della sezione (con il segnale "caricamento"):
      // è proprio il compito di questo effetto
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadOnlineUsers()
      const interval = setInterval(loadOnlineUsers, 30000)
      return () => clearInterval(interval)
    }
    else if (activeSection === 'users') loadUsers()
    else if (activeSection === 'marketplace') loadMarketplaceData()
    else if (activeSection === 'coupons') loadCouponsData()
    else if (activeSection === 'listingReports') loadListingReportsData()
    else if (activeSection === 'spotlight') loadSpotlightData()
    // Solo al cambio di sezione: le funzioni di caricamento cambiano a ogni
    // disegno e rimetterle qui ricaricherebbe i dati di continuo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const filteredUsers = users.filter(u =>
    u.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.referral_code?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openManageModal = async (user: AdminUserRow) => {
    setSelectedUser(user)
    setIsModalOpen(true)
    const { roles, roleId } = await adminGetUserRole(user.id)
    setAvailableRoles(roles)
    setUserCurrentRoleId(roleId || 'none')
  }

  const handleSaveUserManagement = async () => {
    if (!selectedUser) return
    setIsSaving(true)
    try {
      const result = await adminSetUserRole(selectedUser.id, userCurrentRoleId === 'none' ? null : userCurrentRoleId)
      if (!result.success) {
        notify('❌ ' + (result.error || 'Errore durante il salvataggio.'))
        return
      }
      await loadUsers(true)
      setIsModalOpen(false)
      setSelectedUser(null)
      notify('✅ Utente aggiornato con successo!')
    } catch {
      notify('❌ Errore durante il salvataggio.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleBlock = async (user: AdminUserRow) => {
    if (!(await askConfirm(`Sei sicuro di voler ${user.is_blocked ? 'SBLOCCARE' : 'BLOCCARE'} l'utente ${user.email}?`))) return
    const newBlockedStatus = !user.is_blocked
    // Lato server: is_blocked non è più scrivibile dal browser.
    const result = await adminUpdateProfile(user.id, { is_blocked: newBlockedStatus })
    if (result.success) {
      await loadUsers(true)
      notify(`✅ Utente ${newBlockedStatus ? 'bloccato' : 'sbloccato'} con successo.`)
    } else {
      notify('❌ Errore durante l\'aggiornamento.')
    }
  }

  const openProfileEdit = async (user: AdminUserRow) => {
    const { profile: data } = await adminGetProfile(user.id)
    if (data) {
      setProfileEditUser(data)
      setProfileForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        username: data.username || '',
        phone: data.phone || '',
        country_code: data.country_code || '',
        date_of_birth: data.date_of_birth === '2000-01-01' ? '' : (data.date_of_birth || ''),
        occupation: data.occupation || '',
        referral_code: data.referral_code || '',
        daily_points: data.daily_points || 0,
        subscription_status: data.subscription_status || 'free',
        subscription_plan: data.subscription_plan === 'pro' ? 'pro' : 'base',
        subscription_expires_at: data.subscription_expires_at ? data.subscription_expires_at.slice(0, 10) : '',
        is_admin: data.is_admin || false
      })
    }
  }

  const handleSaveProfile = async () => {
    if (!profileEditUser) return
    setSavingProfile(true)

    // subscription_source traccia CHI ha attivato l'abbonamento (stripe /
    // voucher / admin): il Bonus Accoglienza conta solo i downline attivati via
    // Stripe per i KU Points, quindi un'attivazione manuale da qui non deve
    // mai valere come pagamento reale. Lo tocchiamo solo quando lo stato
    // sta effettivamente cambiando — se era già "active" (es. pagamento
    // Stripe reale) e l'admin salva il form per un altro motivo, non
    // vogliamo silenziosamente riscrivere la provenienza a "admin".
    const statusChanged = profileForm.subscription_status !== profileEditUser.subscription_status
    const subscriptionSourcePatch = statusChanged
      ? { subscription_source: profileForm.subscription_status === 'active' ? 'admin' : null }
      : {}

    const result = await adminUpdateProfile(profileEditUser.id, {
      ...profileForm,
      ...subscriptionSourcePatch,
      date_of_birth: profileForm.date_of_birth || '2000-01-01',
      // Un abbonamento "Active" senza scadenza resta attivo per sempre
      // (isActiveSubscription tratta null come "nessuna scadenza") — qui
      // convertiamo la data scelta in ISO, o null se lasciata vuota
      // intenzionalmente (es. account interni/di staff).
      subscription_expires_at: profileForm.subscription_expires_at
        ? new Date(profileForm.subscription_expires_at).toISOString()
        : null
    })
    if (result.success) {
      notify('✅ Profilo aggiornato con successo!')
      setProfileEditUser(null)
      await loadUsers(true)
    } else {
      notify('❌ Errore: ' + (result.error || 'Impossibile aggiornare'))
    }
    setSavingProfile(false)
  }

    // ✅ IMPERSONIFICAZIONE: stessa scheda + link di ripristino admin
  const handleImpersonate = async (user: AdminUserRow) => {
    if (!(await askConfirm(`Vuoi impersonare ${user.first_name} ${user.last_name}?\n\nVerrai loggato come questo utente.\nPotrai tornare al tuo account admin in qualsiasi momento con il pulsante "Torna Admin" della fascia arancione.

L'accesso viene registrato.`))) return

    setImpersonatingId(user.id)
    try {
      const result = await impersonateUser(user.id)

      if (result.success && result.targetUrl && result.adminRestoreUrl) {
        // Link per tornare admin e nome, solo nella memoria di questa scheda
        startImpersonation(result.adminRestoreUrl, userName.split(' ')[0] || userName)

        // ✅ Naviga al magic link dell'utente target (stessa scheda)
        window.location.href = result.targetUrl
      } else {
        notify('Errore: ' + (result.error || 'Impossibile impersonificare'))
        setImpersonatingId(null)
      }
    } catch (err) {
      notify('Errore: ' + ((err instanceof Error && err.message) || 'Errore sconosciuto'))
      setImpersonatingId(null)
    }
  }

  // Menu a gruppi: ogni voce appartiene a un gruppo (vedi MENU_GROUPS)
  const menuItems = [
  { id: 'platforms', label: 'Piattaforme collegate', Icon: PlugZap, permission: 'stats.read' as Permission, group: 'general' },
  { id: 'overview', label: 'Panoramica', Icon: LayoutDashboard, permission: 'stats.read' as Permission, group: 'general' },
  { id: 'financials', label: 'Amministrazione', Icon: PiggyBank, permission: 'stats.read' as Permission, group: 'general' },
  { id: 'costs', label: 'Costi e margini', Icon: Calculator, permission: 'stats.read' as Permission, group: 'general' },
  { id: 'reports', label: 'Statistiche e classifiche', Icon: BarChart3, permission: 'stats.read' as Permission, group: 'general' },
  { id: 'marketplace', label: 'Strumenti e interruttori', Icon: ShoppingBag, permission: 'marketplace.read' as Permission, group: 'general' },
  { id: 'settings', label: 'Impostazioni', Icon: Settings, permission: 'settings.read' as Permission, group: 'general' },
  { id: 'languages', label: 'Lingue del sito', Icon: Globe2, permission: 'settings.read' as Permission, group: 'general' },
  { id: 'homeLayout', label: 'Aspetto homepage', Icon: Palette, permission: 'settings.read' as Permission, group: 'general' },
  { id: 'donations', label: 'Donazioni', Icon: HeartHandshake, permission: 'settings.read' as Permission, group: 'general' },
  { id: 'users', label: 'Utenti', Icon: Users, permission: 'users.read' as Permission, group: 'users' },
  { id: 'matrix', label: 'Matrice', Icon: GitBranch, permission: 'matrix.read' as Permission, group: 'users' },
  { id: 'identity', label: 'Verifica identità', Icon: ScanFace, permission: 'users.read' as Permission, group: 'users' },
  { id: 'profileRequests', label: 'Richieste dati', Icon: UserPen, permission: 'users.read' as Permission, group: 'users' },
  { id: 'accountDeletions', label: 'Cancellazione account', Icon: UserX, permission: 'users.read' as Permission, group: 'users' },
  { id: 'withdrawals', label: 'Recessi', Icon: Undo2, permission: 'users.write' as Permission, group: 'users' },
  { id: 'translators', label: 'Traduttori', Icon: Languages, permission: 'users.write' as Permission, group: 'users' },
  { id: 'agents', label: 'Agenti', Icon: BriefcaseBusiness, permission: 'users.write' as Permission, group: 'users' },
  { id: 'messages', label: 'Messaggi agli utenti', Icon: MessageSquare, permission: 'messages.read' as Permission, group: 'comms' },
  { id: 'contactMessages', label: 'Messaggi dal sito', Icon: Inbox, permission: 'support.read' as Permission, group: 'comms' },
  { id: 'emailSetup', label: 'Gestione Email', Icon: Mail, permission: 'settings.read' as Permission, group: 'comms' },
  { id: 'emailSend', label: 'Invio Email', Icon: Send, permission: 'support.write' as Permission, group: 'comms' },
  { id: 'push', label: 'Notifiche push', Icon: BellRing, permission: 'messages.read' as Permission, group: 'comms' },
  { id: 'documents', label: 'Documenti KUMANI', Icon: FileText, permission: 'settings.read' as Permission, group: 'comms' },
  { id: 'kuManagement', label: 'Gestione KU', Icon: Coins, permission: 'settings.read' as Permission, group: 'rewards' },
  { id: 'qualified', label: 'Qualificati', Icon: Crown, permission: 'users.read' as Permission, group: 'rewards' },
  { id: 'rewards', label: 'Premi', Icon: Gift, permission: 'rewards.read' as Permission, group: 'rewards' },
  { id: 'vouchers', label: 'Voucher', Icon: BadgeCheck, permission: 'vouchers.read' as Permission, group: 'rewards' },
  { id: 'coupons', label: 'Voucher e coupon', Icon: Ticket, permission: 'coupons.read' as Permission, group: 'rewards' },
  { id: 'listingReports', label: 'Bacheca', Icon: Flag, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'spotlight', label: 'Kumano del Giorno', Icon: Star, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'landingPages', label: 'Landing Page', Icon: PanelsTopLeft, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'reviews', label: 'Recensioni', Icon: MessageSquareQuote, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'events', label: 'Eventi', Icon: CalendarDays, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'timebank', label: 'Time Bank', Icon: Hourglass, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'affinity', label: 'Affinity', Icon: Flag, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'convivio', label: 'Segnalazioni', Icon: Flag, permission: 'listings.read' as Permission, group: 'kordata' },
  { id: 'convivioFees', label: 'Commissioni', Icon: HandCoins, permission: 'listings.read' as Permission, group: 'kordata' },
  { id: 'convivioShowcase', label: 'Vetrina homepage', Icon: Megaphone, permission: 'listings.read' as Permission, group: 'kordata' },
  { id: 'mosaic', label: 'Mosaic', Icon: Grid3x3, permission: 'listings.read' as Permission, group: 'games' },
  { id: 'fabula', label: 'Fabula', Icon: Dices, permission: 'listings.read' as Permission, group: 'games' },
]

  const availableMenuItems = menuItems.filter(item => hasPermission(permissions, item.permission))

  // Gruppi con almeno una voce consentita dal ruolo. Si apre un gruppo alla
  // volta (aprendone uno gli altri si chiudono) e ognuno si può chiudere,
  // anche quello della sezione in cui ci si trova.
  const menuGroups = MENU_GROUPS.map((group) => ({
    ...group,
    items: availableMenuItems.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0)
  const activeGroup = availableMenuItems.find((item) => item.id === activeSection)?.group
  const pendingItems = availableMenuItems.filter((item) => (badges[item.id] ?? 0) > 0)
  const currentOpenGroup = openGroup === undefined ? activeGroup : openGroup
  const toggleGroup = (groupId: string) => {
    setOpenGroup(currentOpenGroup === groupId ? null : groupId)
  }

  const renderMenuButton = (item: (typeof availableMenuItems)[number]) => {
    const count = badges[item.id] ?? 0
    return (
      <button
        key={item.id}
        onClick={() => {
          setActiveSection(item.id)
          // Anche da "Da gestire": si apre il gruppo della voce scelta
          setOpenGroup(item.group)
        }}
        title={count > 0 ? `${item.label}: ${count} ${count === 1 ? 'elemento' : 'elementi'} da vedere o gestire` : undefined}
        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
          activeSection === item.id ? 'bg-[var(--ink)] text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'
        }`}
      >
        <item.Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
        {count > 0 && (
          <span className="shrink-0 rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            <span className="sr-only">Da gestire: </span>
            {badgeLabel(count)}
          </span>
        )}
      </button>
    )
  }

  // ?section= inesistente o non consentito dal ruolo: prima voce disponibile.
  // Si corregge subito, mentre si disegna la pagina (non dopo con un
  // effetto); solo se il valore cambia davvero, così non si ripete.
  const fallbackSection = availableMenuItems[0]?.id ?? 'overview'
  if (activeSection !== fallbackSection && !availableMenuItems.some((item) => item.id === activeSection)) {
    setActiveSection(fallbackSection)
  }

  const renderOverview = () => <AdminOverviewPanel userName={userName} onlineUsers={onlineUsers} />

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="w-7 h-7" />
          Gestione Utenti
        </h2>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Cerca per nome, email o codice..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
          <Users className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        </div>
      </div>
      
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loadingUsers ? (
          <div className="p-8 text-center text-gray-500">Caricamento...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nessun utente trovato.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Utente</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Codice</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Stato</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${user.is_blocked ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{user.first_name} {user.last_name}</div>
                      {user.is_blocked && <span className="text-xs text-red-600 font-semibold flex items-center gap-1"><Lock className="w-3 h-3" /> BLOCCATO</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm font-mono text-[var(--gold)]">{user.referral_code}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.subscription_status === 'active' && !user.is_blocked ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.is_blocked ? 'Bloccato' : (user.subscription_status === 'active' ? 'Attivo' : 'Free')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => openProfileEdit(user)} className="text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1">
                        <Pencil className="w-4 h-4" /> Modifica
                      </button>
                      <button onClick={() => handleImpersonate(user)} disabled={impersonatingId === user.id} className="text-[var(--gold)] hover:text-[var(--ink)] text-sm font-medium inline-flex items-center gap-1 disabled:opacity-50">
                        <UserCog className="w-4 h-4" /> {impersonatingId === user.id ? '...' : 'Impersonifica'}
                      </button>
                      <button onClick={() => viewUserMatrix(user)} className="text-[var(--gold)] hover:text-[var(--ink)] text-sm font-medium inline-flex items-center gap-1">
                        <Eye className="w-4 h-4" /> Matrice
                      </button>
                      <button onClick={() => handleToggleBlock(user)} className={`text-sm font-medium inline-flex items-center gap-1 ${user.is_blocked ? 'text-green-600' : 'text-red-600'}`}>
                        {user.is_blocked ? <><Lock className="w-4 h-4" /> Sblocca</> : <><Lock className="w-4 h-4" /> Blocca</>}
                      </button>
                      <button onClick={() => openManageModal(user)} className="text-[var(--gold)] hover:text-[var(--ink)] text-sm font-medium">Gestisci</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )

  const renderMatrix = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <GitBranch className="w-7 h-7" />
        Visualizzatore Matrice
      </h2>
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <label className="block text-sm font-medium text-gray-700 mb-2">Cerca un utente:</label>
        <AdminUserPicker
          scope="matrix"
          selected={matrixPickedUser}
          onSelect={(user) => {
            setMatrixPickedUser(user)
            loadMatrixForUser(user?.id ?? '')
          }}
        />
      </div>

      {loadingMatrix ? (
        <div className="bg-white p-12 rounded-xl border text-center text-gray-500">⏳ Caricamento...</div>
      ) : !matrixData ? (
        <div className="bg-white p-12 rounded-xl border text-center text-gray-500">
          <GitBranch className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p>Seleziona un utente per visualizzare la sua matrice</p>
        </div>
      ) : (
        <>
          <div className="bg-[var(--ink)] rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-white/80 text-sm">Matrice di</p>
                <h3 className="text-2xl font-bold">{matrixData.first_name} {matrixData.last_name}</h3>
                <p className="text-white/80 text-sm mt-1">Codice: <span className="font-mono font-bold text-white">{matrixData.referral_code}</span></p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500 uppercase">Totale</div><div className="text-2xl font-bold text-[var(--gold)]">{matrixStats.total}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500 uppercase">Livello 1</div><div className="text-2xl font-bold text-green-600">{matrixStats.level1}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500 uppercase">Livello 2</div><div className="text-2xl font-bold text-blue-600">{matrixStats.level2}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500 uppercase">Livello 3</div><div className="text-2xl font-bold text-[var(--gold)]">{matrixStats.level3}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500 uppercase">Livello 4</div><div className="text-2xl font-bold text-orange-600">{matrixStats.level4}</div></div>
            <div className="bg-white p-4 rounded-xl border text-center"><div className="text-xs text-gray-500 uppercase">Livello 5</div><div className="text-2xl font-bold text-red-600">{matrixStats.level5}</div></div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Albero Matrice 5xN</h3>
            {matrixDescendants.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <GitBranch className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                <p>Questa matrice è vuota</p>
              </div>
            ) : (
              <MatrixTree key={matrixData.id} rootNode={matrixData} descendants={matrixDescendants} mode="admin" />
            )}
          </div>
        </>
      )}
    </div>
  )

  const renderMarketplace = () => {
    const filteredTools = marketplaceUsage.filter((tool) => tool.tool_name !== 'nfc-smart-hub')
    // Raggruppati per categoria, come nel Marketplace; le sezioni della
    // piattaforma (Bacheca, chat, Kordata...) vanno in Community
    const toolGroups = TOOL_GROUPS.map((group) => ({
      ...group,
      tools: filteredTools.filter((tool: { tool_name: string }) => toolCategoryOf(tool.tool_name) === group.id),
    })).filter((group) => group.tools.length > 0)

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7" />
            Strumenti e interruttori
          </h2>
          <p className="text-gray-600 mt-1">
            Abilita o disabilita gli strumenti e scegli per ognuno il piano richiesto: <strong>Gratis</strong> (tutti gli
            iscritti), <strong>Base</strong> (abbonamento 49 €/anno) o <strong>Pro</strong> (149 €/anno, include il Base).
            La scelta vale subito ovunque, anche per gli strumenti che verranno aggiunti.
          </p>
        </div>

        {toolGroups.map((group) => {
          const isOpen = openToolGroups.has(group.id)
          const activeCount = group.tools.filter((tool: { is_enabled: boolean }) => tool.is_enabled).length
          return (
          <section key={group.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() =>
                setOpenToolGroups((prev) => {
                  const next = new Set(prev)
                  if (next.has(group.id)) next.delete(group.id)
                  else next.add(group.id)
                  return next
                })
              }
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-gray-50"
            >
              <span className="text-lg font-bold text-gray-900">{group.label}</span>
              <span className="flex items-center gap-3">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${activeCount === group.tools.length ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                  {activeCount}/{group.tools.length} attivi
                </span>
                <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>
            {isOpen && (
            <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-gray-50/60 p-4 md:grid-cols-2">
              {group.tools.map((tool) => (
                <div key={tool.tool_name} className={`bg-white p-6 rounded-xl border shadow-sm ${!tool.is_enabled ? 'opacity-60 bg-gray-50' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 capitalize">{tool.tool_name.replace(/-/g, ' ')}</h3>
                      <p className="text-sm text-gray-500 mt-1">{tool.description || 'Strumento del marketplace'}</p>
                    </div>
                    <button
                      onClick={() => toggleToolEnabled(tool.tool_name, tool.is_enabled)}
                      disabled={savingTool === tool.tool_name}
                      className="focus:outline-none"
                    >
                      {tool.is_enabled ? (
                        <ToggleRight className="w-14 h-8 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-14 h-8 text-gray-400" />
                      )}
                    </button>
                  </div>
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase">Piano richiesto</span>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      {(['free', 'base', 'pro'] as const).map((plan) => {
                        const active = (tool.required_plan ?? 'base') === plan
                        return (
                          <button
                            key={plan}
                            type="button"
                            onClick={() => !active && changeToolPlan(tool.tool_name, plan)}
                            disabled={savingTool === tool.tool_name}
                            className={`px-3 py-1 text-xs font-semibold ${
                              active
                                ? plan === 'pro'
                                  ? 'bg-[var(--ink)] text-[var(--gold-bright)]'
                                  : 'bg-gray-800 text-white'
                                : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {plan === 'free' ? 'Gratis' : plan === 'base' ? 'Base' : 'Pro'}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {(tool.required_plan ?? 'base') !== 'free' && (
                    <ToolPassSetting
                      toolName={tool.tool_name}
                      enabled={!!tool.pass_enabled}
                      priceCents={tool.pass_price_cents ?? 1000}
                      kuPoints={tool.pass_ku_points ?? 0}
                      onSaved={loadMarketplaceData}
                    />
                  )}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Utilizzi Totali</div>
                      <div className="text-2xl font-bold text-[var(--gold)]">{tool.usage_count}</div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold ${tool.is_enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {tool.is_enabled ? 'ATTIVO' : 'DISATTIVO'}
                    </div>
                  </div>
                  {savingTool === tool.tool_name && (
                    <div className="mt-3 text-xs text-[var(--gold)]">💾 Salvataggio...</div>
                  )}
                </div>
              ))}
            </div>
            )}
          </section>
          )
        })}
      </div>
    )
  }

  const renderListingReports = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Flag className="w-7 h-7" />
            Bacheca — Annunci segnalati
          </h2>
          <p className="text-gray-600 mt-1">
            Annunci del marketplace segnalati dai Kumani perché non in linea con le regole. Puoi ignorare la
            segnalazione o eliminare direttamente l’annuncio.
          </p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Annuncio</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Proprietario</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Segnalato da</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Motivo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Data</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingListingReports ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : listingReports.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessuna segnalazione al momento</td></tr>
              ) : (
                listingReports.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 align-top">
                    <td className="px-4 py-3">
                      {r.listings ? (
                        <>
                          <div className="font-medium text-gray-900">{r.listings.title}</div>
                          <div className="text-xs text-gray-500 line-clamp-2 max-w-xs">{r.listings.description}</div>
                          {r.listings.price != null && (
                            <div className="text-xs text-green-600 font-semibold mt-0.5">{'€'}{r.listings.price}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Annuncio già eliminato</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {/* Dati completi (nome + cognome + email) del proprietario, a differenza
                          della card pubblica che mostra solo il nome per privacy — qui servono
                          per identificare con certezza chi bannare. */}
                      {r.owner ? (
                        <>
                          {r.owner.first_name} {r.owner.last_name}
                          <div className="text-xs text-gray-400">{r.owner.email}</div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.reporter?.first_name} {r.reporter?.last_name}
                      <div className="text-xs text-gray-400">{r.reporter?.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">{r.reason || <span className="text-gray-400 italic">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(r.created_at).toLocaleDateString('it-IT')}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDismissReport(r.id)}
                        className="text-gray-500 hover:text-gray-700 text-xs font-medium mr-3"
                      >
                        Ignora
                      </button>
                      {r.listings && (
                        <button
                          onClick={() => handleDeleteReportedListing(r.listing_id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Elimina annuncio
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderSpotlight = () => {
    const statusBadge: Record<string, { label: string; className: string }> = {
      pending: { label: 'Da revisionare', className: 'bg-yellow-100 text-yellow-800' },
      approved: { label: 'Approvata', className: 'bg-green-100 text-green-700' },
      rejected: { label: 'Rifiutata', className: 'bg-red-100 text-red-700' },
    }
    const pendingCount = spotlightProfiles.filter((p) => p.moderation_status === 'pending').length
    const homePool = spotlightProfiles.filter((p) => p.moderation_status === 'approved' && p.is_opted_in && p.show_on_home).length

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star className="w-7 h-7" />
            Kumano del Giorno — Moderazione storie
          </h2>
          <p className="text-gray-600 mt-1">
            Solo le storie approvate entrano in rotazione (dashboard, vetrina pubblica e home). Ogni modifica del
            testo la rimette in coda. In home compaiono solo con il consenso “home” e quando il pool raggiunge la
            soglia minima ({SPOTLIGHT_HOME_MIN_POOL}).
          </p>
          <p className="text-sm text-gray-500 mt-2">
            In coda: <strong>{pendingCount}</strong> · Pool home (approvate + consenso home): <strong>{homePool}</strong>
          </p>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Storia</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Utente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Consensi</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingSpotlight ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : spotlightProfiles.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nessuna storia inviata</td></tr>
              ) : (
                spotlightProfiles.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 max-w-md">
                      <div className="font-medium text-gray-900">
                        {p.display_name}
                        {p.story_locale && <span className="ml-2 text-xs text-gray-400 uppercase">{p.story_locale}</span>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {[p.profession, [p.city, p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
                      </div>
                      <div className="text-sm text-gray-700 mt-1 whitespace-pre-line">{p.story}</div>
                      <div className="text-xs text-gray-400 mt-1">Aggiornata il {new Date(p.updated_at).toLocaleDateString('it-IT')}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {p.owner ? (
                        <>
                          {p.owner.first_name} {p.owner.last_name}
                          <div className="text-xs text-gray-400">{p.owner.email}</div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                      <div>Community: {p.is_opted_in ? 'sì' : 'no'}</div>
                      <div>Home: {p.show_on_home ? 'sì' : 'no'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[p.moderation_status]?.className ?? ''}`}>
                        {statusBadge[p.moderation_status]?.label ?? p.moderation_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {p.moderation_status !== 'approved' && (
                        <button
                          onClick={() => handleModerateSpotlight(p.id, 'approved')}
                          className="text-green-600 hover:text-green-800 text-xs font-medium mr-3"
                        >
                          Approva
                        </button>
                      )}
                      {p.moderation_status !== 'rejected' && (
                        <button
                          onClick={() => handleModerateSpotlight(p.id, 'rejected')}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Rifiuta
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Area "Voucher per negozianti": lotti di codici di attivazione venduti a
  // un'attività (vedi createVoucherBatch). Sta nella voce "Voucher e coupon",
  // separata dai coupon (buoni generici) assegnati agli utenti.
  const renderMerchantCoupons = () => (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">Voucher per negozianti</h3>
        <p className="text-sm text-gray-600 mt-1">
          Genera un lotto di codici di attivazione da vendere a un&apos;attività (es. 10 voucher a 400 €), che li regala ai
          propri clienti. Ogni codice attiva 1 anno di abbonamento, vale una sola volta e si può inserire già in
          registrazione: il QR stampato sul cartoncino apre la registrazione con il codice compilato. Gli abbonamenti
          attivati con voucher non si rinnovano da soli e non generano KU Points a chi invita.
          Scegli il piano del lotto: <strong>Base</strong> oppure <strong>Pro</strong> (per negozi e professionisti:
          attiva 1 anno di Pro, che include anche il Base).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase">Piano del lotto</span>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['base', 'pro'] as const).map((plan) => (
            <button
              key={plan}
              type="button"
              onClick={() => setBatchForm({ ...batchForm, plan })}
              className={`px-4 py-1.5 text-xs font-semibold ${
                batchForm.plan === plan
                  ? plan === 'pro'
                    ? 'bg-[var(--ink)] text-[var(--gold-bright)]'
                    : 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {plan === 'pro' ? 'Pro' : 'Base'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          placeholder="Nome attività *"
          value={batchForm.businessName}
          onChange={(e) => setBatchForm({ ...batchForm, businessName: e.target.value })}
          className="p-2.5 border border-gray-300 rounded-lg text-sm lg:col-span-2"
        />
        <input
          type="number"
          min={1}
          max={500}
          placeholder="Quantità"
          value={batchForm.quantity}
          onChange={(e) => setBatchForm({ ...batchForm, quantity: e.target.value })}
          className="p-2.5 border border-gray-300 rounded-lg text-sm"
        />
        <input
          placeholder="Prezzo totale €"
          value={batchForm.priceEur}
          onChange={(e) => setBatchForm({ ...batchForm, priceEur: e.target.value })}
          className="p-2.5 border border-gray-300 rounded-lg text-sm"
        />
        <input
          placeholder="N. fattura"
          value={batchForm.invoiceRef}
          onChange={(e) => setBatchForm({ ...batchForm, invoiceRef: e.target.value })}
          className="p-2.5 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          placeholder="Note (facoltative)"
          value={batchForm.notes}
          onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
          className="flex-1 p-2.5 border border-gray-300 rounded-lg text-sm"
        />
        <button
          type="button"
          onClick={handleCreateBatch}
          disabled={creatingBatch || !batchForm.businessName.trim()}
          className="px-4 py-2.5 rounded-lg bg-[var(--ink)] text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
        >
          {creatingBatch ? 'Generazione...' : 'Genera lotto e stampa'}
        </button>
      </div>

      {voucherBatches.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-3 font-medium">Attività</th>
                <th className="py-2 pr-3 font-medium">Piano</th>
                <th className="py-2 pr-3 font-medium">Usati</th>
                <th className="py-2 pr-3 font-medium">Prezzo</th>
                <th className="py-2 pr-3 font-medium">Fattura</th>
                <th className="py-2 pr-3 font-medium">Creato il</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {voucherBatches.map((b) => (
                <tr key={b.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 text-gray-900">
                    {b.business_name}
                    {b.notes && <span className="block text-xs text-gray-400">{b.notes}</span>}
                  </td>
                  <td className="py-2 pr-3">
                    {b.plan === 'pro' ? (
                      <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-[var(--gold-bright)]">PRO</span>
                    ) : (
                      <span className="text-xs text-gray-600">Base</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-gray-700">{b.redeemed}/{b.quantity}</td>
                  <td className="py-2 pr-3 text-gray-700">{b.price_eur != null ? `${Number(b.price_eur).toFixed(2)} €` : '—'}</td>
                  <td className="py-2 pr-3 text-gray-700">{b.invoice_ref || '—'}</td>
                  <td className="py-2 pr-3 text-gray-500">{new Date(b.created_at).toLocaleDateString('it-IT')}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <a
                      href={`/${locale}/admin/voucher-batch/${b.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[var(--ink)] hover:text-[var(--gold)] mr-3"
                    >
                      Stampa voucher (PDF)
                    </a>
                    <button type="button" onClick={() => downloadBatchCsv(b)} className="text-xs font-semibold text-gray-700">
                      Scarica CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )

  const renderCoupons = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Ticket className="w-7 h-7" />
          Voucher e coupon
        </h2>
        <p className="text-gray-600 mt-1">Due aree distinte. Voucher = codice che attiva un abbonamento (qui: i lotti venduti ai negozianti). Coupon = buono generico (premio, sconto di un partner) assegnato a un utente, che non attiva abbonamenti.</p>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {([
          ['merchant', '🏪 Voucher per negozianti'],
          ['community', '👥 Coupon per la community'],
          ['pass', '🎟️ Pass servizio'],
          ['gifts', '🎁 Regali'],
          ['trials', '⏱️ Codici prova'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setCouponArea(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              couponArea === key ? 'border-[var(--gold)] text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {couponArea === 'merchant' ? renderMerchantCoupons() : couponArea === 'pass' ? <PassCodesPanel /> : couponArea === 'gifts' ? <GiftOrdersPanel /> : couponArea === 'trials' ? <TrialCodesManager admin siteUrl={SITE_URL} /> : renderCommunityCoupons()}
    </div>
  )

  const renderCommunityCoupons = () => {
    const now = new Date()
    const statusOf = (c: AdminCouponRow) => {
      if (c.redeemed_at) return { label: 'Utilizzato', className: 'bg-gray-100 text-gray-600' }
      if (c.expires_at && new Date(c.expires_at) < now) return { label: 'Scaduto', className: 'bg-red-100 text-red-700' }
      return { label: 'Disponibile', className: 'bg-green-100 text-green-700' }
    }

    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900">Nuovo coupon</h3>
          {couponError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{couponError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Utente</label>
              <AdminUserPicker
                scope="coupons"
                selected={couponPickedUser}
                onSelect={(user) => {
                  setCouponPickedUser(user)
                  setCouponForm({ ...couponForm, userId: user?.id ?? '' })
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scadenza (opzionale)</label>
              <input
                type="date"
                value={couponForm.expiresAt}
                onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Titolo</label>
              <input
                type="text"
                placeholder="Es. Spedizione gratuita"
                value={couponForm.title}
                onChange={(e) => setCouponForm({ ...couponForm, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione (opzionale)</label>
              <textarea
                placeholder="Es. Valido su uno strumento dell'Ecosistema"
                value={couponForm.description}
                onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none h-20"
              />
            </div>
          </div>
          <button
            onClick={handleCreateCoupon}
            disabled={savingCoupon}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
          >
            <Ticket className="w-4 h-4" />
            {savingCoupon ? 'Creazione...' : 'Crea e assegna coupon'}
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Titolo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Utente</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Codice</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Scadenza</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingCoupons ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun coupon emesso ancora</td></tr>
              ) : (
                coupons.map((c) => {
                  const status = statusOf(c)
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.title}</div>
                        {c.description && <div className="text-xs text-gray-500">{c.description}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.profiles?.first_name} {c.profiles?.last_name}
                        <div className="text-xs text-gray-400">{c.profiles?.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.code}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString('it-IT') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevokeCoupon(c.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Revoca coupon"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderManageModal = () => {
    if (!isModalOpen || !selectedUser) return null
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Gestisci Utente</h3>
              <p className="text-sm text-gray-500">{selectedUser.email}</p>
            </div>
            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo Amministrativo</label>
              <select value={userCurrentRoleId} onChange={(e) => setUserCurrentRoleId(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                <option value="none">Nessuno (Utente Standard)</option>
                {availableRoles.map(role => (
                  <option key={role.id} value={role.id}>{role.name.replace('_', ' ').toUpperCase()}</option>
                ))}
              </select>
            </div>
            {hasPermission(permissions, 'users.write') && <AdminLateSponsor userId={selectedUser.id} />}
            {hasPermission(permissions, 'users.write') && <AdminPasswordReset userId={selectedUser.id} />}
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium" disabled={isSaving}>Annulla</button>
            <button onClick={handleSaveUserManagement} className="px-4 py-2 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] font-medium flex items-center gap-2" disabled={isSaving}>
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderProfileEditModal = () => {
    if (!profileEditUser) return null
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setProfileEditUser(null)}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white border-b border-gray-200 p-5 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-900">Modifica Profilo</h3>
              <p className="text-xs text-gray-500">{profileEditUser.email}</p>
            </div>
            <button onClick={() => setProfileEditUser(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input type="text" value={profileForm.first_name || ''} onChange={(e) => setProfileForm({...profileForm, first_name: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
              <input type="text" value={profileForm.last_name || ''} onChange={(e) => setProfileForm({...profileForm, last_name: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" value={profileForm.username || ''} onChange={(e) => setProfileForm({...profileForm, username: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Referral Code</label>
              <input type="text" value={profileForm.referral_code || ''} onChange={(e) => setProfileForm({...profileForm, referral_code: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input type="tel" value={profileForm.phone || ''} onChange={(e) => setProfileForm({...profileForm, phone: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Paese</label>
              <input type="text" value={profileForm.country_code || ''} onChange={(e) => setProfileForm({...profileForm, country_code: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Data di nascita</label>
              <input type="date" value={profileForm.date_of_birth || ''} onChange={(e) => setProfileForm({...profileForm, date_of_birth: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Occupazione</label>
              <input type="text" value={profileForm.occupation || ''} onChange={(e) => setProfileForm({...profileForm, occupation: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Punti giornalieri</label>
              <input type="number" value={profileForm.daily_points || 0} onChange={(e) => setProfileForm({...profileForm, daily_points: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Abbonamento</label>
              <select
                value={profileForm.subscription_status || 'free'}
                onChange={(e) => {
                  const newStatus = e.target.value
                  // Passando ad "Active" senza una scadenza già impostata,
                  // suggerisce +1 anno da oggi (stessa durata del pagamento
                  // reale via Stripe) invece di lasciare l'abbonamento
                  // attivo a vita per errore — l'admin può comunque
                  // cancellare la data se vuole davvero nessuna scadenza.
                  const shouldSuggestExpiry = newStatus === 'active' && !profileForm.subscription_expires_at
                  const suggested = new Date()
                  suggested.setFullYear(suggested.getFullYear() + 1)
                  setProfileForm({
                    ...profileForm,
                    subscription_status: newStatus,
                    subscription_expires_at: shouldSuggestExpiry
                      ? suggested.toISOString().slice(0, 10)
                      : profileForm.subscription_expires_at
                  })
                }}
                className="w-full p-2 border rounded-lg"
              >
                <option value="free">Free</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Piano</label>
              <select
                value={profileForm.subscription_plan || 'base'}
                onChange={(e) => setProfileForm({ ...profileForm, subscription_plan: e.target.value })}
                className="w-full p-2 border rounded-lg"
              >
                <option value="base">Base</option>
                <option value="pro">Pro</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Vale quando l&apos;abbonamento è attivo (strumenti Base o anche Pro)</p>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Scadenza abbonamento</label>
              <input
                type="date"
                value={profileForm.subscription_expires_at || ''}
                onChange={(e) => setProfileForm({...profileForm, subscription_expires_at: e.target.value})}
                className="w-full p-2 border rounded-lg"
              />
              <p className="text-xs text-gray-400 mt-1">Vuoto = nessuna scadenza (resta attivo per sempre)</p>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="is_admin" checked={profileForm.is_admin || false} onChange={(e) => setProfileForm({...profileForm, is_admin: e.target.checked})} className="w-4 h-4" />
              <label htmlFor="is_admin" className="text-sm font-medium text-gray-700">Amministratore</label>
            </div>
          </div>

          <div className="flex gap-3 justify-end p-6 border-t border-gray-200">
            <button onClick={() => setProfileEditUser(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium" disabled={savingProfile}>Annulla</button>
            <button onClick={handleSaveProfile} className="px-4 py-2 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] font-medium flex items-center gap-2" disabled={savingProfile}>
              <Save className="w-4 h-4" />
              {savingProfile ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <AdminToaster />
      <div className="lg:col-span-1">
        {/* Telefono: il menu è una tendina, divisa per gruppi */}
        <label className="block lg:hidden">
          <span className="sr-only">Sezione</span>
          <select
            value={activeSection}
            onChange={(e) => setActiveSection(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          >
            {menuGroups.map((group) => (
              <optgroup key={group.id} label={group.label}>
                {group.items.map((item) => {
                  const count = badges[item.id] ?? 0
                  return (
                    <option key={item.id} value={item.id}>
                      {item.label}
                      {count > 0 ? ` (${badgeLabel(count)} da gestire)` : ''}
                    </option>
                  )
                })}
              </optgroup>
            ))}
          </select>
        </label>

        <nav className="sticky top-4 hidden max-h-[calc(100vh-2rem)] space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:block">
          {/* Da gestire: solo le sezioni con qualcosa in attesa */}
          {pendingItems.length > 0 && (
            <div className="rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-2">
              <p className="mb-1 flex items-center gap-1.5 px-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink)]">
                <BellRing className="h-3.5 w-3.5 text-[var(--gold)]" /> Da gestire
              </p>
              {pendingItems.map((item) => renderMenuButton(item))}
            </div>
          )}

          {menuGroups.map((group) => {
            const isOpen = currentOpenGroup === group.id
            // Gruppo in cui ci si trova (quello aperto; se sono tutti chiusi,
            // quello della sezione mostrata): titolo in oro su una banda, e
            // una linea oro accanto alle sue voci
            const isCurrent = (currentOpenGroup ?? activeGroup) === group.id
            const groupCount = group.items.reduce((sum, item) => sum + (badges[item.id] ?? 0), 0)
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide ${
                    isCurrent
                      ? 'border-l-4 border-[var(--gold)] bg-[var(--gold-pale)]/50 text-[var(--gold)] hover:bg-[var(--gold-pale)]/80'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-1.5">
                    {!isOpen && groupCount > 0 && (
                      <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{badgeLabel(groupCount)}</span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {isOpen && (
                  <div className={`mt-1 space-y-0.5 ${isCurrent ? 'ml-1 border-l-2 border-[var(--gold)]/60 pl-1.5' : ''}`}>{group.items.map((item) => renderMenuButton(item))}</div>
                )}
              </div>
            )
          })}
        </nav>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {activeSection === 'platforms' && <PlatformsPanel />}
        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'users' && renderUsers()}
        {activeSection === 'profileRequests' && <ProfileRequestsPanel onChanged={loadBadges} />}
        {activeSection === 'accountDeletions' && <AccountDeletionsPanel onChanged={loadBadges} canDelete={hasPermission(permissions, 'users.delete')} />}
        {activeSection === 'translators' && <TranslatorsPanel />}
        {activeSection === 'agents' && <AgentsPanel />}
        {activeSection === 'withdrawals' && <WithdrawalsPanel onChanged={loadBadges} />}
        {activeSection === 'donations' && <DonationsPanel />}
        {activeSection === 'homeLayout' && <HomeLayoutPanel />}
        {activeSection === 'reports' && <ReportsPanel initialTab={reportTab} />}
        {activeSection === 'languages' && <LanguagesPanel canWrite={hasPermission(permissions, 'settings.write')} />}
        {activeSection === 'matrix' && renderMatrix()}
        {activeSection === 'marketplace' && renderMarketplace()}
        {activeSection === 'coupons' && renderCoupons()}
        {activeSection === 'vouchers' && <AdminVouchersPanel />}
        {activeSection === 'rewards' && <AdminRewardsPanel loadBadges={loadBadges} />}
        {activeSection === 'messages' && <AdminMessagesPanel />}
        {activeSection === 'financials' && <AdminFinancialsPanel openReport={openReport} />}
        {activeSection === 'costs' && <CostsPanel />}
        {activeSection === 'listingReports' && renderListingReports()}
        {activeSection === 'spotlight' && renderSpotlight()}
        {activeSection === 'kuManagement' && <KuManagementPanel />}
        {activeSection === 'affinity' && <AffinityReportsPanel />}
        {activeSection === 'landingPages' && <LandingPagesPanel />}
        {activeSection === 'reviews' && <ReviewsPanel />}
        {activeSection === 'qualified' && <QualifiedMembersPanel />}
        {activeSection === 'convivio' && <ConvivioReportsPanel locale={locale} />}
        {activeSection === 'events' && (
          <EventsAdminPanel
            locale={locale}
            canReadSettings={hasPermission(permissions, 'settings.read')}
            canWrite={hasPermission(permissions, 'listings.write')}
          />
        )}
        {activeSection === 'identity' && <IdentityVerificationsPanel />}
        {activeSection === 'convivioShowcase' && <KordataShowcasePanel locale={locale} />}
        {activeSection === 'convivioFees' && <ConvivioFeesPanel locale={locale} canReadSettings={hasPermission(permissions, 'settings.read')} />}
        {activeSection === 'timebank' && <TimebankAdminPanel />}
        {activeSection === 'mosaic' && <MosaicAdminPanel />}
        {activeSection === 'fabula' && <FabulaAdminPanel />}
        {activeSection === 'contactMessages' && <ContactMessagesPanel />}
        {activeSection === 'emailSetup' && <EmailSetupPanel />}
        {activeSection === 'emailSend' && <EmailComposePanel />}
        {activeSection === 'push' && <PushPanel />}
        {activeSection === 'documents' && <DocumentsAdminPanel />}
        {activeSection === 'settings' && <AdminSettingsPanel />}
      </div>

      {renderManageModal()}
      {renderProfileEditModal()}
    </div>
  )
}