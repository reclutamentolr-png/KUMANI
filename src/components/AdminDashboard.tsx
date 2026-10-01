'use client'

import { notify } from '@/lib/adminNotify'
import AdminToaster from '@/components/admin/AdminToaster'
import { useState, useEffect, type ComponentProps } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, Permission } from '@/lib/admin-permissions'
import MatrixTree from '@/components/MatrixTree'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import AdminUserPicker from '@/components/admin/AdminUserPicker'
import {
  adminUpdateProfile,
  adminSaveSystemSettings,
  adminGetPlanPrices,
  adminSetToolEnabled,
  adminSetUserRole,
  adminGetUserRole,
  impersonateUser,
  createCoupon,
  listCoupons,
  revokeCoupon,
  listVouchers,
  revokeVoucher,
  createReward,
  updateReward,
  listRewards,
  deleteReward,
  listRewardRedemptions,
  fulfillRewardRedemption,
  createAdminVoucher,
  creditDailyPoints,
  listVoucherUsers,
  getAdminFinancialSummary,
  listListingReports,
  adminListUsers,
  updateToolPlan,
  createVoucherBatch,
  listVoucherBatches,
  getVoucherBatchCodes,
  uploadRewardImage,
  getHouseAccount,
  createHouseAccount,
  adminGetProfile,
  listSpotlightProfilesForModeration,
  moderateSpotlightProfile,
  dismissListingReport,
  deleteReportedListing,
  type StaffUserHit,
  adminGetUserMatrix,
  adminOverviewCounts,
} from '@/app/actions/admin'
import {
  createAdminMessage,
  listAdminMessages,
  toggleAdminMessageActive,
  deleteAdminMessage,
  listMessageableUsers,
} from '@/app/actions/adminMessages'
import type { LocalizedText, MessageType, AdminMessageRow } from '@/lib/adminMessages'
import type {
  AdminUserRow,
  AdminProfileDetail,
  AdminProfileForm,
  MarketplaceToolUsage,
  AdminCouponRow,
  AdminVoucherRow,
  AdminVoucherUser,
  AdminVoucherBatch,
  AdminRewardRow,
  AdminRewardRedemption,
  ListingReport,
  AdminSpotlightProfile,
  AdminHouseAccount,
  AdminSystemSettings,
} from '@/lib/adminTypes'
import { SPOTLIGHT_HOME_MIN_POOL } from '@/lib/spotlight'
import KuManagementPanel from '@/components/admin/KuManagementPanel'
import AffinityReportsPanel from '@/components/admin/AffinityReportsPanel'
import ConvivioReportsPanel from '@/components/admin/ConvivioReportsPanel'
import EventsAdminPanel from '@/components/admin/EventsAdminPanel'
import TimebankAdminPanel from '@/components/admin/TimebankAdminPanel'
import MosaicAdminPanel from '@/components/admin/MosaicAdminPanel'
import FabulaAdminPanel from '@/components/admin/FabulaAdminPanel'
import IdentityVerificationsPanel from '@/components/admin/IdentityVerificationsPanel'
import ConvivioFeesPanel from '@/components/admin/ConvivioFeesPanel'
import ContactMessagesPanel from '@/components/admin/ContactMessagesPanel'
import ProfileRequestsPanel from '@/components/admin/ProfileRequestsPanel'
import AccountDeletionsPanel from '@/components/admin/AccountDeletionsPanel'
import TranslatorsPanel from '@/components/admin/TranslatorsPanel'
import LanguagesPanel from '@/components/admin/LanguagesPanel'
import AgentsPanel from '@/components/admin/AgentsPanel'
import WithdrawalsPanel from '@/components/admin/WithdrawalsPanel'
import DonationsPanel from '@/components/admin/DonationsPanel'
import { startImpersonation } from '@/lib/impersonation'
import {
  LayoutDashboard,
  CalendarDays,
  Star,
  Coins,
  Users,
  GitBranch,
  ShoppingBag,
  Settings,
  UserCheck,
  Activity,
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
  Sparkles,
  PiggyBank,
  Flag,
  MessageSquare,
  Megaphone,
  Mail,
  Send,
  LoaderCircle,
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
} from 'lucide-react'

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
type MatrixNode = ComponentProps<typeof MatrixTree>['rootNode']

type AdminDashboardProps = {
  userId: string
  permissions: Permission[]
  userName: string
  locale: string // ✅ AGGIUNTO: necessario per costruire il redirect URL
  initialSection?: string // da ?section= nell'URL, vedi admin/page.tsx
}

export default function AdminDashboard({ permissions, userName, locale, initialSection }: AdminDashboardProps) {
  const [activeSection, setActiveSection] = useState(initialSection || 'overview')
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

  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, totalNodes: 0, blockedUsers: 0 })
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

  const [vouchers, setVouchers] = useState<AdminVoucherRow[]>([])
  const [loadingVouchers, setLoadingVouchers] = useState(false)
  const [voucherUsers, setVoucherUsers] = useState<AdminVoucherUser[]>([])
  const [generatingAdminVoucher, setGeneratingAdminVoucher] = useState(false)
  const [lastAdminVoucherCode, setLastAdminVoucherCode] = useState<string | null>(null)
  const [creditForm, setCreditForm] = useState({ userId: '', amount: '' })
  const [creditUserSearch, setCreditUserSearch] = useState('')
  const [creditingPoints, setCreditingPoints] = useState(false)
  const [creditError, setCreditError] = useState<string | null>(null)
  const [creditSuccess, setCreditSuccess] = useState<string | null>(null)

  const [financialSummary, setFinancialSummary] = useState<Awaited<ReturnType<typeof getAdminFinancialSummary>> | null>(null)
  const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(false)

  const [listingReports, setListingReports] = useState<ListingReport[]>([])
  const [loadingListingReports, setLoadingListingReports] = useState(false)

  const [spotlightProfiles, setSpotlightProfiles] = useState<AdminSpotlightProfile[]>([])
  const [loadingSpotlight, setLoadingSpotlight] = useState(false)

  const [rewards, setRewards] = useState<AdminRewardRow[]>([])
  const [rewardsCatalogOn, setRewardsCatalogOn] = useState(false)
  const [rewardRedemptions, setRewardRedemptions] = useState<AdminRewardRedemption[]>([])
  const [loadingRewards, setLoadingRewards] = useState(false)
  const [rewardForm, setRewardForm] = useState({ title: '', description: '', imageUrl: '', pointsCost: '', isVisible: true })
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null)
  const [savingReward, setSavingReward] = useState(false)
  const [rewardError, setRewardError] = useState<string | null>(null)
  const [uploadingRewardImage, setUploadingRewardImage] = useState(false)
  const [voucherBatches, setVoucherBatches] = useState<AdminVoucherBatch[]>([])
  const [batchForm, setBatchForm] = useState<{ businessName: string; quantity: string; priceEur: string; invoiceRef: string; notes: string; plan: 'base' | 'pro' }>({ businessName: '', quantity: '10', priceEur: '400', invoiceRef: '', notes: '', plan: 'base' })
  const [creatingBatch, setCreatingBatch] = useState(false)
  const [couponArea, setCouponArea] = useState<'merchant' | 'community'>('merchant')
  const [fulfillCodeInputs, setFulfillCodeInputs] = useState<Record<string, string>>({})
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)

  const [systemSettings, setSystemSettings] = useState<AdminSystemSettings>({
    maintenance_mode: false,
    maintenance_message: 'Sito in manutenzione. Torna presto!',
    matrix_slot_bonus_points: 0,
    matrix_spillover_bonus_points: 5,
    activity_thanks_points: 0,
    pro_invite_extra_points: 0,
    network_points_activation_base: 49,
    network_points_activation_pro: 122,
    network_points_upgrade_pro: 60,
    voucher_packs: [
      { points: 294, credit_eur: 49 },
      { points: 1800, credit_eur: 294 },
      { points: 5500, credit_eur: 980 },
    ],
    voucher_value_base_eur: 49,
    voucher_value_pro_eur: 149,
    pro_trial_days: 15,
    affinity_intros_per_week: 3,
    listing_feature_cost_7d: 20,
    listing_feature_cost_15d: 35,
    menu_ai_daily_runs: 5,
    veritas_write_seconds: 90,
    veritas_vote_seconds: 45,
    veritas_reveal_seconds: 15,
    verifoto_daily_user: 1,
    checkmail_daily_user: 10,
    verifoto_monthly_ops: 1800,
    mosaic_pixels_day: 3,
    mosaic_bonus_pixels: 1,
    mosaic_min_login_days: 7,
    fabula_min_login_days: 7,
    fabula_hide_after_reports: 3
  })
  // Valori letti all'apertura: si salvano solo i campi cambiati
  const [savedSettings, setSavedSettings] = useState<Record<string, unknown>>({})
  const [planPrices, setPlanPrices] = useState<{ base: number; pro: number; source: 'stripe' | 'settings' } | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [houseAccount, setHouseAccount] = useState<AdminHouseAccount | null>(null)
  const [houseEmail, setHouseEmail] = useState('')
  const [creatingHouse, setCreatingHouse] = useState(false)

  const [messages, setMessages] = useState<AdminMessageRow[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageableUsers, setMessageableUsers] = useState<Awaited<ReturnType<typeof listMessageableUsers>>['users']>([])
  const [messageType, setMessageType] = useState<MessageType>('broadcast')
  const [messageTitle, setMessageTitle] = useState<LocalizedText>({})
  const [messageBody, setMessageBody] = useState<LocalizedText>({})
  const [activeMessageLang, setActiveMessageLang] = useState('it')
  const [messageTargetUserId, setMessageTargetUserId] = useState('')
  const [messageUserSearch, setMessageUserSearch] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  const MESSAGE_LANGUAGES = ['it', 'en', 'de', 'es', 'fr', 'pt', 'ru']

  const loadStats = async () => {
    // Dal server: la matrice non è leggibile dal browser
    const counts = await adminOverviewCounts()
    if (counts) setStats(counts)
  }

  const loadOnlineUsers = async () => {
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('last_seen', fifteenMinutesAgo)
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
      // get_user_downline restituisce righe complete di matrix_nodes
      setMatrixDescendants((downlineData || []) as MatrixNode[])
      setMatrixStats({
        total: downlineData?.length || 0,
        level1: downlineData?.filter((d) => d.depth === 1).length || 0,
        level2: downlineData?.filter((d) => d.depth === 2).length || 0,
        level3: downlineData?.filter((d) => d.depth === 3).length || 0,
        level4: downlineData?.filter((d) => d.depth === 4).length || 0,
        level5: downlineData?.filter((d) => d.depth === 5).length || 0,
      })
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
    if (!confirm('Revocare questo coupon? L\'operazione non è reversibile.')) return
    const result = await revokeCoupon(couponId)
    if (result.success) {
      setCoupons((prev) => prev.filter((c) => c.id !== couponId))
    } else {
      notify(result.error || 'Errore durante la revoca del coupon.')
    }
  }

  const loadVouchersData = async (silent = false) => {
    if (!silent) setLoadingVouchers(true)
    const [voucherResult, usersResult] = await Promise.all([listVouchers(), listVoucherUsers()])
    setVouchers(voucherResult.vouchers)
    setVoucherUsers(usersResult.users)
    setLoadingVouchers(false)
  }

  const handleCreateBatch = async () => {
    const quantity = parseInt(batchForm.quantity, 10) || 0
    if (!confirm(`Generare ${quantity} coupon ${batchForm.plan === 'pro' ? 'PRO' : 'Base'} di attivazione per "${batchForm.businessName}"?`)) return
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

  const handleGenerateAdminVoucher = async () => {
    setGeneratingAdminVoucher(true)
    setLastAdminVoucherCode(null)
    const result = await createAdminVoucher()
    setGeneratingAdminVoucher(false)
    if (!result.success) {
      notify(result.error || 'Errore durante la generazione del codice.')
      return
    }
    setLastAdminVoucherCode(result.code)
    await loadVouchersData(true)
  }

  const handleCreditPoints = async () => {
    setCreditError(null)
    setCreditSuccess(null)
    const amount = parseInt(creditForm.amount, 10)
    if (!creditForm.userId || !amount || amount <= 0) {
      setCreditError('Seleziona un utente e un numero di punti valido.')
      return
    }
    setCreditingPoints(true)
    const result = await creditDailyPoints(creditForm.userId, amount)
    setCreditingPoints(false)
    if (!result.success) {
      setCreditError(result.error || 'Errore durante la ricarica punti.')
      return
    }
    setCreditSuccess(`+${amount} KU Karma accreditati.`)
    setCreditForm({ userId: '', amount: '' })
    setCreditUserSearch('')
    await loadVouchersData(true)
  }

  const loadFinancialSummary = async () => {
    setLoadingFinancialSummary(true)
    const result = await getAdminFinancialSummary()
    setFinancialSummary(result)
    setLoadingFinancialSummary(false)
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
    if (!confirm('Eliminare definitivamente questo annuncio? L\'operazione non è reversibile.')) return
    const result = await deleteReportedListing(listingId)
    if (result.success) {
      setListingReports((prev) => prev.filter((r) => r.listing_id !== listingId))
      loadBadges()
    } else {
      notify(result.error || 'Errore durante l\'eliminazione dell\'annuncio.')
    }
  }

  const filteredCreditUsers = (() => {
    const q = creditUserSearch.trim().toLowerCase()
    if (!q) return []
    return voucherUsers
      .filter((u) => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase()
        return fullName.includes(q) || (u.referral_code || '').toLowerCase().includes(q)
      })
      .slice(0, 8)
  })()

  const selectCreditUser = (u: AdminVoucherUser) => {
    setCreditForm({ ...creditForm, userId: u.id })
    setCreditUserSearch(`${u.first_name || ''} ${u.last_name || ''} — ${u.referral_code}`)
  }

  const clearCreditUser = () => {
    setCreditForm({ ...creditForm, userId: '' })
    setCreditUserSearch('')
  }

  const handleRevokeVoucher = async (voucherId: string) => {
    if (!confirm('Revocare questo voucher? Solo i voucher non ancora riscattati possono essere revocati.')) return
    const result = await revokeVoucher(voucherId)
    if (result.success) {
      setVouchers((prev) => prev.map((v) => (v.id === voucherId ? { ...v, status: 'revoked' } : v)))
    } else {
      notify(result.error || 'Errore durante la revoca del voucher.')
    }
  }

  const loadRewardsData = async (silent = false) => {
    if (!silent) setLoadingRewards(true)
    const [rewardsResult, redemptionsResult, switchResult] = await Promise.all([
      listRewards(),
      listRewardRedemptions(),
      supabase.from('system_settings').select('value').eq('key', 'rewards_catalog_enabled').maybeSingle(),
    ])
    setRewards(rewardsResult.rewards)
    setRewardRedemptions(redemptionsResult.redemptions)
    setRewardsCatalogOn(switchResult.data?.value === 'true')
    setLoadingRewards(false)
  }

  // Interruttore del Catalogo Premi: spento, gli utenti non vedono né
  // possono riscattare premi; catalogo e riscatti restano salvati.
  const toggleRewardsCatalog = async () => {
    const next = !rewardsCatalogOn
    const ok = confirm(
      next
        ? 'Attivare il Catalogo Premi? Gli utenti vedranno la pagina Premi e potranno riscattare i premi visibili con i KU Points.'
        : 'Disattivare il Catalogo Premi? La pagina Premi sparisce e nessuno può più riscattare premi. Catalogo e riscatti già fatti restano salvati.'
    )
    if (!ok) return
    const result = await adminSaveSystemSettings({ rewards_catalog_enabled: next })
    if (result.success) setRewardsCatalogOn(next)
    else notify(result.error || 'Errore durante il salvataggio.')
  }

  const resetRewardForm = () => {
    setRewardForm({ title: '', description: '', imageUrl: '', pointsCost: '', isVisible: true })
    setEditingRewardId(null)
  }

  const handleEditReward = (reward: AdminRewardRow) => {
    setEditingRewardId(reward.id)
    setRewardForm({
      title: reward.title,
      description: reward.description || '',
      imageUrl: reward.image_url || '',
      pointsCost: String(reward.points_cost),
      isVisible: reward.is_visible,
    })
  }

  const handleSaveReward = async () => {
    setRewardError(null)
    const pointsCost = parseInt(rewardForm.pointsCost, 10)
    if (!rewardForm.title.trim() || !pointsCost || pointsCost <= 0) {
      setRewardError('Titolo e KU Points (> 0) sono obbligatori.')
      return
    }
    setSavingReward(true)
    const payload = {
      title: rewardForm.title,
      description: rewardForm.description,
      imageUrl: rewardForm.imageUrl,
      pointsCost,
      isVisible: rewardForm.isVisible,
    }
    const result = editingRewardId ? await updateReward(editingRewardId, payload) : await createReward(payload)
    setSavingReward(false)
    if (!result.success) {
      setRewardError(result.error || 'Errore durante il salvataggio del premio.')
      return
    }
    resetRewardForm()
    await loadRewardsData(true)
  }

  const handleDeleteReward = async (rewardId: string) => {
    if (!confirm('Eliminare questo premio? Possibile solo se non è mai stato riscattato.')) return
    const result = await deleteReward(rewardId)
    if (result.success) {
      setRewards((prev) => prev.filter((r) => r.id !== rewardId))
    } else {
      notify(result.error || 'Errore durante l\'eliminazione del premio.')
    }
  }

  const handleFulfillRedemption = async (redemptionId: string) => {
    const code = (fulfillCodeInputs[redemptionId] || '').trim()
    if (!code) {
      notify('Inserisci il codice da inviare al Kumano.')
      return
    }
    setFulfillingId(redemptionId)
    const result = await fulfillRewardRedemption(redemptionId, code)
    setFulfillingId(null)
    if (result.success) {
      setRewardRedemptions((prev) =>
        prev.map((r) =>
          r.id === redemptionId ? { ...r, fulfilled_at: new Date().toISOString(), fulfillment_code: code } : r
        )
      )
      loadBadges()
      setFulfillCodeInputs((prev) => {
        const next = { ...prev }
        delete next[redemptionId]
        return next
      })
    } else {
      notify(result.error || 'Errore durante l\'evasione del riscatto.')
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

  // Ridimensiona la foto nel browser (lato lungo max 1200 px, JPEG) prima
  // dell'invio: resta sotto il limite di 1 MB delle server action e le
  // pagine del Catalogo si caricano in fretta.
  const handleRewardImageFile = async (file: File | undefined) => {
    if (!file) return
    setRewardError(null)
    setUploadingRewardImage(true)
    try {
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) throw new Error('Impossibile elaborare la foto.')
      const formData = new FormData()
      formData.append('file', new File([blob], 'premio.jpg', { type: 'image/jpeg' }))
      const result = await uploadRewardImage(formData)
      if (result.success) setRewardForm((prev) => ({ ...prev, imageUrl: result.url }))
      else setRewardError(result.error)
    } catch (err) {
      setRewardError((err instanceof Error && err.message) || 'Caricamento della foto non riuscito.')
    } finally {
      setUploadingRewardImage(false)
    }
  }

  const loadHouseAccount = async () => {
    const { account } = await getHouseAccount()
    setHouseAccount(account)
  }

  const handleCreateHouseAccount = async () => {
    if (!confirm(`Creare l'account KUMANI con l'email ${houseEmail}? Da quel momento chiunque potrà iscriversi senza codice invito.`)) return
    setCreatingHouse(true)
    const result = await createHouseAccount(houseEmail)
    setCreatingHouse(false)
    if (result.success) {
      await loadHouseAccount()
      notify('✅ Account KUMANI creato: la registrazione senza invito è attiva.')
    } else {
      notify('❌ ' + (result.error || 'Errore'))
    }
  }

  const loadSystemSettings = async () => {
    loadHouseAccount()
    adminGetPlanPrices().then(setPlanPrices)
    const { data } = await supabase.from('system_settings').select('key, value')
    if (data) {
      const settingsObj: AdminSystemSettings = { ...systemSettings }
      data.forEach((s: { key: string; value: string }) => {
        let value: unknown
        try {
          value = JSON.parse(s.value)
        } catch {
          value = s.value
        }
        // Impostazione numerica salvata come testo (es. "20"): torna numero,
        // solo se è davvero un numero valido
        if (typeof settingsObj[s.key] === 'number' && typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
          value = Number(value)
        }
        settingsObj[s.key] = value
      })
      setSystemSettings(settingsObj)
      setSavedSettings(settingsObj)
    }
  }

  const saveSystemSettings = async () => {
    setSavingSettings(true)
    try {
      const changed = Object.fromEntries(
        Object.entries(systemSettings).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(savedSettings[key]))
      )
      const result = await adminSaveSystemSettings(changed)
      if (result.success) {
        setSavedSettings({ ...savedSettings, ...changed })
        notify(Object.keys(changed).length ? '✅ Impostazioni salvate con successo!' : 'Nessuna modifica da salvare.')
      }
      else notify('❌ Errore durante il salvataggio: ' + (result.error || ''))
    } catch {
      notify('❌ Errore durante il salvataggio')
    }
    setSavingSettings(false)
  }

  const loadMessagesData = async (silent = false) => {
    if (!silent) setLoadingMessages(true)
    const [messagesResult, usersResult] = await Promise.all([listAdminMessages(), listMessageableUsers()])
    setMessages(messagesResult.messages)
    setMessageableUsers(usersResult.users)
    setLoadingMessages(false)
  }

  // Dati della sezione aperta (dopo le funzioni che li caricano)
  useEffect(() => {
    if (activeSection === 'overview') {
      // Caricamento dei dati della sezione (con il segnale "caricamento"):
      // è proprio il compito di questo effetto
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadStats()
      loadOnlineUsers()
      const interval = setInterval(loadOnlineUsers, 30000)
      return () => clearInterval(interval)
    }
    else if (activeSection === 'users') loadUsers()
    else if (activeSection === 'marketplace') loadMarketplaceData()
    else if (activeSection === 'coupons') loadCouponsData()
    else if (activeSection === 'vouchers') loadVouchersData()
    else if (activeSection === 'rewards') loadRewardsData()
    else if (activeSection === 'financials') loadFinancialSummary()
    else if (activeSection === 'listingReports') loadListingReportsData()
    else if (activeSection === 'spotlight') loadSpotlightData()
    else if (activeSection === 'settings') loadSystemSettings()
    else if (activeSection === 'messages') loadMessagesData()
    // Solo al cambio di sezione: le funzioni di caricamento cambiano a ogni
    // disegno e rimetterle qui ricaricherebbe i dati di continuo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection])

  const resetMessageForm = () => {
    setMessageTitle({})
    setMessageBody({})
    setActiveMessageLang('it')
    setMessageTargetUserId('')
    setMessageUserSearch('')
    setMessageError(null)
  }

  const filteredMessageUsers = (() => {
    const q = messageUserSearch.trim().toLowerCase()
    if (!q) return []
    return messageableUsers
      .filter((u) => `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 8)
  })()

  const selectMessageUser = (u: Awaited<ReturnType<typeof listMessageableUsers>>['users'][number]) => {
    setMessageTargetUserId(u.id)
    setMessageUserSearch(`${u.first_name || ''} ${u.last_name || ''} — ${u.email || ''}`)
  }

  const handleSendMessage = async () => {
    setMessageError(null)
    if (messageType === 'individual' && !messageTargetUserId) {
      setMessageError('Seleziona un destinatario.')
      return
    }
    const title = messageType === 'broadcast' ? messageTitle : { it: messageTitle.it || '' }
    const body = messageType === 'broadcast' ? messageBody : { it: messageBody.it || '' }
    if (messageType === 'broadcast' && (!title.it?.trim() || !body.it?.trim())) {
      setMessageError('Il testo in Italiano è obbligatorio (almeno una lingua di riferimento).')
      return
    }
    if (messageType === 'individual' && (!title.it?.trim() || !body.it?.trim())) {
      setMessageError('Titolo e testo sono obbligatori.')
      return
    }
    setSendingMessage(true)
    const result = await createAdminMessage(messageType, messageType === 'individual' ? messageTargetUserId : null, title, body)
    setSendingMessage(false)
    if (!result.success) {
      setMessageError(result.error)
      return
    }
    resetMessageForm()
    await loadMessagesData(true)
  }

  const handleToggleMessageActive = async (id: string, currentActive: boolean) => {
    const result = await toggleAdminMessageActive(id, !currentActive)
    if (result.success) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: !currentActive } : m)))
    } else {
      notify(result.error)
    }
  }

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Eliminare definitivamente questo messaggio?')) return
    const result = await deleteAdminMessage(id)
    if (result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } else {
      notify(result.error)
    }
  }

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
    if (!confirm(`Sei sicuro di voler ${user.is_blocked ? 'SBLOCCARE' : 'BLOCCARE'} l'utente ${user.email}?`)) return
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
    // voucher / admin): il Bonus Struttura conta solo i downline attivati via
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
    if (!confirm(`Vuoi impersonare ${user.first_name} ${user.last_name}?\n\nVerrai loggato come questo utente.\nPotrai tornare al tuo account admin in qualsiasi momento con il pulsante "Torna Admin" della fascia arancione.

L'accesso viene registrato.`)) return

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
  { id: 'overview', label: 'Panoramica', Icon: LayoutDashboard, permission: 'stats.read' as Permission, group: 'general' },
  { id: 'financials', label: 'Amministrazione', Icon: PiggyBank, permission: 'stats.read' as Permission, group: 'general' },
  { id: 'marketplace', label: 'Strumenti e interruttori', Icon: ShoppingBag, permission: 'marketplace.read' as Permission, group: 'general' },
  { id: 'settings', label: 'Impostazioni', Icon: Settings, permission: 'settings.read' as Permission, group: 'general' },
  { id: 'languages', label: 'Lingue del sito', Icon: Globe2, permission: 'settings.read' as Permission, group: 'general' },
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
  { id: 'kuManagement', label: 'Gestione KU', Icon: Coins, permission: 'settings.read' as Permission, group: 'rewards' },
  { id: 'rewards', label: 'Premi', Icon: Gift, permission: 'rewards.read' as Permission, group: 'rewards' },
  { id: 'vouchers', label: 'Voucher', Icon: BadgeCheck, permission: 'vouchers.read' as Permission, group: 'rewards' },
  { id: 'coupons', label: 'Voucher e coupon', Icon: Ticket, permission: 'coupons.read' as Permission, group: 'rewards' },
  { id: 'listingReports', label: 'Bacheca', Icon: Flag, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'spotlight', label: 'Kumano del Giorno', Icon: Star, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'events', label: 'Eventi', Icon: CalendarDays, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'timebank', label: 'Time Bank', Icon: Hourglass, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'affinity', label: 'Affinity', Icon: Flag, permission: 'listings.read' as Permission, group: 'community' },
  { id: 'convivio', label: 'Segnalazioni', Icon: Flag, permission: 'listings.read' as Permission, group: 'kordata' },
  { id: 'convivioFees', label: 'Commissioni', Icon: HandCoins, permission: 'listings.read' as Permission, group: 'kordata' },
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

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-[var(--ink)] rounded-2xl p-8 text-white shadow-lg">
        <h2 className="text-3xl font-bold mb-2">Benvenuto, {userName.split(' ')[0]}!</h2>
        <p className="text-white/80">Ecco lo stato attuale della tua piattaforma Kumani.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 uppercase tracking-wide">
            <Users className="w-4 h-4" />
            Utenti Totali
          </div>
          <div className="text-4xl font-bold text-[var(--gold)] mt-2">{stats.totalUsers}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 uppercase tracking-wide">
            <UserCheck className="w-4 h-4" />
            Abbonamenti Attivi
          </div>
          <div className="text-4xl font-bold text-green-600 mt-2">{stats.activeUsers}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 uppercase tracking-wide">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <Activity className="w-4 h-4" />
            Online Ora
          </div>
          <div className="text-4xl font-bold text-green-600 mt-2">{onlineUsers}</div>
          <div className="text-xs text-gray-400 mt-1">Ultimi 15 min</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 uppercase tracking-wide">
            <GitBranch className="w-4 h-4" />
            Nodi Matrice
          </div>
          <div className="text-4xl font-bold text-orange-600 mt-2">{stats.totalNodes}</div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-gray-500 uppercase tracking-wide">
            <Lock className="w-4 h-4" />
            Utenti Bloccati
          </div>
          <div className="text-4xl font-bold text-red-600 mt-2">{stats.blockedUsers}</div>
        </div>
      </div>
    </div>
  )

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
                      <button onClick={() => openManageModal(user)} className="text-[var(--gold)] hover:text-[var(--ink)] text-sm font-medium">Ruolo</button>
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
              <MatrixTree rootNode={matrixData} descendants={matrixDescendants} />
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
                      Stampa cartoncini
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
      {couponArea === 'merchant' ? renderMerchantCoupons() : renderCommunityCoupons()}
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

  const renderVouchers = () => {
    const statusOf = (v: AdminVoucherRow) => {
      if (v.status === 'redeemed') return { label: 'Riscattato', className: 'bg-gray-100 text-gray-600' }
      if (v.status === 'revoked') return { label: 'Revocato', className: 'bg-red-100 text-red-700' }
      return { label: 'Disponibile', className: 'bg-green-100 text-green-700' }
    }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BadgeCheck className="w-7 h-7" />
            Voucher Abbonamento
          </h2>
          <p className="text-gray-600 mt-1">
            I Kumani creano questi voucher spendendo 49 KU Points; qui puoi anche generarne direttamente in qualità di
            amministratore (gratis, nessun punto scalato) o caricare KU Karma a un utente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Genera Codice Abbonamento</h3>
            <p className="text-sm text-gray-600">
              Crea un voucher di attivazione senza costo in punti. Il codice è generato con un algoritmo
              crittograficamente sicuro (CSPRNG), non prevedibile e non riproducibile da nessuno, e una volta
              attivato non potrà più essere riutilizzato.
            </p>
            <button
              onClick={handleGenerateAdminVoucher}
              disabled={generatingAdminVoucher}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
            >
              <BadgeCheck className="w-4 h-4" />
              {generatingAdminVoucher ? 'Generazione...' : 'Genera codice'}
            </button>
            {lastAdminVoucherCode && (
              <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-pale)] p-3">
                <p className="text-xs text-gray-500 mb-1">Codice generato — invialo al Kumano:</p>
                <code className="font-mono text-base font-bold text-gray-900">{lastAdminVoucherCode}</code>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Carica KU Karma</h3>
            <p className="text-sm text-gray-600">
              Accredita punti giornalieri direttamente a un utente. Questi punti abilitano solo la pubblicazione di
              annunci in bacheca — non i voucher né il Catalogo Premi, che restano legati solo ai KU Points guadagnati
              realmente.
            </p>
            {creditError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{creditError}</div>
            )}
            {creditSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">{creditSuccess}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cerca per nome o codice..."
                  value={creditUserSearch}
                  onChange={(e) => {
                    setCreditUserSearch(e.target.value)
                    if (creditForm.userId) setCreditForm({ ...creditForm, userId: '' })
                  }}
                  className={`w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none ${
                    creditForm.userId ? 'border-green-400 bg-green-50 pr-8' : 'border-gray-300'
                  }`}
                />
                {creditForm.userId && (
                  <button
                    type="button"
                    onClick={clearCreditUser}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    title="Cambia utente"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {!creditForm.userId && filteredCreditUsers.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredCreditUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selectCreditUser(u)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--gold-pale)] border-b last:border-0 border-gray-100"
                      >
                        <div className="font-medium text-gray-900">{u.first_name} {u.last_name}</div>
                        <div className="text-xs text-gray-500">{u.referral_code} · {u.daily_points || 0} KU Karma</div>
                      </button>
                    ))}
                  </div>
                )}
                {!creditForm.userId && creditUserSearch.trim() && filteredCreditUsers.length === 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
                    Nessun utente trovato
                  </div>
                )}
              </div>
              <input
                type="number"
                min="1"
                placeholder="Punti da caricare"
                value={creditForm.amount}
                onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <button
              onClick={handleCreditPoints}
              disabled={creditingPoints}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
            >
              <Sparkles className="w-4 h-4" />
              {creditingPoints ? 'Caricamento...' : 'Carica punti'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Codice</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Creato da</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Riscattato da</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Creato il</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingVouchers ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : vouchers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun voucher creato ancora</td></tr>
              ) : (
                vouchers.map((v) => {
                  const status = statusOf(v)
                  return (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{v.code}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {v.creator?.first_name} {v.creator?.last_name}
                        <div className="text-xs text-gray-400">{v.creator?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {v.redeemed_by ? (
                          <>
                            {v.redeemer?.first_name} {v.redeemer?.last_name}
                            <div className="text-xs text-gray-400">{v.redeemer?.email}</div>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(v.created_at).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.status === 'active' && (
                          <button
                            onClick={() => handleRevokeVoucher(v.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Revoca voucher"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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

  const renderRewards = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gift className="w-7 h-7" />
            Catalogo Premi
          </h2>
          <p className="text-gray-600 mt-1">
            Premi riscattabili dai Kumani con i KU Points. Un premio già riscattato non può più essere eliminato,
            solo nascosto (disattiva &quot;Visibile&quot;).
          </p>
        </div>

        <div
          className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
            rewardsCatalogOn ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
          }`}
        >
          <div>
            <p className="font-bold text-gray-900">Catalogo Premi {rewardsCatalogOn ? 'attivo' : 'disattivato'}</p>
            <p className="text-sm text-gray-600">
              {rewardsCatalogOn
                ? 'Gli utenti vedono la pagina Premi e possono riscattare i premi visibili.'
                : 'Gli utenti non vedono la pagina Premi e non possono riscattare. Puoi comunque preparare il catalogo ed evadere i riscatti già fatti.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleRewardsCatalog}
            disabled={loadingRewards}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
              rewardsCatalogOn ? 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50' : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {rewardsCatalogOn ? 'Disattiva catalogo' : 'Attiva catalogo'}
          </button>
        </div>

        {/* A catalogo spento si vede solo l'interruttore (e i riscatti ancora da evadere) */}
        {rewardsCatalogOn && (
        <>
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-900">{editingRewardId ? 'Modifica premio' : 'Nuovo premio'}</h3>
          {rewardError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{rewardError}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo di Regalo</label>
              <input
                type="text"
                placeholder="Es. Buono Amazon 20€"
                value={rewardForm.title}
                onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">KU Points necessari</label>
              <input
                type="number"
                min="1"
                placeholder="Es. 294"
                value={rewardForm.pointsCost}
                onChange={(e) => setRewardForm({ ...rewardForm, pointsCost: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Foto</label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <label className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-gray-400 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer whitespace-nowrap ${uploadingRewardImage ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingRewardImage ? 'Caricamento...' : '📷 Carica foto'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      handleRewardImageFile(e.target.files?.[0])
                      e.target.value = ''
                    }}
                  />
                </label>
                <span className="text-xs text-gray-400">oppure</span>
                <input
                  type="text"
                  placeholder="incolla un link https://..."
                  value={rewardForm.imageUrl}
                  onChange={(e) => setRewardForm({ ...rewardForm, imageUrl: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </div>
              {rewardForm.imageUrl && (
                <div className="mt-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={rewardForm.imageUrl} alt="Anteprima premio" className="h-20 w-20 rounded-lg object-cover border" />
                  <button
                    type="button"
                    onClick={() => setRewardForm({ ...rewardForm, imageUrl: '' })}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Rimuovi foto
                  </button>
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
              <textarea
                placeholder="Descrizione del premio"
                value={rewardForm.description}
                onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none h-20"
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                id="reward-visible"
                checked={rewardForm.isVisible}
                onChange={(e) => setRewardForm({ ...rewardForm, isVisible: e.target.checked })}
                className="h-4 w-4"
              />
              <label htmlFor="reward-visible" className="text-sm font-medium text-gray-700">
                Visibile nel Catalogo Premi dei Kumani
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveReward}
              disabled={savingReward}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
            >
              <Gift className="w-4 h-4" />
              {savingReward ? 'Salvataggio...' : editingRewardId ? 'Salva modifiche' : 'Crea premio'}
            </button>
            {editingRewardId && (
              <button onClick={resetRewardForm} className="px-5 py-2.5 text-gray-600 hover:text-gray-900 font-medium">
                Annulla
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Premio</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">KU Points</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Visibile</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingRewards ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : rewards.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Nessun premio creato ancora</td></tr>
              ) : (
                rewards.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.title}</div>
                      {r.description && <div className="text-xs text-gray-500">{r.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-semibold">{r.points_cost}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          r.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {r.is_visible ? 'Visibile' : 'Nascosto'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleEditReward(r)} className="text-[var(--gold)] hover:text-[var(--ink)] p-1" title="Modifica">
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <button onClick={() => handleDeleteReward(r.id)} className="text-red-500 hover:text-red-700 p-1 ml-1" title="Elimina">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </>
        )}

        {(rewardsCatalogOn || rewardRedemptions.some((r) => !r.fulfilled_at)) && (
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Riscatti da evadere</h3>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Premio</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Kumano</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Punti spesi</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Richiesto il</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rewardRedemptions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun riscatto ancora</td></tr>
                ) : (
                  rewardRedemptions.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">{r.reward_catalog?.title}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {r.redeemer?.first_name} {r.redeemer?.last_name}
                        <div className="text-xs text-gray-400">{r.redeemer?.email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{r.points_spent}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(r.redeemed_at).toLocaleDateString('it-IT')}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            r.fulfilled_at ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {r.fulfilled_at ? 'Evaso' : 'Da evadere'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.fulfilled_at ? (
                          <span className="font-mono text-xs text-gray-500">{r.fulfillment_code}</span>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="text"
                              placeholder="Codice (es. Amazon)"
                              value={fulfillCodeInputs[r.id] || ''}
                              onChange={(e) => setFulfillCodeInputs({ ...fulfillCodeInputs, [r.id]: e.target.value })}
                              className="w-40 rounded-lg border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                            />
                            <button
                              onClick={() => handleFulfillRedemption(r.id)}
                              disabled={fulfillingId === r.id}
                              className="whitespace-nowrap text-xs font-semibold text-[var(--gold)] hover:text-[var(--ink)] disabled:opacity-50"
                            >
                              {fulfillingId === r.id ? 'Invio...' : 'Evadi con codice'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    )
  }

  const renderFinancials = () => {
    const f = financialSummary
    if (loadingFinancialSummary || !f) {
      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <PiggyBank className="w-7 h-7" />
              Amministrazione
            </h2>
          </div>
          <p className="text-gray-400 text-center py-12">Caricamento...</p>
        </div>
      )
    }
    if (!f.success) {
      return (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PiggyBank className="w-7 h-7" />
            Amministrazione
          </h2>
          <p className="text-red-600">{f.error}</p>
        </div>
      )
    }

    const eur = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
    const Row = ({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) => (
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 py-2 last:border-0">
        <div>
          <p className={`text-sm ${strong ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{label}</p>
          {hint && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
        <p className={`shrink-0 text-right text-sm tabular-nums ${strong ? 'font-bold text-gray-900' : 'text-gray-800'}`}>{value}</p>
      </div>
    )
    const Card = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <h3 className="text-base font-bold text-[var(--ink)]">{title}</h3>
          <p className="text-xs text-gray-600">{subtitle}</p>
        </div>
        <div className="px-5 py-2">{children}</div>
      </section>
    )
    const subs = f.subscriptions

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PiggyBank className="w-7 h-7" />
            Amministrazione
          </h2>
          <p className="text-gray-600 mt-1">
            Dati veri: incassi, rimborsi e commissioni dal registro di Stripe, il resto dal database. Voucher e punti non
            sono uscite di cassa ma servizi dati senza incasso, valutati a prezzo di listino (Base {f.prices.base} €, Pro{' '}
            {f.prices.pro} €). Importi IVA inclusa salvo dove indicato.
          </p>
          {f.testMode && (
            <p className="mt-2 inline-block rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              Stripe in modalità test: sono pagamenti di prova.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-white p-5 shadow-sm">
            <p className="text-sm font-medium text-green-800">Incasso netto</p>
            <p className="text-3xl font-bold text-green-700">{eur(f.cashIn)}</p>
            <p className="mt-1 text-xs text-green-700">Stripe dopo rimborsi e commissioni, più i lotti venduti ai negozi</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-600">Imponibile (senza IVA {f.vatRate}%)</p>
            <p className="text-3xl font-bold text-gray-900">{eur(f.taxable)}</p>
            <p className="mt-1 text-xs text-gray-500">IVA compresa nell&apos;incasso: {eur(f.cashIn - f.taxable)}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="text-sm font-medium text-amber-800">Provvigioni agenti da pagare</p>
            <p className="text-3xl font-bold text-amber-800">{eur(f.agentDue)}</p>
            <p className="mt-1 text-xs text-amber-700">In maturazione {eur(f.agentCommissions.pending)} · maturate {eur(f.agentCommissions.matured)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Incassi Stripe" subtitle="Dal registro dei movimenti: abbonamenti e commissioni Eventi/Kordata">
            <Row label="Incassato (lordo)" value={eur(f.stripe.gross)} hint={`${f.stripe.charges} pagamenti`} />
            <Row label="Rimborsi" value={`− ${eur(f.stripe.refunds)}`} />
            <Row label="Commissioni Stripe" value={`− ${eur(f.stripe.fees)}`} />
            <Row label="Netto Stripe" value={eur(f.stripe.net)} strong />
            <Row label="Ultimi 30 giorni" value={`${eur(f.stripe.gross30)} lordo · ${eur(f.stripe.net30)} netto`} />
          </Card>

          <Card title="Abbonamenti pagati con carta" subtitle="Fatture Stripe pagate, per tipo (IVA inclusa)">
            <Row label="Nuovi Base" value={eur(subs.base.cents)} hint={`${subs.base.count} pagamenti`} />
            <Row label="Nuovi Pro" value={eur(subs.pro.cents)} hint={`${subs.pro.count} pagamenti`} />
            <Row label="Passaggi da Base a Pro" value={eur(subs.upgrade.cents)} hint={`${subs.upgrade.count} pagamenti (solo la differenza)`} />
            <Row label="Rinnovi" value={eur(subs.renewal.cents)} hint={`${subs.renewal.count} pagamenti`} />
            <Row label="Totale abbonamenti" value={eur(f.subscriptionsCents)} strong />
          </Card>

          <Card title="Abbonati attivi oggi" subtitle="Per origine dell'abbonamento">
            <Row label="Base pagati con carta" value={String(f.active.stripeBase)} />
            <Row label="Pro pagati con carta" value={String(f.active.stripePro)} />
            <Row label="Attivati con voucher" value={String(f.active.voucher)} />
            <Row label="Attivati dallo Staff" value={String(f.active.admin)} />
          </Card>

          <Card title="Lotti di voucher per i negozi" subtitle="Venduti con fattura a parte, fuori da Stripe">
            <Row label="Lotti" value={String(f.shopBatches.count)} hint={`${f.shopBatches.vouchers} voucher, ${f.shopRedeemed.count} già usati`} />
            <Row label="Incassato dai lotti" value={eur(f.shopBatches.cents)} strong />
          </Card>

          <Card title="Agenti venditori" subtitle="Provvigioni registrate (rettifiche comprese)">
            <Row label="In maturazione (14 giorni)" value={eur(f.agentCommissions.pending)} />
            <Row label="Maturate, da pagare" value={eur(f.agentCommissions.matured)} />
            <Row label="Già pagate" value={eur(f.agentCommissions.paid)} />
            <Row label="Annullate (rimborsi)" value={eur(f.agentCommissions.cancelled)} />
          </Card>

          <Card title="Voucher della community" subtitle="Servizi dati senza incasso, a prezzo di listino">
            <Row label="Voucher Kumani usati" value={eur(f.kumanoVouchers.redeemedCents)} hint={`${f.kumanoVouchers.redeemedCount} voucher`} />
            <Row label="Voucher Kumani non ancora usati" value={eur(f.kumanoVouchers.activeCents)} hint={`${f.kumanoVouchers.activeCount} voucher in circolazione`} />
            <Row label="Credito voucher non ancora speso" value={eur(f.voucherCreditCents)} />
            <Row label="Voucher omaggio dello Staff usati" value={eur(f.staffGifts.redeemedCents)} hint={`${f.staffGifts.redeemedCount} voucher`} />
            <Row label="Servizi già dati (usati)" value={eur(f.giftedServicesCents)} strong />
          </Card>

          <Card title="Donazioni" subtitle="Impegno di KUMANI verso l'associazione (uscita di cassa quando versato)">
            <Row label="Maturate dagli abbonamenti" value={eur(f.donations.subscriptionCents)} />
            <Row label="Maturate dai KU Points donati" value={eur(f.donations.pointsCents)} />
            <Row label="Già versate" value={eur(f.donations.paidCents)} />
            <Row label="Da versare" value={eur(Math.max(f.donations.subscriptionCents + f.donations.pointsCents - f.donations.paidCents, 0))} strong />
          </Card>

          <Card title="KU Points" subtitle="Assegnati dal nuovo sistema e ancora da spendere">
            <Row label="Attivazioni Base" value={`${f.pointsAwarded.activation_base} punti`} />
            <Row label="Attivazioni Pro" value={`${f.pointsAwarded.activation_pro} punti`} />
            <Row label="Passaggi a Pro" value={`${f.pointsAwarded.upgrade_pro} punti`} />
            <Row label="Bonus Struttura (spillover)" value={`${f.pointsAwarded.matrix} punti`} />
            <Row label="Tolti per rimborsi" value={`${f.pointsAwarded.reversed} punti`} />
            <Row
              label="Punti ancora da spendere"
              value={`${f.networkPointsOutstanding} punti`}
              hint={`Valgono al massimo ${eur(f.networkPointsMaxCents)} di voucher, col pacchetto più conveniente`}
              strong
            />
          </Card>

          <div className="rounded-xl border-2 border-[var(--gold)]/40 bg-[var(--gold-pale)] p-6 shadow-sm">
            <p className="text-sm font-medium text-[var(--ink)]">Voucher della community sugli abbonamenti incassati</p>
            <p className="text-4xl font-bold text-[var(--gold)]">{f.subscriptionsCents > 0 ? `${f.networkSharePercent.toFixed(1)}%` : '—'}</p>
            <p className="mt-1 text-xs text-[var(--ink)]">
              Voucher Kumani usati, in circolazione e credito non speso ({eur(f.kumanoVouchers.redeemedCents + f.outstandingCents)}) su{' '}
              {eur(f.subscriptionsCents)} di abbonamenti pagati. I punti non ancora convertiti sono esclusi.
            </p>
            {f.rewardsRedeemedCount > 0 && (
              <p className="mt-2 text-xs text-gray-600">Storico Catalogo Premi (spento): {f.rewardsRedeemedCount} riscatti.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderMessages = () => {
    const currentLang = messageType === 'broadcast' ? activeMessageLang : 'it'
    const LANG_LABELS: Record<string, string> = { it: 'IT', en: 'EN', de: 'DE', es: 'ES', fr: 'FR', pt: 'PT', ru: 'RU' }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-7 h-7" />
            Messaggi
          </h2>
          <p className="text-gray-600 mt-1">
            Invia una comunicazione a tutti gli utenti (in tutte le lingue del sito) o a un singolo utente.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMessageType('broadcast'); resetMessageForm() }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                messageType === 'broadcast' ? 'bg-[var(--ink)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Megaphone className="w-4 h-4" /> A tutti gli utenti
            </button>
            <button
              type="button"
              onClick={() => { setMessageType('individual'); resetMessageForm() }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                messageType === 'individual' ? 'bg-[var(--ink)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Mail className="w-4 h-4" /> A un utente singolo
            </button>
          </div>

          {messageType === 'individual' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Destinatario</label>
              {messageTargetUserId ? (
                <div className="flex items-center justify-between bg-[var(--gold-pale)] border border-[var(--gold)]/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-[var(--ink)]">{messageUserSearch}</span>
                  <button type="button" onClick={() => { setMessageTargetUserId(''); setMessageUserSearch('') }} className="text-gray-500 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={messageUserSearch}
                    onChange={(e) => setMessageUserSearch(e.target.value)}
                    placeholder="Cerca per nome o email..."
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  />
                  {filteredMessageUsers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {filteredMessageUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => selectMessageUser(u)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        >
                          <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {messageType === 'broadcast' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lingua</label>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveMessageLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      activeMessageLang === lang ? 'bg-[var(--gold)] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    } ${messageTitle[lang]?.trim() && messageBody[lang]?.trim() ? 'ring-2 ring-green-400' : ''}`}
                  >
                    {LANG_LABELS[lang]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">L’italiano è obbligatorio; le altre lingue sono facoltative (se lasciate vuote, quell’utente vedrà il testo in italiano).</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titolo {messageType === 'broadcast' ? `(${LANG_LABELS[currentLang]})` : ''}</label>
            <input
              type="text"
              value={messageTitle[currentLang] || ''}
              onChange={(e) => setMessageTitle((prev) => ({ ...prev, [currentLang]: e.target.value }))}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Testo {messageType === 'broadcast' ? `(${LANG_LABELS[currentLang]})` : ''}</label>
            <textarea
              value={messageBody[currentLang] || ''}
              onChange={(e) => setMessageBody((prev) => ({ ...prev, [currentLang]: e.target.value }))}
              rows={4}
              className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
            />
          </div>

          {messageError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{messageError}</div>
          )}

          <button
            onClick={handleSendMessage}
            disabled={sendingMessage}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
          >
            {sendingMessage ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sendingMessage ? 'Invio...' : 'Invia messaggio'}
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Destinatario</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Titolo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingMessages ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : messages.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun messaggio inviato ancora</td></tr>
              ) : (
                messages.map((m) => {
                  const targetUser = messageableUsers.find((u) => u.id === m.target_user_id)
                  const titlePreview = m.title?.it || Object.values(m.title || {})[0] || '—'
                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.type === 'broadcast' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {m.type === 'broadcast' ? <Megaphone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                          {m.type === 'broadcast' ? 'A tutti' : 'Individuale'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {m.type === 'broadcast' ? 'Tutti gli utenti' : (targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : '—')}
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{titlePreview}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(m.created_at).toLocaleDateString('it-IT')}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleMessageActive(m.id, m.is_active)}
                          className="focus:outline-none"
                          title={m.is_active ? 'Disattiva' : 'Riattiva'}
                        >
                          {m.is_active ? <ToggleRight className="w-9 h-6 text-green-500" /> : <ToggleLeft className="w-9 h-6 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteMessage(m.id)} className="text-red-500 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Elimina
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

  const renderSettings = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7" />
          Impostazioni Sistema
        </h2>
        <p className="text-gray-600 mt-1">Configura i parametri globali della piattaforma, divisi per argomento. Un solo pulsante in fondo salva tutto.</p>
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <BadgeCheck className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Abbonamenti</h3>
          <span className="text-xs text-gray-600">prezzi e prova Pro</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <BadgeCheck className="w-4 h-4" />
              Prezzi degli abbonamenti
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Letti direttamente da Stripe (i prezzi usati dal checkout): sono quelli mostrati sul sito e usati per il
              riepilogo finanziario. Per cambiarli si modifica il prezzo su Stripe; il sito si aggiorna entro un&apos;ora.
            </p>
            {planPrices ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-lg bg-gray-100 px-3 py-2 font-semibold text-gray-800">Base: {planPrices.base} € / anno</span>
                <span className="rounded-lg bg-gray-100 px-3 py-2 font-semibold text-gray-800">Pro: {planPrices.pro} € / anno</span>
                {planPrices.source !== 'stripe' && (
                  <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">Stripe non raggiungibile: valori di riserva salvati</span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Caricamento…</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Piano Pro: prova gratuita
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Giorni di Pro gratis per chi si registra come professionista o la attiva dalla pagina Pro (una sola volta per
              account, senza carta).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Giorni di prova</span>
                <input
                  type="number"
                  min="1"
                  value={systemSettings.pro_trial_days ?? 15}
                  onChange={(e) => setSystemSettings({ ...systemSettings, pro_trial_days: parseInt(e.target.value, 10) || 1 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Users className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Iscrizioni</h3>
          <span className="text-xs text-gray-600">registrazione senza invito</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Iscrizioni senza invito
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Chi si iscrive senza codice invito entra nella struttura dell’account KUMANI (mai in quella di un Kumano) e non
              dà KU Points a nessuno.
            </p>
            {houseAccount ? (
              <p className="text-sm text-gray-700 mb-3">
                ✅ Attiva — account <strong>{houseAccount.first_name} {houseAccount.last_name}</strong>{' '}
                <span className="font-mono">({houseAccount.referral_code})</span> · {houseAccount.email} ·{' '}
                {houseAccount.directMembers} iscritti senza invito
              </p>
            ) : (
              <div className="mb-3 space-y-2">
                <p className="text-sm text-amber-700">
                  ⚠️ Non attiva: finché l&apos;account KUMANI non esiste, la registrazione richiede ancora un codice invito.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
                  <input
                    type="email"
                    value={houseEmail}
                    onChange={(e) => setHouseEmail(e.target.value)}
                    placeholder="email dell'account KUMANI (es. community@...)"
                    className="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCreateHouseAccount}
                    disabled={creatingHouse || !houseEmail}
                    className="px-4 py-2.5 rounded-lg bg-[var(--ink)] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {creatingHouse ? 'Creazione...' : 'Crea account KUMANI'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Coins className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">KU Points e voucher</h3>
          <span className="text-xs text-gray-600">punti, pacchetti, badge e vetrina</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              KU Points
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Punti assegnati <strong>solo allo sponsor diretto</strong> quando un suo invitato paga con carta: primo
              abbonamento Base o Pro, oppure passaggio da Base a Pro. Voucher e rinnovi non danno punti; un rimborso li
              toglie. <strong>Bonus Struttura (spillover):</strong> punti una tantum quando uno dei 5 posti diretti della
              matrice di un Kumano viene occupato da una persona invitata da un altro Kumano che paga con carta. I posti
              occupati dai propri invitati non danno bonus: c&apos;è già il punteggio dell&apos;attivazione.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-3xl">
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Attivazione Base</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.network_points_activation_base ?? 49}
                  onChange={(e) => setSystemSettings({ ...systemSettings, network_points_activation_base: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Attivazione Pro</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.network_points_activation_pro ?? 122}
                  onChange={(e) => setSystemSettings({ ...systemSettings, network_points_activation_pro: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Passaggio a Pro</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.network_points_upgrade_pro ?? 60}
                  onChange={(e) => setSystemSettings({ ...systemSettings, network_points_upgrade_pro: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Bonus Struttura (spillover)</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.matrix_spillover_bonus_points ?? 5}
                  onChange={(e) => setSystemSettings({ ...systemSettings, matrix_spillover_bonus_points: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              Pacchetti voucher e qualifiche
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Il Kumano spende i punti del pacchetto e riceve un credito in euro, con cui crea voucher Base o Pro (da
              regalare o vendere). I pacchetti si possono riscattare più volte. Le stesse soglie, sui punti guadagnati in
              totale, danno i badge Kuman Green, Star e Black (nessun premio collegato).
            </p>
            <div className="space-y-2 max-w-xl">
              {(Array.isArray(systemSettings.voucher_packs) ? systemSettings.voucher_packs : []).map((pack, index) => (
                <div key={index} className="grid grid-cols-[auto_1fr_1fr] items-end gap-3">
                  <span className="pb-3 text-xs font-bold text-gray-500">{['Kuman Green', 'Kuman Star', 'Kuman Black'][index] ?? `#${index + 1}`}</span>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Punti</span>
                    <input
                      type="number"
                      min="1"
                      value={pack.points}
                      onChange={(e) => {
                        const packs = [...systemSettings.voucher_packs]
                        packs[index] = { ...pack, points: parseInt(e.target.value, 10) || 0 }
                        setSystemSettings({ ...systemSettings, voucher_packs: packs })
                      }}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Credito voucher (€)</span>
                    <input
                      type="number"
                      min="1"
                      value={pack.credit_eur}
                      onChange={(e) => {
                        const packs = [...systemSettings.voucher_packs]
                        packs[index] = { ...pack, credit_eur: parseInt(e.target.value, 10) || 0 }
                        setSystemSettings({ ...systemSettings, voucher_packs: packs })
                      }}
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Valore voucher Base (€)</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.voucher_value_base_eur ?? 49}
                  onChange={(e) => setSystemSettings({ ...systemSettings, voucher_value_base_eur: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
              <label className="block max-w-xs">
                <span className="mb-1 block text-xs font-medium text-gray-600">Valore voucher Pro (€)</span>
                <input
                  type="number"
                  min="0"
                  value={systemSettings.voucher_value_pro_eur ?? 149}
                  onChange={(e) => setSystemSettings({ ...systemSettings, voucher_value_pro_eur: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Annunci in Vetrina
            </label>
            <p className="text-xs text-gray-500 mb-3">
              KU Points richiesti a un Kumano per mettere in evidenza un proprio annuncio nella sezione “In Vetrina”
              della bacheca, per 7 o 15 giorni.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={systemSettings.listing_feature_cost_7d ?? 20}
                  onChange={(e) => setSystemSettings({ ...systemSettings, listing_feature_cost_7d: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">/ 7gg</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={systemSettings.listing_feature_cost_15d ?? 35}
                  onChange={(e) => setSystemSettings({ ...systemSettings, listing_feature_cost_15d: parseInt(e.target.value, 10) || 0 })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
                <span className="text-sm text-gray-500 whitespace-nowrap">/ 15gg</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Sparkles className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Servizi</h3>
          <span className="text-xs text-gray-600">limiti e parametri degli strumenti</span>
        </div>
        <div className="space-y-6 p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Traduzioni AI del Menù al giorno (per ristorante)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={systemSettings.menu_ai_daily_runs ?? 5}
              onChange={(e) => setSystemSettings({ ...systemSettings, menu_ai_daily_runs: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-full max-w-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Ogni traduzione ha un piccolo costo sulla chiave AI del progetto.</p>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">VeriFoto: rilevatore AI (Sightengine, quota gratuita)</p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              <label className="text-xs text-gray-600">
                Analisi per utente al giorno
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={systemSettings.verifoto_daily_user ?? 1}
                  onChange={(e) => setSystemSettings({ ...systemSettings, verifoto_daily_user: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
              <label className="text-xs text-gray-600">
                Operazioni al mese (tetto)
                <input
                  type="number"
                  min="0"
                  max="2000"
                  value={systemSettings.verifoto_monthly_ops ?? 1800}
                  onChange={(e) => setSystemSettings({ ...systemSettings, verifoto_monthly_ops: Math.min(2000, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                  className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                />
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Il piano gratuito di Sightengine include 2.000 operazioni al mese: oltre si paga. Tieni il tetto sotto 2.000 per restare gratis
              (ogni analisi consuma le operazioni indicate da Sightengine, di solito alcune per foto).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CheckMail: analisi per utente al giorno</label>
            <input
              type="number"
              min="0"
              max="100"
              value={systemSettings.checkmail_daily_user ?? 10}
              onChange={(e) => setSystemSettings({ ...systemSettings, checkmail_daily_user: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              className="w-full max-w-xs p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Ogni analisi usa anche la chiave AI del progetto (lettura del testo), con un piccolo costo.</p>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Veritas: durata delle fasi (secondi)</p>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {([
                ['veritas_write_seconds', 'Scrittura', 90],
                ['veritas_vote_seconds', 'Voto', 45],
                ['veritas_reveal_seconds', 'Rivelazione', 15],
              ] as const).map(([key, labelText, fallback]) => (
                <label key={key} className="text-xs text-gray-600">
                  {labelText}
                  <input
                    type="number"
                    min="5"
                    max="600"
                    value={systemSettings[key] ?? fallback}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.max(5, parseInt(e.target.value, 10) || 5) })}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">KUMANI Mosaic</p>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {([
                ['mosaic_pixels_day', 'Tessere al giorno', 3, 1, 50],
                ['mosaic_bonus_pixels', 'Tessere bonus', 1, 0, 10],
                ['mosaic_min_login_days', 'Giorni di accesso minimi', 7, 0, 365],
              ] as const).map(([key, labelText, fallback, min, max]) => (
                <label key={key} className="text-xs text-gray-600">
                  {labelText}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={systemSettings[key] ?? fallback}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)) })}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Il bonus arriva a chi oggi ha usato un altro servizio KUMANI. Un giorno di accesso = il KU Karma di accesso giornaliero.
              Dimensione e date delle stagioni si gestiscono in Admin → Mosaic.
            </p>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Kumani Fabula</p>
            <div className="grid grid-cols-2 gap-3 max-w-md">
              {([
                ['fabula_min_login_days', 'Giorni di accesso per pubblicare subito', 7, 0, 365],
                ['fabula_hide_after_reports', 'Segnalazioni per nascondere una storia', 3, 1, 20],
              ] as const).map(([key, labelText, fallback, min, max]) => (
                <label key={key} className="text-xs text-gray-600">
                  {labelText}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    value={systemSettings[key] ?? fallback}
                    onChange={(e) => setSystemSettings({ ...systemSettings, [key]: Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)) })}
                    className="mt-1 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Chi ha meno giorni di accesso, o scrive una parola filtrata, pubblica in attesa del controllo in Admin → Fabula.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Affinity Amicizie
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Quante persone Kumi presenta ogni settimana a chi partecipa ad Affinity Amicizie (solo abbonati, 18+). Con pochi
              iscritti conviene tenerlo basso; si può alzare man mano che la community cresce. 0 = presentazioni sospese.
            </p>
            <label className="block max-w-xs">
              <span className="mb-1 block text-xs font-medium text-gray-600">Presentazioni a settimana</span>
              <input
                type="number"
                min="0"
                max="20"
                value={systemSettings.affinity_intros_per_week ?? 3}
                onChange={(e) => setSystemSettings({ ...systemSettings, affinity_intros_per_week: Math.min(20, parseInt(e.target.value, 10) || 0) })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <Settings className="h-5 w-5 text-[var(--ink)]" />
          <h3 className="text-base font-bold text-[var(--ink)]">Sistema</h3>
          <span className="text-xs text-gray-600">manutenzione del sito</span>
        </div>
        <div className="space-y-6 p-5">
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div>
              <div className="font-medium text-red-900">Modalità Manutenzione</div>
              <div className="text-sm text-red-600">Se attiva, gli utenti vedranno un messaggio di manutenzione</div>
            </div>
            <button
              onClick={() => setSystemSettings({...systemSettings, maintenance_mode: !systemSettings.maintenance_mode})}
              className="focus:outline-none"
            >
              {systemSettings.maintenance_mode ? (
                <ToggleRight className="w-14 h-8 text-red-500" />
              ) : (
                <ToggleLeft className="w-14 h-8 text-gray-400" />
              )}
            </button>
          </div>

          {systemSettings.maintenance_mode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Messaggio di Manutenzione</label>
              <textarea
                value={systemSettings.maintenance_message || ''}
                onChange={(e) => setSystemSettings({...systemSettings, maintenance_message: e.target.value})}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-1 flex justify-end rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          onClick={saveSystemSettings}
          disabled={savingSettings}
          className="px-6 py-3 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] font-medium disabled:bg-gray-400 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {savingSettings ? 'Salvataggio...' : 'Salva Impostazioni'}
        </button>
      </div>
    </div>
  )

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
            const groupCount = group.items.reduce((sum, item) => sum + (badges[item.id] ?? 0), 0)
            return (
              <div key={group.id}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-1.5">
                    {!isOpen && groupCount > 0 && (
                      <span className="rounded-full bg-[var(--gold)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">{badgeLabel(groupCount)}</span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {isOpen && <div className="mt-1 space-y-0.5">{group.items.map((item) => renderMenuButton(item))}</div>}
              </div>
            )
          })}
        </nav>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'users' && renderUsers()}
        {activeSection === 'profileRequests' && <ProfileRequestsPanel onChanged={loadBadges} />}
        {activeSection === 'accountDeletions' && <AccountDeletionsPanel onChanged={loadBadges} canDelete={hasPermission(permissions, 'users.delete')} />}
        {activeSection === 'translators' && <TranslatorsPanel />}
        {activeSection === 'agents' && <AgentsPanel />}
        {activeSection === 'withdrawals' && <WithdrawalsPanel onChanged={loadBadges} />}
        {activeSection === 'donations' && <DonationsPanel />}
        {activeSection === 'languages' && <LanguagesPanel canWrite={hasPermission(permissions, 'settings.write')} />}
        {activeSection === 'matrix' && renderMatrix()}
        {activeSection === 'marketplace' && renderMarketplace()}
        {activeSection === 'coupons' && renderCoupons()}
        {activeSection === 'vouchers' && renderVouchers()}
        {activeSection === 'rewards' && renderRewards()}
        {activeSection === 'messages' && renderMessages()}
        {activeSection === 'financials' && renderFinancials()}
        {activeSection === 'listingReports' && renderListingReports()}
        {activeSection === 'spotlight' && renderSpotlight()}
        {activeSection === 'kuManagement' && <KuManagementPanel />}
        {activeSection === 'affinity' && <AffinityReportsPanel />}
        {activeSection === 'convivio' && <ConvivioReportsPanel locale={locale} />}
        {activeSection === 'events' && (
          <EventsAdminPanel
            locale={locale}
            canReadSettings={hasPermission(permissions, 'settings.read')}
            canWrite={hasPermission(permissions, 'listings.write')}
          />
        )}
        {activeSection === 'identity' && <IdentityVerificationsPanel />}
        {activeSection === 'convivioFees' && <ConvivioFeesPanel locale={locale} canReadSettings={hasPermission(permissions, 'settings.read')} />}
        {activeSection === 'timebank' && <TimebankAdminPanel />}
        {activeSection === 'mosaic' && <MosaicAdminPanel />}
        {activeSection === 'fabula' && <FabulaAdminPanel />}
        {activeSection === 'contactMessages' && <ContactMessagesPanel />}
        {activeSection === 'settings' && renderSettings()}
      </div>

      {renderManageModal()}
      {renderProfileEditModal()}
    </div>
  )
}