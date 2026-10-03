'use server'
import { SITE_URL } from '@/lib/siteUrl'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createHash, randomBytes } from 'crypto'
import type { Permission } from '@/lib/admin-permissions'
import { generateShortCode } from '@/lib/shortLink'
import { getStripe } from '@/lib/stripe'
import { updateTag } from 'next/cache'
import { SPOTLIGHT_HOME_CACHE_TAG, type SpotlightModerationStatus } from '@/lib/spotlight'
import { getPlanPrices } from '@/lib/planPrices'
import { KU_FEATURE_KEYS, type KuFeatureKey } from '@/lib/ku'
import { invalidateListingsCache } from '@/lib/listings-server'
import { generatePassCode } from '@/lib/toolPasses'
import { DEFAULT_HOME_LAYOUT, isHomeLayout } from '@/lib/homeLayouts'
import { HOME_LAYOUT_CACHE_TAG } from '@/lib/homeLayoutServer'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getTranslations } from 'next-intl/server'
import type { AdminCouponRow, AdminRewardRedemption, ListingReport, ListingReportRow } from '@/lib/adminTypes'

const getServiceClient = () =>
  createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

// Verifies the CURRENT SESSION is an admin and, when `requiredPermission` is
// given, that their role actually grants it — the admin panel UI only hides
// menu items for permissions a role lacks, it doesn't stop the underlying
// server action from being invoked directly, so this is the real gate.
async function verifyAdmin(requiredPermission?: Permission) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  // Full admins (profiles.is_admin) bypass the granular role/permission system.
  if (profile?.is_admin) return user

  const { data: adminRecord } = await supabase
    .from('admin_users')
    .select('role_id, admin_roles(permissions)')
    .eq('user_id', user.id)
    .single()

  if (!adminRecord) return null
  if (!requiredPermission) return user

  const roles = adminRecord.admin_roles as { permissions?: string[] } | { permissions?: string[] }[] | null
  const rawPermissions: string[] = Array.isArray(roles)
    ? (roles[0]?.permissions ?? [])
    : (roles?.permissions ?? [])

  if (rawPermissions.includes('*') || rawPermissions.includes(requiredPermission)) return user

  return null
}

// Admin "pieno": profiles.is_admin oppure un ruolo con il permesso '*'.
// Solo loro possono nominare altri admin o impersonare un admin.
async function isFullAdmin(userId: string) {
  const supabaseAdmin = getServiceClient()
  const [{ data: profile }, { data: adminRecord }] = await Promise.all([
    supabaseAdmin.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('admin_users').select('admin_roles(permissions)').eq('user_id', userId).maybeSingle(),
  ])
  if (profile?.is_admin) return true
  const roles = adminRecord?.admin_roles as { permissions?: string[] } | { permissions?: string[] }[] | null | undefined
  const permissions = Array.isArray(roles) ? (roles[0]?.permissions ?? []) : (roles?.permissions ?? [])
  return permissions.includes('*')
}

// Colonne del profilo modificabili dal pannello admin: tutto il resto
// (punti community, sponsor, piano Pro, ecc.) passa dalle funzioni dedicate.
const ADMIN_EDITABLE_PROFILE_FIELDS = new Set([
  'first_name', 'last_name', 'username', 'phone', 'country_code', 'date_of_birth', 'occupation',
  'referral_code', 'daily_points', 'subscription_status', 'subscription_expires_at', 'subscription_source',
  'subscription_plan', 'is_blocked', 'is_admin',
])

// Impostazioni di sistema: salvate lato server (prima partivano dal browser e
// qualsiasi membro dello Staff poteva cambiarle, a prescindere dal ruolo).
// Chiavi modificabili dal modulo Impostazioni: commissioni, account KUMANI e
// il resto hanno i loro pannelli, e non vanno mai riscritte da qui.
const GENERAL_SETTINGS_KEYS = new Set([
  'maintenance_mode', 'maintenance_message', 'matrix_slot_bonus_points', 'matrix_spillover_bonus_points',
  'activity_thanks_points', 'pro_invite_extra_points', 'pro_trial_days', 'affinity_intros_per_week',
  'listing_feature_cost_7d', 'listing_feature_cost_15d', 'menu_ai_daily_runs',
  'veritas_write_seconds', 'veritas_vote_seconds', 'veritas_reveal_seconds',
  'verifoto_daily_user', 'verifoto_monthly_ops', 'checkmail_daily_user',
  'mosaic_pixels_day', 'mosaic_bonus_pixels', 'mosaic_min_login_days',
  'fabula_min_login_days', 'fabula_hide_after_reports',
  'rewards_catalog_enabled',
  'network_points_activation_base', 'network_points_activation_pro', 'network_points_upgrade_pro',
  'voucher_packs', 'voucher_value_base_eur', 'voucher_value_pro_eur',
])

// Salva solo le impostazioni cambiate (il modulo manda le differenze), così
// non riporta indietro modifiche fatte nel frattempo da altri o da altri pannelli.
export async function adminSaveSystemSettings(settings: Record<string, unknown>) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const unknown = Object.keys(settings).find((key) => !GENERAL_SETTINGS_KEYS.has(key))
  if (unknown) return { success: false, error: `Impostazione non modificabile da qui: ${unknown}` }
  // Pacchetti voucher: 1-5 pacchetti con punti e credito interi positivi, punti crescenti
  if ('voucher_packs' in settings) {
    const packs = settings.voucher_packs
    const valid =
      Array.isArray(packs) &&
      packs.length >= 1 &&
      packs.length <= 5 &&
      packs.every((p, i) => {
        const pack = p as { points?: unknown; credit_eur?: unknown }
        const prev = i > 0 ? (packs[i - 1] as { points: number }).points : 0
        return Number.isInteger(pack.points) && Number.isInteger(pack.credit_eur) && (pack.points as number) > prev && (pack.credit_eur as number) > 0
      })
    if (!valid) return { success: false, error: 'Pacchetti voucher non validi: punti e credito devono essere numeri interi positivi, con punti crescenti.' }
  }
  if (Object.keys(settings).length === 0) return { success: true }
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value: JSON.stringify(value) }))
  const { error } = await getServiceClient().from('system_settings').upsert(rows, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Prezzi dei piani come li vede il sito (letti da Stripe)
export async function adminGetPlanPrices() {
  const admin = await verifyAdmin('settings.read')
  if (!admin) return null
  return getPlanPrices()
}

export async function adminSetToolEnabled(toolName: string, enabled: boolean) {
  const admin = await verifyAdmin('marketplace.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const { error } = await getServiceClient()
    .from('marketplace_settings')
    .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('tool_name', toolName)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Assegna o toglie un ruolo Staff: solo un admin completo può farlo.
export async function adminSetUserRole(userId: string, roleId: string | null) {
  const admin = await verifyAdmin('users.write')
  if (!admin || !(await isFullAdmin(admin.id))) return { success: false, error: 'Solo un amministratore completo può assegnare ruoli' }
  const service = getServiceClient()
  const { error } = roleId
    ? await service.from('admin_users').upsert(
        { user_id: userId, role_id: roleId, assigned_by: admin.id, notes: 'Assegnato da Pannello Admin' },
        { onConflict: 'user_id' }
      )
    : await service.from('admin_users').delete().eq('user_id', userId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function adminGetUserRole(userId: string) {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { roleId: null as string | null, roles: [] as { id: string; name: string }[] }
  const service = getServiceClient()
  const [{ data: roles }, { data: record }] = await Promise.all([
    service.from('admin_roles').select('id, name').order('name'),
    service.from('admin_users').select('role_id').eq('user_id', userId).maybeSingle(),
  ])
  return { roleId: (record?.role_id as string | null) ?? null, roles: (roles ?? []) as { id: string; name: string }[] }
}

export async function adminUpdateProfile(userId: string, profileData: Record<string, unknown>) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const unknownField = Object.keys(profileData).find((key) => !ADMIN_EDITABLE_PROFILE_FIELDS.has(key))
  if (unknownField) return { success: false, error: `Campo non modificabile: ${unknownField}` }

  if ('subscription_plan' in profileData && !['base', 'pro'].includes(String(profileData.subscription_plan))) {
    return { success: false, error: 'Piano non valido (base o pro)' }
  }
  const supabaseAdmin = getServiceClient()
  if ('is_blocked' in profileData && !profileData.is_blocked) {
    // Un account cancellato (GDPR) resta chiuso per sempre
    const { data: current } = await supabaseAdmin.from('profiles').select('deleted_at').eq('id', userId).maybeSingle()
    if (current?.deleted_at) return { success: false, error: 'Account cancellato: non si può sbloccare' }
  }
  if ('is_admin' in profileData) {
    const { data: current } = await supabaseAdmin.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
    if (Boolean(current?.is_admin) !== Boolean(profileData.is_admin) && !(await isFullAdmin(admin.id))) {
      return { success: false, error: 'Solo un amministratore completo può cambiare i privilegi admin' }
    }
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(profileData)
    .eq('id', userId)

  if (error) {
    console.error('Errore aggiornamento profilo:', error)
    return { success: false, error: error.message }
  }

  // Blocco: anche l'accesso viene chiuso (le sessioni aperte non si rinnovano
  // più e non si può rientrare, nemmeno con "password dimenticata").
  if ('is_blocked' in profileData) {
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: profileData.is_blocked ? '876000h' : 'none',
    })
    if (banError) {
      console.error('[Admin] auth ban failed:', banError.message)
      return { success: true, warning: `Profilo aggiornato, ma l'accesso non è stato ${profileData.is_blocked ? 'bloccato' : 'riaperto'}: ${banError.message}` }
    }
  }
  return { success: true }
}

// ✅ GENERA DUE LINK: uno per l'utente target, uno di ripristino per l'admin
export async function impersonateUser(userId: string) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  if (userId === admin.id) return { success: false, error: 'Sei già in questo account' }

  const supabaseAdmin = getServiceClient()

  // Solo un amministratore completo può entrare nell'account di un altro
  // membro dello Staff (anche con permessi limitati): altrimenti uno Staff
  // potrebbe prendere i permessi di un collega.
  if (!(await isFullAdmin(admin.id))) {
    const [{ data: targetProfile }, { data: targetStaff }] = await Promise.all([
      supabaseAdmin.from('profiles').select('is_admin').eq('id', userId).maybeSingle(),
      supabaseAdmin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle(),
    ])
    if (targetProfile?.is_admin || targetStaff) {
      return { success: false, error: 'Non puoi impersonare un membro dello Staff' }
    }
  }
  const base = SITE_URL

  // Recupera email utente target
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (userError || !userData.user?.email) {
    return { success: false, error: 'Utente non trovato' }
  }

  if (!admin.email) {
    return { success: false, error: 'Email admin non trovata' }
  }

  // Link 1: login come utente target → passa dalla pagina callback
  const { data: targetLink, error: e1 } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
    options: {
      redirectTo: `${base}/it/auth/impersonate-callback`
    }
  })
  if (e1) return { success: false, error: e1.message }

  // Link 2: ripristino sessione admin — sempre per l'admin della sessione
  // verificata (admin.id), MAI per un id passato dal client, altrimenti un
  // admin malevolo potrebbe farsi generare il link di accesso di un altro admin.
  const { data: adminLink, error: e2 } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: admin.email!,
    options: {
      redirectTo: `${base}/it/auth/impersonate-callback?restore=1`
    }
  })
  if (e2) return { success: false, error: e2.message }

  // Registro obbligatorio: senza traccia (chi, in quale account, quando)
  // l'accesso non si concede.
  const { error: logError } = await supabaseAdmin.from('admin_impersonations').insert({ admin_id: admin.id, target_id: userId })
  if (logError) {
    console.error('[impersonateUser] registro non scritto:', logError.message)
    return { success: false, error: 'Registro delle impersonificazioni non disponibile' }
  }

  return {
    success: true,
    targetUrl: targetLink.properties.action_link,
    adminRestoreUrl: adminLink.properties.action_link
  }
}

// ── Wallet coupons ──────────────────────────────────────────────────────
// Manual coupon issuance: an admin assigns a coupon directly to one user,
// who then sees and self-redeems it from their My Wallet. See
// supabase/migrations/20260921240000_add_wallet_coupons.sql for the RLS
// rationale (owner can only ever read + redeem, never edit).

export async function createCoupon(input: {
  userId: string
  title: string
  description: string
  expiresAt: string | null
}) {
  const admin = await verifyAdmin('coupons.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  if (!input.userId || !input.title.trim()) {
    return { success: false, error: 'Utente e titolo sono obbligatori' }
  }

  const supabaseAdmin = getServiceClient()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortCode()
    const { error } = await supabaseAdmin.from('wallet_coupons').insert({
      user_id: input.userId,
      code,
      title: input.title.trim(),
      description: input.description.trim() || null,
      expires_at: input.expiresAt,
      issued_by: admin.id,
    })

    if (!error) return { success: true }
    if (error.code !== '23505') {
      // Not a unique-code collision — a real error, stop retrying.
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: 'Impossibile generare un codice coupon univoco. Riprova.' }
}

export async function listCoupons() {
  const admin = await verifyAdmin('coupons.read')
  if (!admin) return { coupons: [], error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { data, error } = await supabaseAdmin
    .from('wallet_coupons')
    .select('id, code, title, description, expires_at, redeemed_at, created_at, user_id, profiles:user_id(first_name, last_name, email)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { coupons: [], error: error.message }
  // profiles è un oggetto (un solo utente), non un array come deduce supabase-js
  return { coupons: (data || []) as unknown as AdminCouponRow[], error: null }
}

export async function revokeCoupon(couponId: string) {
  const admin = await verifyAdmin('coupons.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { error } = await supabaseAdmin.from('wallet_coupons').delete().eq('id', couponId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ── Subscription vouchers ───────────────────────────────────────────────
// Read-only admin visibility + revocation for the voucher system: creation
// and redemption both happen client-side via the SECURITY DEFINER RPCs in
// supabase/migrations/20260922130000_add_subscription_vouchers.sql (never
// through a server action), so this file only ever reads or revokes —
// mirrors the coupon admin surface above.

export async function listVouchers() {
  const admin = await verifyAdmin('vouchers.read')
  if (!admin) return { vouchers: [], error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { data, error } = await supabaseAdmin
    .from('subscription_vouchers')
    .select('id, code, status, created_at, redeemed_at, created_by, redeemed_by')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { vouchers: [], error: error.message }
  const rows = data || []

  // created_by/redeemed_by reference auth.users, not profiles, so PostgREST
  // can't embed profiles automatically here — fetch the involved profiles
  // separately and merge instead.
  const userIds = Array.from(new Set(rows.flatMap((v) => [v.created_by, v.redeemed_by].filter(Boolean))))
  const profiles = userIds.length
    ? (await supabaseAdmin.from('profiles').select('id, first_name, last_name, email').in('id', userIds)).data
    : []
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  const vouchers = rows.map((v) => ({
    ...v,
    creator: byId[v.created_by] || null,
    redeemer: v.redeemed_by ? byId[v.redeemed_by] || null : null,
  }))

  return { vouchers, error: null }
}

export async function revokeVoucher(voucherId: string) {
  const admin = await verifyAdmin('vouchers.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  // Only an still-active voucher can be revoked — one already redeemed has
  // already activated someone's subscription and revoking the row here
  // would not undo that, so it must not look like it did.
  const { error } = await supabaseAdmin
    .from('subscription_vouchers')
    .update({ status: 'revoked' })
    .eq('id', voucherId)
    .eq('status', 'active')

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Admin-issued codes are visually distinct from Kumano-issued ones ("KVA-"
// vs "KV-") purely for audit clarity in the table below — functionally
// they redeem through the exact same, already-hardened
// redeem_subscription_voucher() RPC (single-use, self-redemption blocked).
// Unlike a Kumano's voucher, this one costs no points: admin.id becomes
// created_by, so an admin can never redeem their own issued code either.
const ADMIN_VOUCHER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // unambiguous, no 0/O/1/I
const ADMIN_VOUCHER_LENGTH = 14 // 32^14 keyspace — brute-forcing a valid code is infeasible

function generateSecureVoucherCode(): string {
  // crypto.randomBytes is a CSPRNG (unlike Math.random), so a generated
  // code can't be predicted or reproduced by anyone outside this server,
  // including by the admin issuing it. 256 is an exact multiple of the
  // 32-character alphabet, so byte % 32 has zero modulo bias.
  const bytes = randomBytes(ADMIN_VOUCHER_LENGTH)
  let code = ''
  for (let i = 0; i < ADMIN_VOUCHER_LENGTH; i++) {
    code += ADMIN_VOUCHER_ALPHABET[bytes[i] % ADMIN_VOUCHER_ALPHABET.length]
  }
  return code
}

export async function createAdminVoucher(): Promise<{ success: true; code: string } | { success: false; error: string }> {
  const admin = await verifyAdmin('vouchers.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = 'KVA-' + generateSecureVoucherCode()
    const { error } = await supabaseAdmin.from('subscription_vouchers').insert({
      code,
      created_by: admin.id,
      status: 'active',
    })
    if (!error) return { success: true, code }
    if (error.code !== '23505') return { success: false, error: error.message }
  }

  return { success: false, error: 'Impossibile generare un codice univoco. Riprova.' }
}

// Credits daily_points (KU Karma) directly to a user — separate from
// network_points on purpose, per product decision: an admin top-up should
// only unlock listings, never let someone mint vouchers/rewards for free.
export async function creditDailyPoints(userId: string, amount: number) {
  const admin = await verifyAdmin('vouchers.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  if (!userId || !Number.isInteger(amount) || amount <= 0) {
    return { success: false, error: 'Seleziona un utente e un numero di punti valido (> 0).' }
  }

  const supabaseAdmin = getServiceClient()
  const { data: profile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('daily_points, ku_earned_total')
    .eq('id', userId)
    .single()

  if (fetchError || !profile) return { success: false, error: 'Utente non trovato.' }

  // Conta anche per i badge di costanza (KU Karma guadagnati in totale).
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      daily_points: (profile.daily_points || 0) + amount,
      ku_earned_total: (profile.ku_earned_total || 0) + amount,
    })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function listVoucherUsers() {
  const admin = await verifyAdmin('vouchers.read')
  if (!admin) return { users: [], error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, referral_code, daily_points')
    .order('first_name')
    .limit(500)

  if (error) return { users: [], error: error.message }
  return { users: data || [], error: null }
}

// ── Reward catalog ──────────────────────────────────────────────────────
// Prizes a Kumano can redeem with network_points (see
// supabase/migrations/20260922150000_fix_voucher_points_and_reward_tiers.sql
// for reward_catalog / reward_redemptions / redeem_reward()). Admin manages
// the catalog here; the actual point spend + redemption record only ever
// happens through the redeem_reward() RPC, called from
// src/app/actions/rewards.ts, never from this file.

export async function createReward(input: {
  title: string
  description: string
  imageUrl: string
  pointsCost: number
  isVisible: boolean
}) {
  const admin = await verifyAdmin('rewards.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  if (!input.title.trim() || !input.pointsCost || input.pointsCost <= 0) {
    return { success: false, error: 'Titolo e KU Points (> 0) sono obbligatori' }
  }

  const supabaseAdmin = getServiceClient()
  const { error } = await supabaseAdmin.from('reward_catalog').insert({
    title: input.title.trim(),
    description: input.description.trim() || null,
    image_url: input.imageUrl.trim() || null,
    points_cost: input.pointsCost,
    is_visible: input.isVisible,
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateReward(
  rewardId: string,
  input: { title: string; description: string; imageUrl: string; pointsCost: number; isVisible: boolean }
) {
  const admin = await verifyAdmin('rewards.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  if (!input.title.trim() || !input.pointsCost || input.pointsCost <= 0) {
    return { success: false, error: 'Titolo e KU Points (> 0) sono obbligatori' }
  }

  const supabaseAdmin = getServiceClient()
  const { error } = await supabaseAdmin
    .from('reward_catalog')
    .update({
      title: input.title.trim(),
      description: input.description.trim() || null,
      image_url: input.imageUrl.trim() || null,
      points_cost: input.pointsCost,
      is_visible: input.isVisible,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rewardId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function listRewards() {
  const admin = await verifyAdmin('rewards.read')
  if (!admin) return { rewards: [], error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { data, error } = await supabaseAdmin
    .from('reward_catalog')
    .select('id, title, description, image_url, points_cost, is_visible, created_at')
    .order('created_at', { ascending: false })

  if (error) return { rewards: [], error: error.message }
  return { rewards: data || [], error: null }
}

export async function deleteReward(rewardId: string) {
  const admin = await verifyAdmin('rewards.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  // reward_redemptions.reward_id is ON DELETE RESTRICT, so this fails with
  // a clear DB error if the reward has ever been redeemed — a redeemed
  // reward can only be hidden (is_visible: false via updateReward), never
  // deleted, so fulfillment history is never lost.
  const { error } = await supabaseAdmin.from('reward_catalog').delete().eq('id', rewardId)
  if (error) return { success: false, error: 'Non è possibile eliminare un premio già riscattato: nascondilo invece.' }
  return { success: true }
}

export async function listRewardRedemptions() {
  const admin = await verifyAdmin('rewards.read')
  if (!admin) return { redemptions: [], error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { data, error } = await supabaseAdmin
    .from('reward_redemptions')
    .select('id, reward_id, user_id, points_spent, redeemed_at, fulfilled_at, fulfillment_code, reward_catalog(title)')
    .order('redeemed_at', { ascending: false })
    .limit(200)

  if (error) return { redemptions: [], error: error.message }
  // reward_catalog è un oggetto (un solo premio), non un array come deduce supabase-js
  const rows = (data || []) as unknown as Omit<AdminRewardRedemption, 'redeemer'>[]

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)))
  const profiles = userIds.length
    ? (await supabaseAdmin.from('profiles').select('id, first_name, last_name, email').in('id', userIds)).data
    : []
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  const redemptions = rows.map((r) => ({ ...r, redeemer: byId[r.user_id] || null }))
  return { redemptions, error: null }
}

// Fulfills a reward redemption by entering the real code the admin bought
// (an Amazon gift card code, etc.): marks the redemption evaso AND copies
// the code into a new wallet_coupons row for that user, so it shows up
// where Kumani already know to look for coupons — My Wallet → Coupon —
// reusing that existing UI (including the coupon PDF) instead of building
// a parallel "view my prize" screen.
export async function fulfillRewardRedemption(redemptionId: string, code: string) {
  const admin = await verifyAdmin('rewards.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const trimmedCode = code.trim()
  if (!trimmedCode) return { success: false, error: 'Inserisci il codice da inviare.' }

  const supabaseAdmin = getServiceClient()

  const { data: redemption, error: fetchError } = await supabaseAdmin
    .from('reward_redemptions')
    .select('id, user_id, fulfilled_at, reward_catalog(title, description)')
    .eq('id', redemptionId)
    .single()

  if (fetchError || !redemption) return { success: false, error: 'Riscatto non trovato.' }
  if (redemption.fulfilled_at) return { success: false, error: 'Questo riscatto è già stato evaso.' }

  const rewardInfo = Array.isArray(redemption.reward_catalog) ? redemption.reward_catalog[0] : redemption.reward_catalog

  const { error: couponError } = await supabaseAdmin.from('wallet_coupons').insert({
    user_id: redemption.user_id,
    code: trimmedCode,
    title: rewardInfo?.title || 'Premio',
    description: rewardInfo?.description || null,
    issued_by: admin.id,
  })

  if (couponError) {
    if (couponError.code === '23505') {
      return { success: false, error: 'Questo codice è già stato usato per un altro coupon. Verificalo.' }
    }
    return { success: false, error: couponError.message }
  }

  const { error: updateError } = await supabaseAdmin
    .from('reward_redemptions')
    .update({ fulfilled_at: new Date().toISOString(), fulfillment_code: trimmedCode })
    .eq('id', redemptionId)

  if (updateError) return { success: false, error: updateError.message }
  return { success: true }
}

// ── Riepilogo economico (Admin → Amministrazione) ──────────────────────
// Tutto in centesimi, calcolato dai dati veri:
// - incassi, rimborsi e commissioni: registro dei movimenti di Stripe
//   (balance transactions), quindi anche le commissioni Eventi/Kordata;
// - abbonamenti per piano: fatture Stripe pagate (riga principale);
// - lotti di voucher venduti ai negozi: fatturati fuori da Stripe;
// - provvigioni agenti, voucher, credito e KU Points: database.
// I voucher e i punti non sono uscite di cassa: sono servizi dati senza
// incasso, valutati al prezzo di listino.
export async function getAdminFinancialSummary() {
  const admin = await verifyAdmin('stats.read')
  if (!admin) return { success: false as const, error: 'Non autorizzato' }

  const db = getServiceClient()
  const stripe = getStripe()
  const prices = await getPlanPrices()
  const { data: vatRow } = await db.from('system_settings').select('value').eq('key', 'agent_commission_vat_rate').maybeSingle()
  const vatRate = Number(String(vatRow?.value ?? '22').replace(/"/g, '')) || 22
  const since30 = Math.floor(Date.now() / 1000) - 30 * 86_400

  // 1. Stripe: tutti i movimenti (paginati)
  const stripeTotals = { gross: 0, refunds: 0, fees: 0, net: 0, gross30: 0, net30: 0, charges: 0 }
  let startingAfter: string | undefined
  for (let page = 0; page < 50; page++) {
    const list = await stripe.balanceTransactions.list({ limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
    for (const tx of list.data) {
      const isCharge = tx.type === 'charge' || tx.type === 'payment'
      const isRefund = tx.type === 'refund' || tx.type === 'payment_refund'
      if (isCharge) {
        stripeTotals.gross += tx.amount
        stripeTotals.charges += 1
        if (tx.created >= since30) stripeTotals.gross30 += tx.amount
      }
      if (isRefund) stripeTotals.refunds += -tx.amount
      stripeTotals.fees += tx.fee
      stripeTotals.net += tx.net
      if (tx.created >= since30) stripeTotals.net30 += tx.net
    }
    if (!list.has_more || list.data.length === 0) break
    startingAfter = list.data[list.data.length - 1].id
  }

  // 2. Abbonamenti incassati per tipo (fatture pagate, riga principale)
  const subs = {
    base: { count: 0, cents: 0 },
    pro: { count: 0, cents: 0 },
    upgrade: { count: 0, cents: 0 },
    renewal: { count: 0, cents: 0 },
  }
  startingAfter = undefined
  for (let page = 0; page < 50; page++) {
    const list = await stripe.invoices.list({ status: 'paid', limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
    for (const invoice of list.data) {
      if (!invoice.amount_paid) continue
      const main = invoice.lines.data.reduce<(typeof invoice.lines.data)[number] | undefined>(
        (best, line) => (!best || line.amount > best.amount ? line : best),
        undefined
      )
      const priceId = main?.pricing?.price_details?.price ?? (main as { price?: { id?: string } } | undefined)?.price?.id
      const pro = typeof priceId === 'string' && priceId === process.env.STRIPE_PRICE_ID_PRO
      const bucket =
        invoice.billing_reason === 'subscription_cycle'
          ? subs.renewal
          : invoice.billing_reason === 'subscription_update'
            ? subs.upgrade
            : invoice.billing_reason === 'subscription_create'
              ? pro
                ? subs.pro
                : subs.base
              : null
      if (!bucket) continue
      bucket.count += 1
      bucket.cents += invoice.amount_paid
    }
    if (!list.has_more || list.data.length === 0) break
    startingAfter = list.data[list.data.length - 1].id
  }

  // 3. Abbonati attivi oggi, per origine e piano
  const { data: activeRows } = await db
    .from('profiles')
    .select('subscription_source, subscription_plan, subscription_expires_at')
    .eq('subscription_status', 'active')
  const now = Date.now()
  const active = { stripeBase: 0, stripePro: 0, voucher: 0, admin: 0 }
  for (const p of activeRows ?? []) {
    if (p.subscription_expires_at && new Date(p.subscription_expires_at).getTime() < now) continue
    if (p.subscription_source === 'stripe') {
      if (p.subscription_plan === 'pro') active.stripePro += 1
      else active.stripeBase += 1
    } else if (p.subscription_source === 'voucher') active.voucher += 1
    else active.admin += 1
  }

  // 4. Lotti di voucher venduti ai negozi (fattura a parte)
  const { data: batches } = await db.from('voucher_batches').select('quantity, price_eur')
  const shopBatches = {
    count: batches?.length ?? 0,
    vouchers: (batches ?? []).reduce((sum, b) => sum + (b.quantity ?? 0), 0),
    cents: Math.round((batches ?? []).reduce((sum, b) => sum + Number(b.price_eur ?? 0), 0) * 100),
  }

  // 5. Provvigioni agenti (le rettifiche negative sono comprese)
  const { data: commissions } = await db.from('agent_commissions').select('status, commission_cents, matures_at')
  const agentCommissions = { pending: 0, matured: 0, paid: 0, cancelled: 0 }
  for (const c of commissions ?? []) {
    const cents = c.commission_cents ?? 0
    if (c.status === 'cancelled') agentCommissions.cancelled += cents
    else if (c.status === 'paid') agentCommissions.paid += cents
    else if (c.matures_at && new Date(c.matures_at).getTime() <= now) agentCommissions.matured += cents
    else agentCommissions.pending += cents
  }

  // 6. Voucher: creati dai Kumani col credito (valore = costo registrato),
  // omaggio dello Staff (KVA-, senza lotto) e dei lotti negozi
  const { data: vouchers } = await db.from('subscription_vouchers').select('code, status, plan, cost_cents, batch_id')
  const listPrice = (plan: string | null) => Math.round((plan === 'pro' ? prices.pro : prices.base) * 100)
  const kumano = { activeCount: 0, activeCents: 0, redeemedCount: 0, redeemedCents: 0 }
  const staffGifts = { redeemedCount: 0, redeemedCents: 0 }
  const shopRedeemed = { count: 0 }
  for (const v of vouchers ?? []) {
    if (v.status === 'revoked') continue
    if (v.batch_id) {
      if (v.status === 'redeemed') shopRedeemed.count += 1
    } else if (v.code?.startsWith('KVA-')) {
      if (v.status === 'redeemed') {
        staffGifts.redeemedCount += 1
        staffGifts.redeemedCents += listPrice(v.plan)
      }
    } else {
      const value = v.cost_cents ?? listPrice(v.plan)
      if (v.status === 'redeemed') {
        kumano.redeemedCount += 1
        kumano.redeemedCents += value
      } else {
        kumano.activeCount += 1
        kumano.activeCents += value
      }
    }
  }

  // 7. Credito voucher e KU Points ancora da usare
  const { data: balances } = await db.from('profiles').select('voucher_credit_cents, network_points')
  const voucherCreditCents = (balances ?? []).reduce((sum, p) => sum + (p.voucher_credit_cents ?? 0), 0)
  const networkPointsOutstanding = (balances ?? []).reduce((sum, p) => sum + (p.network_points ?? 0), 0)
  // Valore massimo dei punti: il pacchetto che rende di più per punto
  const { data: packsRow } = await db.rpc('voucher_packs')
  const packs = (Array.isArray(packsRow) ? packsRow : []) as { points: number; credit_eur: number }[]
  const bestCentsPerPoint = packs.reduce((best, p) => Math.max(best, (p.credit_eur * 100) / p.points), 0)
  const networkPointsMaxCents = Math.round(networkPointsOutstanding * bestCentsPerPoint)

  // 8. Punti assegnati (registro)
  const { data: awards } = await db.from('network_point_awards').select('kind, points, reversed_at')
  const pointsAwarded = { activation_base: 0, activation_pro: 0, upgrade_pro: 0, matrix: 0, reversed: 0 }
  for (const a of awards ?? []) {
    if (a.reversed_at) pointsAwarded.reversed += a.points
    else pointsAwarded[a.kind as keyof typeof pointsAwarded] += a.points
  }

  // 9. Donazioni: maturate (abbonamenti e punti donati, al netto dei
  // rimborsi) e già versate alle associazioni
  const [{ data: donationRows }, { data: donationPayouts }] = await Promise.all([
    db.from('donation_entries').select('source, amount_cents, reversed_at'),
    db.from('donation_payouts').select('amount_cents'),
  ])
  const donations = { subscriptionCents: 0, pointsCents: 0, paidCents: 0 }
  for (const row of donationRows ?? []) {
    if (row.reversed_at) continue
    if (row.source === 'points') donations.pointsCents += row.amount_cents
    else donations.subscriptionCents += row.amount_cents
  }
  for (const row of donationPayouts ?? []) donations.paidCents += row.amount_cents

  // 10. Pass dei singoli servizi (pagati con carta o attivati con codice)
  const { data: passRows } = await db.from('tool_passes').select('source, amount_cents, expires_at, revoked_at')
  const toolPasses = { soldCount: 0, soldCents: 0, codeCount: 0, activeCount: 0 }
  for (const row of passRows ?? []) {
    if (row.revoked_at) continue
    if (row.source === 'stripe') {
      toolPasses.soldCount += 1
      toolPasses.soldCents += row.amount_cents ?? 0
    } else if (row.source === 'code') toolPasses.codeCount += 1
    if (row.expires_at && new Date(row.expires_at).getTime() > now) toolPasses.activeCount += 1
  }

  // 11. Premi del catalogo (spento, solo storico)
  const { count: rewardsRedeemedCount } = await db.from('reward_redemptions').select('*', { count: 'exact', head: true })

  // Totali
  const cashIn = stripeTotals.net + shopBatches.cents
  const taxable = Math.round(cashIn / (1 + vatRate / 100))
  const agentDue = agentCommissions.pending + agentCommissions.matured
  const giftedServicesCents = kumano.redeemedCents + staffGifts.redeemedCents
  const outstandingCents = kumano.activeCents + voucherCreditCents
  const subscriptionsCents = subs.base.cents + subs.pro.cents + subs.upgrade.cents + subs.renewal.cents
  const networkSharePercent = subscriptionsCents > 0 ? ((kumano.redeemedCents + outstandingCents) / subscriptionsCents) * 100 : 0

  return {
    success: true as const,
    testMode: (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_'),
    prices,
    vatRate,
    stripe: stripeTotals,
    subscriptions: subs,
    subscriptionsCents,
    active,
    shopBatches,
    shopRedeemed,
    toolPasses,
    agentCommissions,
    agentDue,
    kumanoVouchers: kumano,
    staffGifts,
    voucherCreditCents,
    networkPointsOutstanding,
    networkPointsMaxCents,
    pointsAwarded,
    rewardsRedeemedCount: rewardsRedeemedCount ?? 0,
    donations,
    cashIn,
    taxable,
    giftedServicesCents,
    outstandingCents,
    networkSharePercent,
  }
}

// "Bacheca" moderation queue — one row per report, listing embedded via its
// public FK (works fine through PostgREST, unlike reporter_id → auth.users
// below, which needs a separate profiles lookup, same workaround as
// listRewardRedemptions).
export async function listListingReports() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { reports: [], error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { data, error } = await supabaseAdmin
    .from('listing_reports')
    .select('id, listing_id, reporter_id, reason, created_at, listings(id, title, description, category, price, image_url, user_id, created_at)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return { reports: [], error: error.message }
  // listings è un oggetto (FK verso un solo annuncio), non un array come deduce supabase-js
  const rows = (data || []) as unknown as ListingReportRow[]

  // Reporter (auth.users FK, needs a separate lookup) and listing owner (full
  // name only shown here in the admin queue — public listing/user-facing
  // views only ever get first_name, see ListingDetailModal/page.tsx/
  // CommunityPreview.tsx) share one batched profiles query.
  const ownerIds = rows.map((r) => r.listings?.user_id).filter(Boolean)
  const profileIds = Array.from(new Set([...rows.map((r) => r.reporter_id), ...ownerIds].filter(Boolean)))
  const profiles = profileIds.length
    ? (await supabaseAdmin.from('profiles').select('id, first_name, last_name, email').in('id', profileIds)).data
    : []
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  const reports: ListingReport[] = rows.map((r) => ({
    ...r,
    reporter: byId[r.reporter_id] || null,
    owner: r.listings?.user_id ? byId[r.listings.user_id] || null : null,
  }))
  return { reports, error: null }
}

// Dismisses a single report without touching the listing (e.g. it turned out
// to be unfounded) — other reports on the same listing, if any, are untouched.
export async function dismissListingReport(reportId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { error } = await supabaseAdmin.from('listing_reports').delete().eq('id', reportId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Deletes the reported listing outright ("ban"). listing_reports.listing_id
// is ON DELETE CASCADE, so every report on it (from any reporter) is cleaned
// up automatically — no separate cleanup needed here.
export async function deleteReportedListing(listingId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { error } = await supabaseAdmin.from('listings').delete().eq('id', listingId)
  if (error) return { success: false, error: error.message }
  invalidateListingsCache()
  return { success: true }
}

// Kumano del Giorno — coda di moderazione. Una storia entra in rotazione
// (dashboard, /spotlight, home) solo da approvata; il trigger DB la rimette
// pending a ogni modifica del contenuto, quindi qui arrivano sia le nuove
// sia quelle modificate. Stesso permesso della Bacheca annunci: è
// moderazione di contenuti della community.
export async function listSpotlightProfilesForModeration() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { profiles: [], error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { data, error } = await supabaseAdmin
    .from('spotlight_profiles')
    .select('id, user_id, display_name, city, country, profession, story, story_locale, is_opted_in, show_on_home, moderation_status, updated_at')
    .order('moderation_status', { ascending: true })
    .order('updated_at', { ascending: false })
    .limit(300)

  if (error) return { profiles: [], error: error.message }
  const rows = data || []

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)))
  const profiles = userIds.length
    ? (await supabaseAdmin.from('profiles').select('id, first_name, last_name, email').in('id', userIds)).data
    : []
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]))

  return { profiles: rows.map((r) => ({ ...r, owner: byId[r.user_id] || null })), error: null }
}

export async function moderateSpotlightProfile(profileId: string, status: SpotlightModerationStatus) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const supabaseAdmin = getServiceClient()
  const { error } = await supabaseAdmin.from('spotlight_profiles').update({ moderation_status: status }).eq('id', profileId)
  if (error) return { success: false, error: error.message }

  // Un rifiuto deve sparire subito anche dalla landing cachata.
  updateTag(SPOTLIGHT_HOME_CACHE_TAG)
  return { success: true }
}

// Elenco utenti per il pannello admin (email inclusa): le colonne personali
// non sono più leggibili dal browser, nemmeno dagli admin.
export async function adminListUsers() {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { users: [], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient()
    .from('profiles')
    .select('id, first_name, last_name, email, referral_code, subscription_status, is_blocked, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return { users: [], error: error.message }
  return { users: data || [], error: null }
}

// Profilo completo di un utente per la modifica dal pannello admin.
export async function adminGetProfile(userId: string) {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { profile: null, error: 'Non autorizzato' }
  const { data, error } = await getServiceClient().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) return { profile: null, error: error.message }
  return { profile: data, error: null }
}

// ============================================================
// Account KUMANI: "sponsor" di chi si iscrive senza codice invito
// ============================================================

const readHouseAccountId = async () => {
  const { data } = await getServiceClient().from('system_settings').select('value').eq('key', 'house_account_id').maybeSingle()
  const raw = typeof data?.value === 'string' ? data.value.replace(/^"|"$/g, '') : ''
  return raw || null
}

export async function getHouseAccount() {
  const admin = await verifyAdmin('settings.read')
  if (!admin) return { account: null }
  const id = await readHouseAccountId()
  if (!id) return { account: null }
  const service = getServiceClient()
  const [{ data: profile }, { count: members }] = await Promise.all([
    service.from('profiles').select('id, first_name, last_name, email, referral_code').eq('id', id).maybeSingle(),
    service.from('profiles').select('id', { count: 'exact', head: true }).eq('signup_source', 'direct'),
  ])
  return { account: profile ? { ...profile, directMembers: members ?? 0 } : null }
}

// Crea l'account KUMANI: utente confermato (non serve che qualcuno ci
// entri), profilo con codice "KUMANI", radice propria in matrice, e lo
// imposta come house_account_id. Chi si iscrive senza invito finisce nella
// SUA struttura, mai in quella di un Kumano.
export async function createHouseAccount(email: string) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (await readHouseAccountId()) return { success: false, error: 'Account KUMANI già configurato' }

  const cleanEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) return { success: false, error: 'Email non valida' }

  const service = getServiceClient()
  const { data: created, error: authError } = await service.auth.admin.createUser({
    email: cleanEmail,
    password: randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: { first_name: 'KUMANI', last_name: 'Community' },
  })
  if (authError || !created.user) return { success: false, error: authError?.message || 'Creazione utente non riuscita' }
  const id = created.user.id

  const { error: profileError } = await service.from('profiles').insert({
    id,
    email: cleanEmail,
    username: 'kumani',
    first_name: 'KUMANI',
    last_name: 'Community',
    country_code: 'IT',
    referral_code: 'KUMANI',
    subscription_status: 'free',
    date_of_birth: '2000-01-01',
  })
  if (profileError) {
    await service.auth.admin.deleteUser(id)
    return { success: false, error: profileError.message }
  }

  const { error: nodeError } = await service.from('matrix_nodes').insert({
    user_id: id,
    parent_id: null,
    path: `root.${id.replace(/-/g, '_')}`,
    level: 1,
    position: 1,
    depth: 0,
  })
  if (nodeError) return { success: false, error: nodeError.message }

  const { error: settingError } = await service
    .from('system_settings')
    .upsert({ key: 'house_account_id', value: JSON.stringify(id) }, { onConflict: 'key' })
  if (settingError) return { success: false, error: settingError.message }

  return { success: true }
}

// ============================================================
// Gestione KU
// ============================================================

// Inizio del mese corrente in ora italiana, come ISO (per le statistiche).
const romeMonthStartIso = () => {
  const now = new Date()
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' })
      .formatToParts(now)
      .map((part) => [part.type, part.value])
  )
  // Mezzanotte del giorno 1 a Roma: +01:00 o +02:00 a seconda dell'ora legale.
  const probe = new Date(`${parts.year}-${parts.month}-01T12:00:00Z`)
  const romeHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(probe))
  const offset = romeHour - 12
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, 1, -offset)).toISOString()
}

export async function getKuManagement() {
  const admin = await verifyAdmin('settings.read')
  if (!admin) return { features: [], unlocks: [], stats: null, error: 'Non autorizzato' }

  const service = getServiceClient()
  const monthStart = romeMonthStartIso()
  const [{ data: features, error }, { data: unlocks }, { data: monthTx }, { data: purchases }] = await Promise.all([
    service.from('ku_features').select('key, enabled, config, updated_at').in('key', [...KU_FEATURE_KEYS]),
    service.from('ku_unlocks').select('key, tool, cost_ku, enabled').order('key'),
    service.from('ku_transactions').select('kind, ku_amount, details').gte('created_at', monthStart).limit(20000),
    service.from('ku_unlock_purchases').select('unlock_key'),
  ])
  if (error) return { features: [], unlocks: [], stats: null, error: error.message }

  const byKind: Record<string, { count: number; ku: number; points: number; discountEur: number }> = {}
  for (const tx of monthTx || []) {
    const entry = (byKind[tx.kind] ||= { count: 0, ku: 0, points: 0, discountEur: 0 })
    const details = (tx.details || {}) as { points?: number; status?: string; discount_eur?: number }
    if (tx.kind === 'renewal_discount' && details.status === 'failed') continue
    entry.count += 1
    entry.ku += tx.ku_amount
    entry.points += Number(details.points || 0)
    entry.discountEur += Number(details.discount_eur || 0)
  }
  const unlockOwners: Record<string, number> = {}
  for (const row of purchases || []) unlockOwners[row.unlock_key] = (unlockOwners[row.unlock_key] || 0) + 1

  // Ordine fisso 1-5 (il database li darebbe in ordine alfabetico)
  const ordered = [...(features || [])].sort((a, b) => KU_FEATURE_KEYS.indexOf(a.key as KuFeatureKey) - KU_FEATURE_KEYS.indexOf(b.key as KuFeatureKey))
  return { features: ordered, unlocks: unlocks || [], stats: { byKind, unlockOwners, monthStart }, error: null }
}

type KuConfigInput = Record<string, unknown>

const int = (value: unknown, min: number, max: number) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

// Valida e normalizza le impostazioni di ogni metodo prima di salvarle.
function normalizeKuConfig(key: string, config: KuConfigInput): Record<string, unknown> | null {
  switch (key) {
    case 'showcase': {
      const cost7 = int(config.cost_7d, 1, 100000)
      const cost15 = int(config.cost_15d, 1, 100000)
      return cost7 && cost15 ? { cost_7d: cost7, cost_15d: cost15 } : null
    }
    case 'unlocks':
      return {}
    case 'badges': {
      const levels = Array.isArray(config.levels) ? config.levels : []
      const clean = levels
        .map((level: { key?: unknown; threshold?: unknown }) => ({
          key: String(level.key || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30),
          threshold: int(level.threshold, 1, 10000000),
        }))
        .filter((level): level is { key: string; threshold: number } => !!level.key && level.threshold !== null)
      return clean.length ? { levels: clean.sort((a, b) => a.threshold - b.threshold) } : null
    }
    case 'renewal_discount': {
      const cost = int(config.cost_ku, 1, 1000000)
      const discount = int(config.discount_eur, 1, 48)
      const perYear = int(config.max_per_year, 1, 12)
      return cost && discount && perYear ? { cost_ku: cost, discount_eur: discount, max_per_year: perYear } : null
    }
    case 'conversion': {
      const perPoint = int(config.ku_per_point, 1, 100000)
      const max = int(config.max_points_per_month, 1, 1000)
      return perPoint && max ? { ku_per_point: perPoint, max_points_per_month: max } : null
    }
    default:
      return null
  }
}

export async function updateKuFeature(key: string, enabled: boolean, config: KuConfigInput) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const clean = normalizeKuConfig(key, config)
  if (!clean) return { success: false, error: 'Impostazioni non valide: controlla i valori.' }

  const { error } = await getServiceClient()
    .from('ku_features')
    .update({ enabled: !!enabled, config: clean, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateKuUnlock(key: string, costKu: number, enabled: boolean) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const cost = int(costKu, 1, 1000000)
  if (!cost) return { success: false, error: 'Costo non valido.' }
  const { error } = await getServiceClient().from('ku_unlocks').update({ cost_ku: cost, enabled: !!enabled }).eq('key', key)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Foto di un premio del Catalogo: caricata dal server (service role) nel
// bucket pubblico reward-images, dopo il controllo admin. Il browser la
// ridimensiona prima dell'invio (vedi AdminDashboard), qui si ricontrollano
// tipo e peso. Restituisce l'URL pubblico da salvare in image_url.
export async function uploadRewardImage(formData: FormData): Promise<{ success: true; url: string } | { success: false; error: string }> {
  const admin = await verifyAdmin('rewards.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, error: 'Nessun file ricevuto.' }
  const allowed: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = allowed[file.type]
  if (!ext) return { success: false, error: 'Formato non supportato: usa JPG, PNG o WEBP.' }
  if (file.size > 2 * 1024 * 1024) return { success: false, error: "Immagine troppo grande (massimo 2 MB)." }

  const path = `rewards/${randomBytes(12).toString('hex')}.${ext}`
  const service = getServiceClient()
  const { error } = await service.storage
    .from('reward-images')
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return { success: false, error: error.message }

  return { success: true, url: service.storage.from('reward-images').getPublicUrl(path).data.publicUrl }
}

// ============================================================
// Voucher per negozianti: lotti di voucher abbonamento
// ============================================================

export async function createVoucherBatch(input: {
  businessName: string
  quantity: number
  priceEur: number | null
  invoiceRef: string
  notes: string
  plan: 'base' | 'pro'
}): Promise<{ success: true; batchId: string } | { success: false; error: string }> {
  const admin = await verifyAdmin('vouchers.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }

  const businessName = input.businessName.trim().slice(0, 120)
  const quantity = Math.round(Number(input.quantity))
  const price = input.priceEur === null || Number.isNaN(Number(input.priceEur)) ? null : Math.round(Number(input.priceEur) * 100) / 100
  if (!businessName) return { success: false, error: "Indica il nome dell'attività." }
  if (!(quantity >= 1 && quantity <= 500)) return { success: false, error: 'Quantità tra 1 e 500.' }
  if (price !== null && price < 0) return { success: false, error: 'Prezzo non valido.' }
  const plan = input.plan === 'pro' ? 'pro' : 'base'

  const service = getServiceClient()
  const { data: batch, error } = await service
    .from('voucher_batches')
    .insert({
      business_name: businessName,
      quantity,
      price_eur: price,
      invoice_ref: input.invoiceRef.trim().slice(0, 80) || null,
      notes: input.notes.trim().slice(0, 500) || null,
      plan,
      created_by: admin.id,
    })
    .select('id')
    .single()
  if (error || !batch) return { success: false, error: error?.message || 'Errore nella creazione del lotto.' }

  // Codici generati tutti insieme; in caso (rarissimo) di codice già
  // esistente si rigenerano solo quelli in conflitto.
  let remaining = quantity
  for (let attempt = 0; attempt < 5 && remaining > 0; attempt++) {
    const rows = Array.from({ length: remaining }, () => ({
      code: 'KVA-' + generateSecureVoucherCode(),
      created_by: admin.id,
      status: 'active',
      batch_id: batch.id,
    }))
    const { error: insertError } = await service.from('subscription_vouchers').insert(rows)
    if (!insertError) {
      remaining = 0
      break
    }
    if (insertError.code !== '23505') return { success: false, error: insertError.message }
    const { count } = await service.from('subscription_vouchers').select('id', { count: 'exact', head: true }).eq('batch_id', batch.id)
    remaining = quantity - (count ?? 0)
  }
  if (remaining > 0) return { success: false, error: 'Impossibile generare tutti i codici. Riprova.' }

  return { success: true, batchId: batch.id }
}

export async function listVoucherBatches() {
  const admin = await verifyAdmin('vouchers.read')
  if (!admin) return { batches: [], error: 'Non autorizzato' }

  const service = getServiceClient()
  const [{ data: batches, error }, { data: codes }] = await Promise.all([
    service.from('voucher_batches').select('id, business_name, quantity, price_eur, invoice_ref, notes, plan, created_at').order('created_at', { ascending: false }),
    service.from('subscription_vouchers').select('batch_id, status').not('batch_id', 'is', null),
  ])
  if (error) return { batches: [], error: error.message }

  const used: Record<string, number> = {}
  for (const row of codes || []) if (row.status === 'redeemed') used[row.batch_id] = (used[row.batch_id] || 0) + 1
  return { batches: (batches || []).map((b) => ({ ...b, redeemed: used[b.id] || 0 })), error: null }
}

// Codici di un lotto (per CSV e cartoncini stampabili).
export async function getVoucherBatchCodes(batchId: string) {
  const admin = await verifyAdmin('vouchers.read')
  if (!admin) return { batch: null, codes: [] as { code: string; status: string; redeemed_at: string | null }[] }

  const service = getServiceClient()
  const [{ data: batch }, { data: codes }] = await Promise.all([
    service.from('voucher_batches').select('id, business_name, quantity, price_eur, invoice_ref, plan, created_at').eq('id', batchId).maybeSingle(),
    service.from('subscription_vouchers').select('code, status, redeemed_at').eq('batch_id', batchId).order('created_at'),
  ])
  return { batch, codes: codes || [] }
}

// Piano richiesto da uno strumento (Gratis / Base / Pro): vale subito per
// schede, dashboard, middleware e server (can_use_tool legge questo valore).
export async function updateToolPlan(toolName: string, plan: 'free' | 'base' | 'pro') {
  const admin = await verifyAdmin('marketplace.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!['free', 'base', 'pro'].includes(plan)) return { success: false, error: 'Piano non valido' }
  const { error } = await getServiceClient()
    .from('marketplace_settings')
    .update({ required_plan: plan, updated_at: new Date().toISOString() })
    .eq('tool_name', toolName)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Affinity Amicizie: segnalazioni degli utenti
// ============================================================

export async function listAffinityReports() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { reports: [], error: 'Non autorizzato' }
  const service = getServiceClient()
  const { data, error } = await service
    .from('affinity_reports')
    .select('id, reason, status, created_at, reporter:profiles!affinity_reports_reporter_fkey(id, first_name, last_name, email), reported:profiles!affinity_reports_reported_fkey(id, first_name, last_name, email, is_blocked)')
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { reports: [], error: error.message }
  return { reports: data ?? [], error: null }
}

// Chiude la segnalazione; con blockUser blocca anche l'account segnalato.
export async function resolveAffinityReport(reportId: string, blockUser: boolean) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const service = getServiceClient()
  const { data: report, error } = await service
    .from('affinity_reports')
    .update({ status: 'closed' })
    .eq('id', reportId)
    .select('reported')
    .single()
  if (error || !report) return { success: false, error: error?.message || 'Segnalazione non trovata' }
  if (blockUser) {
    const { error: blockError } = await service.from('profiles').update({ is_blocked: true }).eq('id', report.reported)
    if (blockError) return { success: false, error: blockError.message }
    // Accesso chiuso anche lato login (come dal pannello Utenti)
    const { error: banError } = await service.auth.admin.updateUserById(report.reported, { ban_duration: '876000h' })
    if (banError) return { success: true, warning: `Utente bloccato, ma l'accesso non è stato chiuso: ${banError.message}` }
  }
  return { success: true }
}

// ============================================================
// Convivio: segnalazioni e annullamento cordate
// ============================================================

export async function listConvivioReports() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { reports: [], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient()
    .from('convivio_reports')
    .select('id, reason, status, created_at, group:convivio_groups(id, title, status, supplier_name, leader:profiles!convivio_groups_leader_id_fkey(first_name, last_name, email)), reporter:profiles!convivio_reports_reporter_fkey(first_name, last_name, email)')
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { reports: [], error: error.message }
  return { reports: data ?? [], error: null }
}

// Chiude la segnalazione; con cancelGroup annulla anche la cordata.
export async function resolveConvivioReport(reportId: string, cancelGroup: boolean) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const service = getServiceClient()
  const { data: report, error } = await service.from('convivio_reports').update({ status: 'closed' }).eq('id', reportId).select('group_id').single()
  if (error || !report) return { success: false, error: error?.message || 'Segnalazione non trovata' }
  if (cancelGroup) {
    const { error: cancelError } = await service
      .from('convivio_groups')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', report.group_id)
      .in('status', ['open', 'ordered'])
    if (cancelError) return { success: false, error: cancelError.message }
    // Kordata annullata: la commissione del fornitore non è più dovuta
    const { error: feeError } = await service.from('convivio_fees').update({ status: 'waived' }).eq('group_id', report.group_id).eq('status', 'due')
    if (feeError) return { success: true, warning: `Kordata annullata, ma la commissione non è stata condonata: ${feeError.message}` }
  }
  return { success: true }
}

// ============================================================
// KUMANI Events: approvazione, segnalazioni, commissioni
// ============================================================

const EVENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AdminPerson = { id: string; first_name: string | null; last_name: string | null; email: string | null }

// Organizzatori e segnalatori puntano ad auth.users: i profili si leggono a parte.
async function eventPeople(ids: string[]): Promise<Record<string, AdminPerson>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return {}
  const { data } = await getServiceClient().from('profiles').select('id, first_name, last_name, email').in('id', unique)
  return Object.fromEntries((data ?? []).map((p) => [p.id, p as AdminPerson]))
}

export async function adminListEvents(filter: 'pending' | 'published' | 'reported' | 'closed') {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { events: [], error: 'Non autorizzato' }
  const service = getServiceClient()
  // Anche luogo esatto e link: lo Staff deve vedere cosa approva
  const columns =
    'id, organizer_id, title, description, type, mode, starts_at, ends_at, timezone, venue_name, address, city, country_code, map_link, online_link, languages, capacity, price, is_18plus, kids_friendly, status, review_note, created_at, series_id, fidelity_stamp'
  let query = service.from('events').select(columns)
  if (filter === 'reported') {
    const { data: reports } = await service.from('event_reports').select('event_id').eq('status', 'open').limit(500)
    const ids = [...new Set((reports ?? []).map((r) => r.event_id as string))]
    if (ids.length === 0) return { events: [], error: null }
    query = query.in('id', ids)
  } else if (filter === 'closed') {
    // Decisi: rifiutati, bloccati, annullati (per rivedere o sbloccare)
    query = query.in('status', ['rejected', 'banned', 'cancelled'])
  } else {
    query = query.eq('status', filter)
  }
  const { data, error } = await query.order('starts_at', { ascending: filter === 'pending' }).limit(200)
  if (error) return { events: [], error: error.message }
  const rows = data ?? []
  const counts: Record<string, number> = {}
  const [people] = await Promise.all([
    eventPeople(rows.map((e) => e.organizer_id as string)),
    (async () => {
      if (rows.length === 0) return
      const { data: participants } = await service
        .from('event_participants')
        .select('event_id')
        .in('event_id', rows.map((e) => e.id))
        .in('status', ['registered', 'checked_in', 'no_show'])
      for (const p of participants ?? []) counts[p.event_id] = (counts[p.event_id] ?? 0) + 1
    })(),
  ])
  return {
    events: rows.map((e) => ({ ...e, people: counts[e.id] ?? 0, organizer: people[e.organizer_id as string] ?? null })),
    error: null,
  }
}

// Approva (pubblica) o rifiuta con una nota un evento in attesa. Per le date
// ripetute la decisione vale per tutte le date della serie ancora in attesa.
export async function adminReviewEvent(eventId: string, approve: boolean, note: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(eventId)) return { success: false, error: 'Evento non valido' }
  const text = note.trim().slice(0, 1000)
  if (!approve && !text) return { success: false, error: 'Scrivi il motivo del rifiuto' }
  const service = getServiceClient()
  const changes = { status: approve ? 'published' : 'rejected', review_note: text || null, updated_at: new Date().toISOString() }
  // Versione vista dallo Staff: le date della serie modificate dopo (a parte)
  // restano in attesa e vanno riviste una per una.
  const { data: reviewed } = await service.from('events').select('series_id, updated_at').eq('id', eventId).eq('status', 'pending').maybeSingle()
  if (!reviewed) return { success: false, error: 'Evento non più in attesa' }
  const { data, error } = await service.from('events').update(changes).eq('id', eventId).eq('status', 'pending').select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Evento non più in attesa' }
  const approvedIds = [eventId]
  let warning: string | undefined
  if (reviewed.series_id) {
    const { data: siblings, error: seriesError } = await service
      .from('events')
      .update(changes)
      .eq('series_id', reviewed.series_id)
      .eq('status', 'pending')
      .lte('updated_at', reviewed.updated_at)
      .select('id')
    if (seriesError) warning = `Data approvata, ma le altre date della serie non sono state aggiornate: ${seriesError.message}`
    else approvedIds.push(...(siblings ?? []).map((s) => s.id as string))
  }
  // Pubblicato: chi era in lista d'attesa entra se ci sono posti
  if (approve) {
    for (const id of approvedIds) await service.rpc('event_promote_waitlist', { p_event: id })
  }
  return warning ? { success: true, warning } : { success: true }
}

// Blocca un evento (sparisce dal calendario e l'organizzatore non lo modifica
// più). Con wholeSeries blocca anche le date successive della stessa serie.
export async function adminBanEvent(eventId: string, note: string, wholeSeries = false) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(eventId)) return { success: false, error: 'Evento non valido' }
  const service = getServiceClient()
  const changes = { status: 'banned', review_note: note.trim().slice(0, 1000) || null, updated_at: new Date().toISOString() }
  const { data, error } = await service
    .from('events')
    .update(changes)
    .eq('id', eventId)
    .in('status', ['pending', 'published'])
    .select('series_id, starts_at')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Evento già chiuso (rifiutato, annullato o bloccato)' }
  if (wholeSeries && data[0].series_id) {
    const { error: seriesError } = await service
      .from('events')
      .update(changes)
      .eq('series_id', data[0].series_id)
      .in('status', ['pending', 'published'])
      .gt('starts_at', data[0].starts_at)
    if (seriesError) return { success: true, warning: `Data bloccata, ma non le successive: ${seriesError.message}` }
  }
  return { success: true }
}

// Sblocca un evento bloccato per errore (solo se non è ancora iniziato).
export async function adminUnbanEvent(eventId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(eventId)) return { success: false, error: 'Evento non valido' }
  const service = getServiceClient()
  const { data, error } = await service
    .from('events')
    .update({ status: 'published', review_note: null, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .eq('status', 'banned')
    .gt('starts_at', new Date().toISOString())
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'Solo eventi bloccati e non ancora iniziati si possono sbloccare' }
  await service.rpc('event_promote_waitlist', { p_event: eventId })
  return { success: true }
}

export async function adminListEventReports() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { reports: [], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient()
    .from('event_reports')
    .select('id, reason, status, created_at, reporter, event:events(id, title, status, organizer_id, starts_at)')
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { reports: [], error: error.message }
  const rows = (data ?? []) as unknown as {
    id: string
    reason: string
    status: 'open' | 'closed'
    created_at: string
    reporter: string
    event: { id: string; title: string; status: string; organizer_id: string; starts_at: string } | null
  }[]
  const people = await eventPeople(rows.flatMap((r) => [r.reporter, r.event?.organizer_id ?? '']))
  return {
    reports: rows.map((r) => ({ ...r, reporter: people[r.reporter] ?? null, organizer: r.event ? (people[r.event.organizer_id] ?? null) : null })),
    error: null,
  }
}

export async function adminResolveEventReport(reportId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(reportId)) return { success: false, error: 'Segnalazione non valida' }
  const { error } = await getServiceClient().from('event_reports').update({ status: 'closed' }).eq('id', reportId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function adminListEventFees() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { fees: [], error: 'Non autorizzato' }
  // Le commissioni nascono quando l'organizzatore torna su Events: qui si
  // calcolano anche per chi non è più rientrato dopo un evento a pagamento.
  const service = getServiceClient()
  const { data: unsettled } = await service
    .from('events')
    .select('organizer_id')
    .eq('status', 'published')
    .gt('price', 0)
    .gt('fee_percent', 0)
    .lt('starts_at', new Date().toISOString())
    .limit(1000)
  for (const organizerId of new Set((unsettled ?? []).map((e) => e.organizer_id as string))) {
    await service.rpc('events_settle_fees', { p_uid: organizerId })
  }
  const { data, error } = await service
    .from('event_fees')
    .select('id, organizer_id, participants, price, percent, amount, status, created_at, paid_at, event:events(id, title, starts_at)')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return { fees: [], error: error.message }
  const rows = (data ?? []) as unknown as {
    id: string
    organizer_id: string
    participants: number
    price: number
    percent: number
    amount: number
    status: 'due' | 'paid' | 'waived'
    created_at: string
    paid_at: string | null
    event: { id: string; title: string; starts_at: string } | null
  }[]
  const people = await eventPeople(rows.map((f) => f.organizer_id))
  return { fees: rows.map((f) => ({ ...f, organizer: people[f.organizer_id] ?? null })), error: null }
}

// Condona una commissione ancora da pagare.
export async function adminWaiveEventFee(feeId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(feeId)) return { success: false, error: 'Commissione non valida' }
  const { error } = await getServiceClient().from('event_fees').update({ status: 'waived' }).eq('id', feeId).eq('status', 'due')
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Percentuale trattenuta da KUMANI (system_settings 'events_fee_percent',
// salvata come stringa JSON, es. '"5"'): vale per gli eventi creati dopo.
// kind 'super': percentuale ridotta dei Super Organizer ('events_fee_percent_super', default 3)
const EVENT_FEE_KEYS = { standard: { key: 'events_fee_percent', fallback: 5 }, super: { key: 'events_fee_percent_super', fallback: 3 } } as const

export async function adminGetEventsFeePercent(kind: 'standard' | 'super' = 'standard') {
  const admin = await verifyAdmin('settings.read')
  if (!admin) return { percent: null, error: 'Non autorizzato' }
  const setting = EVENT_FEE_KEYS[kind] ?? EVENT_FEE_KEYS.standard
  const { data } = await getServiceClient().from('system_settings').select('value').eq('key', setting.key).maybeSingle()
  let percent: number = setting.fallback
  if (data?.value != null) {
    const raw = String(data.value)
    let parsed = Number.NaN
    try {
      parsed = Number(JSON.parse(raw))
    } catch {
      parsed = Number(raw.replace(/"/g, ''))
    }
    if (Number.isFinite(parsed)) percent = parsed
  }
  return { percent, error: null }
}

export async function adminSetEventsFeePercent(percent: number, kind: 'standard' | 'super' = 'standard') {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!Number.isFinite(percent) || percent < 0 || percent > 30) return { success: false, error: 'La percentuale deve essere tra 0 e 30' }
  const setting = EVENT_FEE_KEYS[kind] ?? EVENT_FEE_KEYS.standard
  const value = String(Math.round(percent * 100) / 100)
  const { error } = await getServiceClient()
    .from('system_settings')
    .upsert({ key: setting.key, value: JSON.stringify(value) }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Verifica d'identità con documento (chi non ha il codice fiscale italiano)
// ============================================================

const IDENTITY_BUCKET = 'identity-docs'

export type AdminIdentityVerification = {
  id: string
  user_id: string
  doc_type: 'passport' | 'id_card' | 'driving_license' | 'residence_permit'
  country_code: string
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  has_file: boolean
  is_pdf: boolean
  // Link temporaneo (10 minuti) solo per le richieste in attesa
  signed_url: string | null
  user: { first_name: string | null; last_name: string | null; email: string | null; date_of_birth: string | null } | null
  reviewer: AdminPerson | null
}

type IdentityRow = {
  id: string
  user_id: string
  doc_type: AdminIdentityVerification['doc_type']
  country_code: string
  file_path: string | null
  status: AdminIdentityVerification['status']
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
}

type IdentityProfile = { id: string; first_name: string | null; last_name: string | null; email: string | null; date_of_birth: string | null }

export async function adminListIdentityVerifications(status: 'pending' | 'reviewed') {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { items: [] as AdminIdentityVerification[], error: 'Non autorizzato' }
  const service = getServiceClient()
  const base = service
    .from('identity_verifications')
    .select('id, user_id, doc_type, country_code, file_path, status, review_note, created_at, reviewed_at, reviewed_by')
  const { data, error } = await (status === 'pending'
    ? base.eq('status', 'pending').order('created_at', { ascending: true })
    : base.neq('status', 'pending').order('reviewed_at', { ascending: false })
  ).limit(200)
  if (error) return { items: [] as AdminIdentityVerification[], error: error.message }
  const rows = (data ?? []) as IdentityRow[]
  // Documenti di richieste già decise rimasti nello storage (cancellazione
  // fallita in precedenza): si riprova qui, a ogni apertura della lista.
  const leftovers = rows.filter((r) => r.status !== 'pending' && r.file_path)
  if (leftovers.length > 0) {
    const { error: removeError } = await service.storage.from(IDENTITY_BUCKET).remove(leftovers.map((r) => r.file_path as string))
    if (!removeError) {
      await service.from('identity_verifications').update({ file_path: null }).in('id', leftovers.map((r) => r.id))
      for (const r of leftovers) r.file_path = null
    }
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))]
  const [profiles, reviewers] = await Promise.all([
    (async () => {
      if (userIds.length === 0) return [] as IdentityProfile[]
      const { data: found } = await service.from('profiles').select('id, first_name, last_name, email, date_of_birth').in('id', userIds)
      return (found ?? []) as IdentityProfile[]
    })(),
    eventPeople(rows.map((r) => r.reviewed_by ?? '')),
  ])
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]))

  const items = await Promise.all(
    rows.map(async (r): Promise<AdminIdentityVerification> => {
      let signedUrl: string | null = null
      if (r.status === 'pending' && r.file_path) {
        const { data: signed } = await service.storage.from(IDENTITY_BUCKET).createSignedUrl(r.file_path, 600)
        signedUrl = signed?.signedUrl ?? null
      }
      const p = byId[r.user_id]
      return {
        id: r.id,
        user_id: r.user_id,
        doc_type: r.doc_type,
        country_code: r.country_code,
        status: r.status,
        review_note: r.review_note,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        reviewed_by: r.reviewed_by,
        has_file: !!r.file_path,
        is_pdf: !!r.file_path && r.file_path.toLowerCase().endsWith('.pdf'),
        signed_url: signedUrl,
        user: p ? { first_name: p.first_name, last_name: p.last_name, email: p.email, date_of_birth: p.date_of_birth } : null,
        reviewer: r.reviewed_by ? (reviewers[r.reviewed_by] ?? null) : null,
      }
    }),
  )
  return { items, error: null }
}

// Approva o rifiuta (con nota obbligatoria) un documento; poi la foto si
// cancella dallo storage: resta solo l'esito.
export async function adminReviewIdentity(id: string, approve: boolean, note: string): Promise<{ success: boolean; error?: string; warning?: string }> {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(id)) return { success: false, error: 'Richiesta non valida' }
  const text = note.trim().slice(0, 1000)
  if (!approve && !text) return { success: false, error: 'Scrivi il motivo del rifiuto' }
  const service = getServiceClient()
  const { data, error } = await service
    .from('identity_verifications')
    .update({ status: approve ? 'approved' : 'rejected', review_note: text || null, reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, file_path')
  if (error) return { success: false, error: error.code === '23505' ? 'Questo utente ha già una richiesta approvata o in attesa' : error.message }
  if (!data?.length) return { success: false, error: 'Richiesta non più in attesa' }

  const filePath = data[0].file_path as string | null
  if (filePath) {
    const { error: removeError } = await service.storage.from(IDENTITY_BUCKET).remove([filePath])
    if (removeError) {
      console.error('[Admin] identity doc remove failed:', removeError.message)
      return { success: true, warning: 'Esito salvato, ma il file non è stato cancellato: riprova più tardi.' }
    }
    await service.from('identity_verifications').update({ file_path: null }).eq('id', id)
  }
  return { success: true }
}

// ============================================================
// Kordata: commissioni KUMANI a carico dei fornitori Pro
// ============================================================

export async function adminListConvivioFees() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { fees: [], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient()
    .from('convivio_fees')
    .select('id, supplier_id, quantity, price, percent, amount, status, created_at, paid_at, group:convivio_groups(id, title, status)')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return { fees: [], error: error.message }
  const rows = (data ?? []) as unknown as {
    id: string
    supplier_id: string
    quantity: number
    price: number
    percent: number
    amount: number
    status: 'due' | 'paid' | 'waived'
    created_at: string
    paid_at: string | null
    group: { id: string; title: string; status: string } | null
  }[]
  const supplierIds = [...new Set(rows.map((f) => f.supplier_id))]
  const people = await eventPeople(supplierIds)
  const { data: businesses } = supplierIds.length
    ? await getServiceClient()
        .from('convivio_suppliers')
        .select('user_id, business_name, vat_number, vat_status, vat_registered_name')
        .in('user_id', supplierIds)
    : { data: [] }
  const business = new Map(
    ((businesses ?? []) as {
      user_id: string
      business_name: string
      vat_number: string
      vat_status: 'unverified' | 'valid' | 'invalid'
      vat_registered_name: string | null
    }[]).map((b) => [b.user_id, b]),
  )
  return {
    fees: rows.map((f) => ({ ...f, supplier: people[f.supplier_id] ?? null, business: business.get(f.supplier_id) ?? null })),
    error: null,
  }
}

// Condona una commissione Kordata ancora da pagare.
export async function adminWaiveConvivioFee(feeId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(feeId)) return { success: false, error: 'Commissione non valida' }
  const { error } = await getServiceClient().from('convivio_fees').update({ status: 'waived' }).eq('id', feeId).eq('status', 'due')
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Percentuale trattenuta da KUMANI sulle Kordate (system_settings
// 'convivio_fee_percent', stringa JSON, es. '"3"'): si fissa su ogni Kordata
// quando il fornitore conferma.
export async function adminGetConvivioFeePercent() {
  const admin = await verifyAdmin('settings.read')
  if (!admin) return { percent: null, error: 'Non autorizzato' }
  const { data } = await getServiceClient().from('system_settings').select('value').eq('key', 'convivio_fee_percent').maybeSingle()
  let percent = 3
  if (data?.value != null) {
    const raw = String(data.value)
    let parsed = Number.NaN
    try {
      parsed = Number(JSON.parse(raw))
    } catch {
      parsed = Number(raw.replace(/"/g, ''))
    }
    if (Number.isFinite(parsed)) percent = parsed
  }
  return { percent, error: null }
}

export async function adminSetConvivioFeePercent(percent: number) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!Number.isFinite(percent) || percent < 0 || percent > 30) return { success: false, error: 'La percentuale deve essere tra 0 e 30' }
  const value = String(Math.round(percent * 100) / 100)
  const { error } = await getServiceClient()
    .from('system_settings')
    .upsert({ key: 'convivio_fee_percent', value: JSON.stringify(value) }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// KUMANI Events — Fase 2: recensioni (moderazione)
// ============================================================

export async function adminListEventReviews() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { reviews: [], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient()
    .from('event_reviews')
    .select('id, rating, comment, created_at, updated_at, reviewer, organizer_id, event:events(id, title, starts_at)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { reviews: [], error: error.message }
  const rows = (data ?? []) as unknown as {
    id: string
    rating: number
    comment: string | null
    created_at: string
    updated_at: string
    reviewer: string
    organizer_id: string
    event: { id: string; title: string; starts_at: string } | null
  }[]
  const people = await eventPeople(rows.flatMap((r) => [r.reviewer, r.organizer_id]))
  return {
    reviews: rows.map((r) => ({ ...r, reviewer: people[r.reviewer] ?? null, organizer: people[r.organizer_id] ?? null })),
    error: null,
  }
}

// Elimina una recensione (offensiva, falsa, fuori luogo): la media dell'organizzatore si ricalcola da sola.
export async function adminDeleteEventReview(reviewId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(reviewId)) return { success: false, error: 'Recensione non valida' }
  const { error } = await getServiceClient().from('event_reviews').delete().eq('id', reviewId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// Messaggi dal sito (modulo della pagina Contatti)
// ============================================================

export type AdminContactMessage = {
  id: string
  user_id: string | null
  name: string
  email: string
  topic: 'support' | 'billing' | 'pro' | 'partnership' | 'privacy' | 'other'
  message: string
  locale: string | null
  status: 'new' | 'handled'
  created_at: string
  handled_at: string | null
}

const CONTACT_MESSAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function adminListContactMessages(status: 'new' | 'handled' | 'all' = 'new') {
  const admin = await verifyAdmin('support.read')
  if (!admin) return { messages: [] as AdminContactMessage[], error: 'Non autorizzato' }
  let query = getServiceClient()
    .from('contact_messages')
    .select('id, user_id, name, email, topic, message, locale, status, created_at, handled_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) return { messages: [] as AdminContactMessage[], error: error.message }
  return { messages: (data ?? []) as AdminContactMessage[], error: null }
}

export async function adminSetContactMessageStatus(id: string, status: 'new' | 'handled') {
  const admin = await verifyAdmin('support.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!CONTACT_MESSAGE_ID_RE.test(id)) return { success: false, error: 'Messaggio non valido' }
  if (status !== 'new' && status !== 'handled') return { success: false, error: 'Stato non valido' }
  const { error } = await getServiceClient()
    .from('contact_messages')
    .update({ status, handled_at: status === 'handled' ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Richieste di cambio dati anagrafici (profilo completo = dati bloccati: li
// cambia solo lo Staff, su richiesta motivata dell'utente)
// ---------------------------------------------------------------------------
// Non esportata: un file 'use server' può esportare solo funzioni async.
const PROFILE_LOCKED_FIELDS = [
  'first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'country_code',
  'city', 'province', 'address', 'postal_code', 'occupation',
] as const
const PROFILE_LOCKED_SET = new Set<string>(PROFILE_LOCKED_FIELDS)

export type AdminProfileRequest = {
  id: string
  user_id: string
  reason: string
  requested: Record<string, string | null>
  previous: Record<string, string | null>
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  staff_note: string | null
  created_at: string
  reviewed_at: string | null
  user: {
    first_name: string | null
    last_name: string | null
    email: string | null
    has_tax_code: boolean
    current: Record<string, string | null>
  } | null
  reviewer: { first_name: string | null; last_name: string | null; email: string | null } | null
}

const PROFILE_REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function adminListProfileRequests(status: 'pending' | 'handled' = 'pending') {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { items: [] as AdminProfileRequest[], error: 'Non autorizzato' as string | null }
  const service = getServiceClient()
  let query = service
    .from('profile_change_requests')
    .select('id, user_id, reason, requested, previous, status, staff_note, created_at, reviewed_at, reviewed_by')
    .limit(200)
  query = status === 'pending'
    ? query.eq('status', 'pending').order('created_at', { ascending: true })
    : query.neq('status', 'pending').order('reviewed_at', { ascending: false, nullsFirst: false })
  const { data, error } = await query
  if (error) return { items: [] as AdminProfileRequest[], error: error.message as string | null }
  const rows = (data ?? []) as (Omit<AdminProfileRequest, 'user' | 'reviewer'> & { reviewed_by: string | null })[]

  const ids = [...new Set(rows.flatMap((r) => [r.user_id, r.reviewed_by]).filter((v): v is string => Boolean(v)))]
  const people = new Map<string, Record<string, unknown>>()
  if (ids.length > 0) {
    const { data: profileRows, error: profileError } = await service
      .from('profiles')
      .select(`id, email, tax_code, ${PROFILE_LOCKED_FIELDS.join(', ')}`)
      .in('id', ids)
    if (profileError) return { items: [] as AdminProfileRequest[], error: profileError.message as string | null }
    for (const p of (profileRows ?? []) as unknown as Record<string, unknown>[]) people.set(String(p.id), p)
  }
  const str = (v: unknown) => (v === null || v === undefined ? null : String(v))

  const items: AdminProfileRequest[] = rows.map(({ reviewed_by, ...r }) => {
    const u = people.get(r.user_id)
    const rev = reviewed_by ? people.get(reviewed_by) : undefined
    return {
      ...r,
      requested: r.requested ?? {},
      previous: r.previous ?? {},
      user: u
        ? {
            first_name: str(u.first_name),
            last_name: str(u.last_name),
            email: str(u.email),
            has_tax_code: Boolean(u.tax_code),
            current: Object.fromEntries(PROFILE_LOCKED_FIELDS.map((f) => [f, str(u[f])])),
          }
        : null,
      reviewer: rev ? { first_name: str(rev.first_name), last_name: str(rev.last_name), email: str(rev.email) } : null,
    }
  })
  return { items, error: null as string | null }
}

async function loadPendingProfileRequest(id: string) {
  if (typeof id !== 'string' || !PROFILE_REQUEST_ID_RE.test(id)) return { request: null, error: 'Richiesta non valida' }
  const { data, error } = await getServiceClient()
    .from('profile_change_requests')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle()
  if (error) return { request: null, error: error.message }
  if (!data) return { request: null, error: 'Richiesta non trovata' }
  if (data.status !== 'pending') return { request: null, error: 'La richiesta è già stata gestita' }
  return { request: data as { id: string; user_id: string; status: string }, error: null }
}

export async function adminApproveProfileRequest(id: string, values: Record<string, string>, note?: string) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const { request, error: loadError } = await loadPendingProfileRequest(id)
  if (!request) return { success: false, error: loadError ?? 'Richiesta non valida' }

  if (!values || typeof values !== 'object') return { success: false, error: 'Valori non validi' }
  const patch: Record<string, string> = {}
  for (const [field, raw] of Object.entries(values)) {
    if (!PROFILE_LOCKED_SET.has(field)) return { success: false, error: `Campo non modificabile: ${field}` }
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value) return { success: false, error: `Il campo ${field} non può essere vuoto` }
    if (value.length > 200) return { success: false, error: `Il campo ${field} è troppo lungo` }
    if (field === 'date_of_birth') {
      const parsed = new Date(`${value}T00:00:00Z`)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return { success: false, error: 'Data di nascita non valida (formato AAAA-MM-GG)' }
      }
    }
    patch[field] = field === 'country_code' ? value.toUpperCase() : value
  }
  if (Object.keys(patch).length === 0) return { success: false, error: 'Nessun valore da applicare' }

  const service = getServiceClient()
  // Client di servizio: il blocco del profilo vale solo per l'utente, e
  // profile_completed_at resta invariato.
  const { error: profileError } = await service.from('profiles').update(patch).eq('id', request.user_id)
  if (profileError) return { success: false, error: profileError.message }

  const { error } = await service
    .from('profile_change_requests')
    .update({
      status: 'approved',
      staff_note: note?.trim() ? note.trim().slice(0, 1000) : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

async function closeProfileRequest(id: string, status: 'rejected' | 'cancelled', note: string | undefined, noteRequired: boolean) {
  const admin = await verifyAdmin('users.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const cleanNote = (typeof note === 'string' ? note : '').trim().slice(0, 1000)
  if (noteRequired && !cleanNote) return { success: false, error: "Scrivi il motivo (lo vede l'utente)" }
  const { request, error: loadError } = await loadPendingProfileRequest(id)
  if (!request) return { success: false, error: loadError ?? 'Richiesta non valida' }
  const { error } = await getServiceClient()
    .from('profile_change_requests')
    .update({
      status,
      staff_note: cleanNote || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('id', id)
    .eq('status', 'pending')
  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function adminRejectProfileRequest(id: string, note: string) {
  return closeProfileRequest(id, 'rejected', note, true)
}

export async function adminCancelProfileRequest(id: string, note?: string) {
  return closeProfileRequest(id, 'cancelled', note, false)
}

// ============================================================
// Cancellazione dell'account (GDPR, art. 17)
// ============================================================

export type AdminDeletionRequest = {
  id: string
  user_id: string | null
  reason: string | null
  status: 'pending' | 'completed' | 'cancelled'
  requested_at: string
  processed_at: string | null
  staff_note: string | null
  user: {
    first_name: string | null
    last_name: string | null
    email: string | null
    created_at: string | null
    subscription_status: string | null
    subscription_source: string | null
    subscription_expires_at: string | null
    is_admin: boolean
    deleted_at: string | null
    invitees: number
  } | null
  processor: AdminPerson | null
}

type DeletionRow = Omit<AdminDeletionRequest, 'user' | 'processor'> & { processed_by: string | null }

const DELETION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Bucket dove i file dell'utente stanno nella cartella `${userId}/`.
// Cartelle "<userId>/…" da svuotare alla cancellazione dell'account
// (reward-images contiene solo immagini caricate dallo Staff)
const USER_FILE_BUCKETS = ['identity-docs', 'cv-photos', 'quote-logos-v2', 'menu-photos', 'findo-photos', 'receipt-photos-v2']
const DELETED_EMAIL_RE = /@deleted\.invalid$/i

export async function adminListDeletionRequests(status: 'pending' | 'handled' = 'pending') {
  const admin = await verifyAdmin('users.read')
  if (!admin) return { items: [] as AdminDeletionRequest[], error: 'Non autorizzato' as string | null }
  const service = getServiceClient()
  let query = service
    .from('account_deletion_requests')
    .select('id, user_id, reason, status, requested_at, processed_at, processed_by, staff_note')
    .limit(200)
  query = status === 'pending'
    ? query.eq('status', 'pending').order('requested_at', { ascending: true })
    : query.neq('status', 'pending').order('processed_at', { ascending: false, nullsFirst: false })
  const { data, error } = await query
  if (error) return { items: [] as AdminDeletionRequest[], error: error.message as string | null }
  const rows = (data ?? []) as DeletionRow[]

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => Boolean(v)))]
  type DeletionProfile = {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    created_at: string | null
    subscription_status: string | null
    subscription_source: string | null
    subscription_expires_at: string | null
    is_admin: boolean | null
    deleted_at: string | null
  }
  const [profiles, processors, invitees] = await Promise.all([
    (async () => {
      if (userIds.length === 0) return [] as DeletionProfile[]
      const { data: found } = await service
        .from('profiles')
        .select('id, first_name, last_name, email, created_at, subscription_status, subscription_source, subscription_expires_at, is_admin, deleted_at')
        .in('id', userIds)
      return (found ?? []) as DeletionProfile[]
    })(),
    eventPeople(rows.map((r) => r.processed_by ?? '')),
    Promise.all(
      userIds.map(async (id) => {
        const { count } = await service.from('profiles').select('id', { count: 'exact', head: true }).eq('sponsor_id', id)
        return [id, count ?? 0] as const
      }),
    ),
  ])
  const byId = new Map(profiles.map((p) => [p.id, p]))
  const inviteesById = new Map(invitees)

  const items: AdminDeletionRequest[] = rows.map(({ processed_by, ...r }) => {
    const p = r.user_id ? byId.get(r.user_id) : undefined
    return {
      ...r,
      user: p
        ? {
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            created_at: p.created_at,
            subscription_status: p.subscription_status,
            subscription_source: p.subscription_source,
            subscription_expires_at: p.subscription_expires_at,
            is_admin: Boolean(p.is_admin),
            deleted_at: p.deleted_at,
            invitees: inviteesById.get(p.id) ?? 0,
          }
        : null,
      processor: processed_by ? (processors[processed_by] ?? null) : null,
    }
  })
  return { items, error: null as string | null }
}

async function loadPendingDeletionRequest(id: string) {
  if (typeof id !== 'string' || !DELETION_ID_RE.test(id)) return { request: null, error: 'Richiesta non valida' }
  const { data, error } = await getServiceClient()
    .from('account_deletion_requests')
    .select('id, user_id, status')
    .eq('id', id)
    .maybeSingle()
  if (error) return { request: null, error: error.message }
  if (!data) return { request: null, error: 'Richiesta non trovata' }
  if (data.status !== 'pending') return { request: null, error: 'La richiesta è già stata gestita' }
  return { request: data as { id: string; user_id: string | null; status: string }, error: null }
}

// Cancella TUTTI gli abbonamenti Stripe in corso dell'utente (per email del
// cliente e per metadata.userId), subito e senza rimborso del periodo residuo.
async function cancelStripeSubscriptionsFor(userId: string, emails: string[]) {
  const stripe = getStripe()
  const live = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete'])
  const toCancel = new Set<string>()

  for (const email of emails) {
    const customers = await stripe.customers.list({ email, limit: 100 })
    for (const customer of customers.data) {
      for await (const sub of stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 100 })) {
        if (live.has(sub.status)) toCancel.add(sub.id)
      }
    }
  }
  // Abbonamenti legati all'utente ma su un cliente con un'altra email
  try {
    const found = await stripe.subscriptions.search({ query: `metadata['userId']:'${userId}'`, limit: 100 })
    for (const sub of found.data) if (live.has(sub.status)) toCancel.add(sub.id)
  } catch (err) {
    // La ricerca non è disponibile in tutte le regioni: basta la ricerca per email
    console.error('[Admin] stripe subscriptions.search failed:', err instanceof Error ? err.message : err)
  }

  for (const id of toCancel) {
    await stripe.subscriptions.cancel(id, { invoice_now: false, prorate: false })
  }
  return toCancel.size
}

async function removeUserFolder(bucket: string, userId: string) {
  const storage = getServiceClient().storage.from(bucket)
  let removed = 0
  // Si ripete finché la cartella risulta vuota (list restituisce pagine limitate)
  for (let round = 0; round < 20; round++) {
    const { data, error } = await storage.list(userId, { limit: 1000 })
    // Bucket inesistente in questo ambiente: niente da cancellare
    if (error && /not.?found/i.test(error.message)) break
    if (error) throw new Error(error.message)
    const paths = (data ?? []).filter((f) => f.name && f.id).map((f) => `${userId}/${f.name}`)
    if (paths.length === 0) break
    const { error: removeError } = await storage.remove(paths)
    if (removeError) throw new Error(removeError.message)
    removed += paths.length
    if (paths.length < 1000) break
  }
  return removed
}

// Esegue la cancellazione: abbonamenti Stripe, file, anonimizzazione del
// profilo e chiusura dell'accesso. Ogni passo è ripetibile: se qualcosa
// fallisce la richiesta resta in attesa e si può rilanciare.
export async function adminExecuteDeletion(
  requestId: string,
  note: string,
): Promise<{ success: boolean; error?: string; warnings?: string[] }> {
  const admin = await verifyAdmin('users.delete')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const { request, error: loadError } = await loadPendingDeletionRequest(requestId)
  if (!request) return { success: false, error: loadError ?? 'Richiesta non valida' }
  const userId = request.user_id
  if (!userId) return { success: false, error: "L'account collegato alla richiesta non esiste più" }
  if (userId === admin.id) return { success: false, error: 'Non puoi eseguire la cancellazione del tuo account' }
  if (await isFullAdmin(userId)) {
    return { success: false, error: "L'utente è un amministratore completo: togli prima i privilegi di amministratore" }
  }

  const service = getServiceClient()
  const warnings: string[] = []
  const cleanNote = (typeof note === 'string' ? note : '').trim().slice(0, 1000)

  // 1. Email (dall'accesso e dal profilo: se un tentativo precedente ha già
  //    anonimizzato il profilo, l'email originale resta nell'account auth)
  const [{ data: authData, error: authError }, { data: profile }] = await Promise.all([
    service.auth.admin.getUserById(userId),
    service.from('profiles').select('email').eq('id', userId).maybeSingle(),
  ])
  if (authError && !/not.?found/i.test(authError.message)) return { success: false, error: `Lettura account: ${authError.message}` }
  const authUser = authData?.user ?? null
  const emails = [
    ...new Set(
      [authUser?.email, profile?.email as string | null | undefined]
        .filter((e): e is string => typeof e === 'string' && e.includes('@') && !DELETED_EMAIL_RE.test(e))
        .flatMap((e) => [e.trim(), e.trim().toLowerCase()]),
    ),
  ]
  const originalEmail = emails[0]?.toLowerCase() ?? null
  const emailHash = originalEmail ? createHash('sha256').update(originalEmail).digest('hex') : null

  // 2. Abbonamenti Stripe: se fallisce ci si ferma (nulla è stato ancora
  //    modificato) per non continuare ad addebitare un account cancellato.
  try {
    if (process.env.STRIPE_SECRET_KEY) {
      const cancelled = await cancelStripeSubscriptionsFor(userId, emails)
      if (cancelled > 0) warnings.push(`Abbonamenti Stripe annullati: ${cancelled}`)
    } else {
      warnings.push('Stripe non configurato: verifica a mano che non ci siano abbonamenti attivi')
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Admin] account deletion stripe failed:', message)
    return { success: false, error: `Annullamento abbonamento Stripe non riuscito (nessun dato modificato): ${message}` }
  }

  // 3. File negli storage (best effort)
  for (const bucket of USER_FILE_BUCKETS) {
    try {
      await removeUserFolder(bucket, userId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[Admin] account deletion storage ${bucket} failed:`, message)
      warnings.push(`File non cancellati nel bucket ${bucket}: ${message}`)
    }
  }

  // Eventuale ruolo Staff (non completo): tolto prima di chiudere l'account
  const { error: roleError } = await service.from('admin_users').delete().eq('user_id', userId)
  if (roleError) warnings.push(`Ruolo Staff non rimosso: ${roleError.message}`)

  // 4. Anonimizzazione del profilo e dei contenuti (atomica, in SQL)
  const { error: anonymizeError } = await service.rpc('account_anonymize', { p_uid: userId })
  if (anonymizeError) {
    console.error('[Admin] account_anonymize failed:', anonymizeError.message)
    return { success: false, error: `Anonimizzazione non riuscita: ${anonymizeError.message}`, warnings }
  }

  // 5. Chiusura dell'accesso: email e password sostituite, metadati svuotati,
  //    account bannato (le sessioni aperte non possono più rinnovarsi).
  if (authUser) {
    const clearedMetadata = Object.fromEntries(Object.keys(authUser.user_metadata ?? {}).map((key) => [key, null]))
    const { error: closeError } = await service.auth.admin.updateUserById(userId, {
      email: `deleted-${userId}@deleted.invalid`,
      email_confirm: true,
      password: randomBytes(32).toString('base64url'),
      user_metadata: clearedMetadata,
      ban_duration: '876000h',
    })
    if (closeError) {
      console.error('[Admin] account deletion auth close failed:', closeError.message)
      return {
        success: false,
        error: `Profilo anonimizzato, ma la chiusura dell'accesso non è riuscita (${closeError.message}). La richiesta resta in attesa: riprova "Esegui cancellazione".`,
        warnings,
      }
    }
  } else {
    warnings.push('Account di accesso non trovato: già chiuso')
  }

  // 6. Richiesta completata
  const update: Record<string, unknown> = {
    status: 'completed',
    processed_at: new Date().toISOString(),
    processed_by: admin.id,
    staff_note: cleanNote || null,
  }
  if (emailHash) update.email_hash = emailHash
  const { error: doneError } = await service
    .from('account_deletion_requests')
    .update(update)
    .eq('id', request.id)
    .eq('status', 'pending')
  if (doneError) {
    console.error('[Admin] account deletion request update failed:', doneError.message)
    warnings.push(`Account cancellato, ma la richiesta non è stata segnata come completata: ${doneError.message}`)
  }
  return { success: true, warnings }
}

export async function adminCancelDeletion(requestId: string, note: string) {
  const admin = (await verifyAdmin('users.delete')) ?? (await verifyAdmin('users.write'))
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const cleanNote = (typeof note === 'string' ? note : '').trim().slice(0, 1000)
  const { request, error: loadError } = await loadPendingDeletionRequest(requestId)
  if (!request) return { success: false, error: loadError ?? 'Richiesta non valida' }
  const { data, error } = await getServiceClient()
    .from('account_deletion_requests')
    .update({ status: 'cancelled', processed_at: new Date().toISOString(), processed_by: admin.id, staff_note: cleanNote || null })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select('id')
  if (error) return { success: false, error: error.message }
  if (!data?.length) return { success: false, error: 'La richiesta è già stata gestita' }
  return { success: true, error: null }
}

// ============================================================
// KUMANI Time Bank: contestazioni, segnalazioni, annunci
// ============================================================

export async function adminListTimebank(view: 'disputes' | 'reports' | 'exchanges' | 'posts') {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { rows: [] as Record<string, unknown>[], error: 'Non autorizzato' }
  const service = getServiceClient()
  if (view === 'reports') {
    const { data, error } = await service
      .from('timebank_reports')
      .select('id, reporter, target_user, post_id, exchange_id, reason, status, created_at, post:timebank_posts(title)')
      .order('status', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return { rows: [], error: error.message }
    const rows = (data ?? []) as unknown as { reporter: string; target_user: string | null }[]
    const people = await eventPeople(rows.flatMap((r) => [r.reporter, r.target_user ?? '']))
    return {
      rows: rows.map((r) => ({ ...r, reporter_person: people[r.reporter] ?? null, target_person: r.target_user ? (people[r.target_user] ?? null) : null })),
      error: null,
    }
  }
  if (view === 'posts') {
    const { data, error } = await service
      .from('timebank_posts')
      .select('id, user_id, kind, title, description, category, hours, mode, city, status, created_at')
      .neq('status', 'removed')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) return { rows: [], error: error.message }
    const rows = (data ?? []) as { user_id: string }[]
    const people = await eventPeople(rows.map((r) => r.user_id))
    return { rows: rows.map((r) => ({ ...r, person: people[r.user_id] ?? null })), error: null }
  }
  let query = service
    .from('timebank_exchanges')
    .select('id, giver_id, receiver_id, hours, status, note, scheduled_on, dispute_reason, dispute_by, staff_note, created_at, completed_at, post:timebank_posts(title)')
  query = view === 'disputes' ? query.eq('status', 'disputed') : query
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200)
  if (error) return { rows: [], error: error.message }
  const rows = (data ?? []) as unknown as { giver_id: string; receiver_id: string }[]
  const people = await eventPeople(rows.flatMap((r) => [r.giver_id, r.receiver_id]))
  return { rows: rows.map((r) => ({ ...r, giver: people[r.giver_id] ?? null, receiver: people[r.receiver_id] ?? null })), error: null }
}

// Decisione su una contestazione: completare (le ore passano) o annullare
export async function adminResolveTimebankDispute(exchangeId: string, complete: boolean, note: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(exchangeId)) return { success: false, error: 'Scambio non valido' }
  const { data, error } = await getServiceClient().rpc('timebank_admin_resolve', { p_exchange: exchangeId, p_complete: complete, p_note: note.trim().slice(0, 1000) })
  if (error) return { success: false, error: error.message }
  if (data !== 'ok') return { success: false, error: 'Contestazione non più aperta' }
  return { success: true }
}

export async function adminCloseTimebankReport(reportId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(reportId)) return { success: false, error: 'Segnalazione non valida' }
  const { error } = await getServiceClient().from('timebank_reports').update({ status: 'closed' }).eq('id', reportId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function adminRemoveTimebankPost(postId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(postId)) return { success: false, error: 'Annuncio non valido' }
  const { error } = await getServiceClient().from('timebank_posts').update({ status: 'removed', updated_at: new Date().toISOString() }).eq('id', postId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============================================================
// KUMANI Mosaic: stagioni e moderazione
// ============================================================

export type MosaicAdminSeason = {
  id: string
  title: string
  theme: string | null
  width: number
  height: number
  starts_at: string
  ends_at: string
  filled: number
  contributors: number
  current: boolean
}

export async function adminListMosaicSeasons() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { seasons: [] as MosaicAdminSeason[], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient().rpc('mosaic_admin_seasons')
  return { seasons: (data ?? []) as MosaicAdminSeason[], error: error?.message ?? null }
}

export async function adminListMosaicContributors(seasonId: string) {
  const admin = await verifyAdmin('listings.read')
  if (!admin || !EVENT_ID_RE.test(seasonId)) return { rows: [] as Record<string, unknown>[], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient().rpc('mosaic_admin_contributors', { p_season: seasonId })
  return { rows: (data ?? []) as Record<string, unknown>[], error: error?.message ?? null }
}

// Nuova stagione o modifica. La dimensione si cambia solo finché la tela è
// vuota; due stagioni non possono sovrapporsi.
export async function adminSaveMosaicSeason(
  seasonId: string | null,
  input: { title: string; theme: string; width: number; height: number; startsAt: string; endsAt: string },
) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (seasonId && !EVENT_ID_RE.test(seasonId)) return { success: false, error: 'Stagione non valida' }
  const title = input.title.trim().slice(0, 80)
  const theme = input.theme.trim().slice(0, 200)
  const starts = new Date(input.startsAt)
  const ends = new Date(input.endsAt)
  if (!title) return { success: false, error: 'Serve un titolo' }
  if (![input.width, input.height].every((n) => Number.isInteger(n) && n >= 16 && n <= 256)) {
    return { success: false, error: 'La tela va da 16 a 256 caselle per lato' }
  }
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) {
    return { success: false, error: 'Date non valide: la fine deve essere dopo l’inizio' }
  }
  const service = getServiceClient()
  let overlap = service.from('mosaic_seasons').select('id, title').lt('starts_at', ends.toISOString()).gt('ends_at', starts.toISOString())
  if (seasonId) overlap = overlap.neq('id', seasonId)
  const { data: clash } = await overlap.limit(1)
  if (clash?.length) return { success: false, error: `Le date si sovrappongono alla stagione "${clash[0].title}"` }
  const row = { title, theme: theme || null, width: input.width, height: input.height, starts_at: starts.toISOString(), ends_at: ends.toISOString() }
  if (!seasonId) {
    const { error } = await service.from('mosaic_seasons').insert(row)
    return error ? { success: false, error: error.message } : { success: true }
  }
  const { data: current } = await service.from('mosaic_seasons').select('width, height').eq('id', seasonId).maybeSingle()
  if (!current) return { success: false, error: 'Stagione non trovata' }
  const resized = current.width !== input.width || current.height !== input.height
  if (resized) {
    const { count } = await service.from('mosaic_pixels').select('season_id', { count: 'exact', head: true }).eq('season_id', seasonId)
    if (count) return { success: false, error: 'La tela ha già delle tessere: la dimensione non si può più cambiare' }
  }
  // Con una nuova dimensione la sagoma non combacia più: si toglie, e si
  // eliminano le zone protette che escono dalla tela
  const { error } = await service
    .from('mosaic_seasons')
    .update(resized ? { ...row, template: null } : row)
    .eq('id', seasonId)
  if (error) return { success: false, error: error.message }
  if (resized) {
    const { data: zones } = await service.from('mosaic_zones').select('id, x, y, w, h').eq('season_id', seasonId)
    const outside = (zones ?? []).filter((z) => z.x + z.w > input.width || z.y + z.h > input.height).map((z) => z.id as string)
    if (outside.length) await service.from('mosaic_zones').delete().in('id', outside)
  }
  return { success: true }
}

export async function adminDeleteMosaicSeason(seasonId: string) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(seasonId)) return { success: false, error: 'Stagione non valida' }
  const { error } = await getServiceClient().from('mosaic_seasons').delete().eq('id', seasonId)
  return error ? { success: false, error: error.message } : { success: true }
}

// Vandalismo: toglie tutte le tessere di una persona nella stagione
export async function adminClearMosaicUser(seasonId: string, userId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(seasonId) || !EVENT_ID_RE.test(userId)) return { success: false, error: 'Dati non validi' }
  const { data, error } = await getServiceClient().rpc('mosaic_admin_clear_user', { p_season: seasonId, p_user: userId })
  return error ? { success: false, error: error.message } : { success: true, removed: Number(data ?? 0) }
}

// ------------------------------------------------------------
// KUMANI Mosaic: editor dello Staff (tela, zone, sagoma, segnalazioni)
// ------------------------------------------------------------

type MosaicRect = { x: number; y: number; w: number; h: number }
const validRect = (r: MosaicRect) =>
  [r.x, r.y, r.w, r.h].every(Number.isInteger) && r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.w <= 256 && r.h <= 256

export async function adminGetMosaicEditor(seasonId: string) {
  const admin = await verifyAdmin('listings.read')
  if (!admin || !EVENT_ID_RE.test(seasonId)) return { data: null, error: 'Non autorizzato' }
  const { data, error } = await getServiceClient().rpc('mosaic_admin_canvas', { p_season: seasonId })
  return {
    data: data as { canvas: string | null; template: string | null; zones: { id: string; x: number; y: number; w: number; h: number; label: string | null }[] } | null,
    error: error?.message ?? null,
  }
}

export async function adminMosaicAreaPeople(seasonId: string, rect: MosaicRect) {
  const admin = await verifyAdmin('listings.read')
  if (!admin || !EVENT_ID_RE.test(seasonId) || !validRect(rect)) return { rows: [] as Record<string, unknown>[], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient().rpc('mosaic_admin_area_people', { p_season: seasonId, p_x: rect.x, p_y: rect.y, p_w: rect.w, p_h: rect.h })
  return { rows: (data ?? []) as Record<string, unknown>[], error: error?.message ?? null }
}

export async function adminMosaicClearArea(seasonId: string, rect: MosaicRect) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(seasonId) || !validRect(rect)) return { success: false, error: 'Area non valida' }
  const { data, error } = await getServiceClient().rpc('mosaic_admin_clear_area', { p_season: seasonId, p_x: rect.x, p_y: rect.y, p_w: rect.w, p_h: rect.h })
  return error ? { success: false, error: error.message } : { success: true, removed: Number(data ?? 0) }
}

// Disegno dello Staff: c = colore 0..31, -1 = cancella
export async function adminMosaicPaint(seasonId: string, cells: { x: number; y: number; c: number }[]) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(seasonId) || !Array.isArray(cells) || cells.length === 0 || cells.length > 20000) return { success: false, error: 'Disegno non valido' }
  const clean = cells.filter((c) => [c.x, c.y, c.c].every(Number.isInteger) && c.c >= -1 && c.c <= 31).map(({ x, y, c }) => ({ x, y, c }))
  const { data, error } = await getServiceClient().rpc('mosaic_admin_paint', { p_season: seasonId, p_cells: clean })
  if (error) return { success: false, error: error.message }
  if (Number(data) < 0) return { success: false, error: 'Stagione non trovata' }
  return { success: true, painted: Number(data) }
}

export async function adminMosaicSetTemplate(seasonId: string, template: string | null) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(seasonId) || (template !== null && (template.length > 100000 || !/^[A-Za-z0-9+/=]+$/.test(template)))) {
    return { success: false, error: 'Sagoma non valida' }
  }
  const { data, error } = await getServiceClient().rpc('mosaic_admin_set_template', { p_season: seasonId, p_template: template })
  if (error) return { success: false, error: error.message }
  if (data !== 'ok') return { success: false, error: data === 'size' ? 'La sagoma non ha la dimensione della tela' : 'Stagione non trovata' }
  return { success: true }
}

export async function adminMosaicAddZone(seasonId: string, rect: MosaicRect, label: string) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(seasonId) || !validRect(rect)) return { success: false, error: 'Area non valida' }
  const { error } = await getServiceClient()
    .from('mosaic_zones')
    .insert({ season_id: seasonId, x: rect.x, y: rect.y, w: rect.w, h: rect.h, label: label.trim().slice(0, 60) || null })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function adminMosaicDeleteZone(zoneId: string) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(zoneId)) return { success: false, error: 'Zona non valida' }
  const { error } = await getServiceClient().from('mosaic_zones').delete().eq('id', zoneId)
  return error ? { success: false, error: error.message } : { success: true }
}

export type MosaicAdminReport = {
  id: string
  season_id: string
  season_title: string
  x: number
  y: number
  w: number
  h: number
  reason: string
  note: string | null
  status: string
  created_at: string
  reporter_name: string
}

export async function adminListMosaicReports() {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { reports: [] as MosaicAdminReport[], error: 'Non autorizzato' }
  const service = getServiceClient()
  const { data, error } = await service
    .from('mosaic_reports')
    .select('id, season_id, reporter, x, y, w, h, reason, note, status, created_at, season:mosaic_seasons(title)')
    .order('status', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { reports: [] as MosaicAdminReport[], error: error.message }
  const rows = (data ?? []) as unknown as (Omit<MosaicAdminReport, 'season_title' | 'reporter_name'> & { reporter: string | null; season: { title: string } | null })[]
  const ids = [...new Set(rows.map((r) => r.reporter).filter((id): id is string => !!id))]
  const { data: people } = ids.length ? await service.from('profiles').select('id, first_name, last_name, email').in('id', ids) : { data: [] }
  const names = new Map((people ?? []).map((p) => [p.id as string, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email as string) || '—']))
  return {
    reports: rows.map(({ reporter, season, ...r }) => ({ ...r, season_title: season?.title ?? '—', reporter_name: (reporter && names.get(reporter)) || '—' })),
    error: null,
  }
}

export async function adminCloseMosaicReport(reportId: string) {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(reportId)) return { success: false, error: 'Segnalazione non valida' }
  const { error } = await getServiceClient().from('mosaic_reports').update({ status: 'closed' }).eq('id', reportId)
  return error ? { success: false, error: error.message } : { success: true }
}

// ============================================================
// Kumani Fabula: storie in attesa, nascoste, segnalate e parole filtrate
// ============================================================

export async function adminListFabula(view: 'pending' | 'hidden' | 'published' | 'words') {
  const admin = await verifyAdmin('listings.read')
  if (!admin) return { rows: [] as Record<string, unknown>[], error: 'Non autorizzato' }
  const service = getServiceClient()
  if (view === 'words') {
    const { data, error } = await service.from('fabula_banned_words').select('word').order('word')
    return { rows: (data ?? []) as Record<string, unknown>[], error: error?.message ?? null }
  }
  const { data, error } = await service
    .from('fabula_stories')
    .select('id, user_id, roll_date, dice, title, body, locale, status, created_at, updated_at, reports:fabula_reports(id, reason, status)')
    .eq('status', view)
    .order('updated_at', { ascending: false })
    .limit(200)
  if (error) return { rows: [] as Record<string, unknown>[], error: error.message }
  const rows = (data ?? []) as Record<string, unknown>[]
  const ids = [...new Set(rows.map((r) => r.user_id as string))]
  const { data: people } = ids.length ? await service.from('profiles').select('id, first_name, last_name, email').in('id', ids) : { data: [] }
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]))
  return { rows: rows.map((r) => ({ ...r, author: byId.get(r.user_id as string) ?? null })), error: null }
}

// Decisione dello Staff su una storia: pubblicarla, rimuoverla o renderla privata;
// le segnalazioni aperte si chiudono
export async function adminSetFabulaStatus(storyId: string, status: 'published' | 'removed' | 'private') {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!EVENT_ID_RE.test(storyId) || !['published', 'removed', 'private'].includes(status)) return { success: false, error: 'Dati non validi' }
  const service = getServiceClient()
  // "Rendi privata" dello Staff è definitivo: l'autore non può ripubblicarla
  const { error } = await service
    .from('fabula_stories')
    .update({ status, staff_locked: status !== 'published', updated_at: new Date().toISOString() })
    .eq('id', storyId)
  if (error) return { success: false, error: error.message }
  await service.from('fabula_reports').update({ status: 'closed' }).eq('story_id', storyId).eq('status', 'open')
  return { success: true }
}

export async function adminAddFabulaWord(word: string) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const clean = word.trim().toLowerCase()
  // Solo lettere (anche accentate e cirilliche) e spazi: la parola diventa un'espressione di ricerca
  if (clean.length < 2 || clean.length > 40 || !/^[\p{L} ]+$/u.test(clean)) return { success: false, error: 'Usa solo lettere (2-40)' }
  const { error } = await getServiceClient().from('fabula_banned_words').upsert({ word: clean }, { onConflict: 'word' })
  return error ? { success: false, error: error.message } : { success: true }
}

export async function adminRemoveFabulaWord(word: string) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const { error } = await getServiceClient().from('fabula_banned_words').delete().eq('word', word)
  return error ? { success: false, error: error.message } : { success: true }
}

// ── Elenco utenti e matrice per il pannello ──────────────────────────────
// Cognome e codice unico degli altri non sono più leggibili dal browser
// (vedi 20261114110000_profiles_privacy.sql): lo Staff li riceve da qui.

// Ricerca utenti per lo Staff (Matrice, Coupon): nome, cognome, codice o
// email. Ogni parola deve comparire in uno di questi campi, così "mario
// rossi" trova Mario Rossi. Al massimo 20 risultati.
export type StaffUserHit = { id: string; first_name: string | null; last_name: string | null; referral_code: string | null; email: string | null }

export async function adminSearchUsers(query: string, scope: 'matrix' | 'coupons'): Promise<{ users: StaffUserHit[] }> {
  const admin = await verifyAdmin(scope === 'matrix' ? 'matrix.read' : 'coupons.read')
  if (!admin) return { users: [] }
  const words = query
    .replace(/[,()*%\\:"'`]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .slice(0, 4)
  if (words.length === 0) return { users: [] }

  let request = getServiceClient()
    .from('profiles')
    .select('id, first_name, last_name, referral_code, email')
    .is('deleted_at', null)
    .order('first_name')
    .limit(20)
  for (const word of words) {
    request = request.or(`first_name.ilike.%${word}%,last_name.ilike.%${word}%,referral_code.ilike.%${word}%,email.ilike.%${word}%`)
  }
  const { data } = await request
  return { users: (data ?? []) as StaffUserHit[] }
}

export async function adminGetUserMatrix(userId: string) {
  const admin = await verifyAdmin('matrix.read')
  if (!admin || !EVENT_ID_RE.test(userId)) return null
  const service = getServiceClient()
  const [{ data: profile }, { data: userNode }, { data: downline }] = await Promise.all([
    service.from('profiles').select('username, first_name, last_name, referral_code, country_code').eq('id', userId).maybeSingle(),
    service.from('matrix_nodes').select('*').eq('user_id', userId).maybeSingle(),
    service.rpc('get_user_downline', { p_user_id: userId, p_max_depth: 5 }),
  ])
  // get_user_downline dà node_id e profile_user_id ma non il percorso (path),
  // che serve alla stella per contare le persone di ogni ramo: si completa
  // con i nodi della matrice.
  const rows = (downline ?? []) as Array<{ node_id: string; profile_user_id: string; parent_id: string | null; depth: number; [key: string]: unknown }>
  const ids = rows.map((r) => r.node_id)
  const userIds = rows.map((r) => r.profile_user_id)
  const [{ data: nodes }, { data: sponsors }] = ids.length
    ? await Promise.all([
        service.from('matrix_nodes').select('id, path, created_at').in('id', ids),
        service.from('profiles').select('id, sponsor_id').in('id', userIds),
      ])
    : [{ data: [] }, { data: [] }]
  const byId = new Map((nodes ?? []).map((n) => [n.id as string, n]))
  // Nella stella: invitato da chi gli sta sopra (oro) o arrivato dalla community (azzurro)
  const sponsorOf = new Map((sponsors ?? []).map((p) => [p.id as string, p.sponsor_id as string | null]))
  const userOfNode = new Map<string, string>(rows.map((r) => [r.node_id, r.profile_user_id]))
  if (userNode?.id) userOfNode.set(userNode.id, userId)
  const full = rows
    .map(({ node_id, profile_user_id, ...rest }) => ({
      ...rest,
      id: node_id,
      user_id: profile_user_id,
      path: String(byId.get(node_id)?.path ?? ''),
      created_at: byId.get(node_id)?.created_at ?? rest.joined_at,
      sponsored_by_parent: Boolean(rest.parent_id && sponsorOf.get(profile_user_id) === userOfNode.get(rest.parent_id)),
    }))
    .filter((n) => n.path)
  return { profile, userNode, downline: full as Array<{ id: string; parent_id: string | null; depth: number; [key: string]: unknown }> }
}

// Conteggi della Panoramica: dal server, perché la matrice non è più
// leggibile dal browser (ognuno vede solo il proprio nodo).
export async function adminOverviewCounts() {
  const admin = await verifyAdmin('stats.read')
  if (!admin) return null
  const service = getServiceClient()
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0
  const [totalUsers, activeUsers, totalNodes, blockedUsers] = await Promise.all([
    count(service.from('profiles').select('id', { count: 'exact', head: true })),
    count(service.from('profiles').select('id', { count: 'exact', head: true }).eq('subscription_status', 'active').eq('is_blocked', false)),
    count(service.from('matrix_nodes').select('id', { count: 'exact', head: true })),
    count(service.from('profiles').select('id', { count: 'exact', head: true }).eq('is_blocked', true)),
  ])
  return { totalUsers, activeUsers, totalNodes, blockedUsers }
}

// KU Karma per attività (accesso giornaliero e uso di ogni strumento, una
// volta al giorno): quantità modificabili, lette dalle funzioni che
// assegnano i KU Karma (ku_points_for in 20261203100000_network_points_v2.sql).
export type KuActivityPointsRow = { key: string; label: string; points: number }

export async function adminListKuActivityPoints(): Promise<{ rows: KuActivityPointsRow[]; error: string | null }> {
  const admin = await verifyAdmin('settings.read')
  if (!admin) return { rows: [], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient()
    .from('ku_activity_points')
    .select('key, label, points')
    .order('sort_order')
    .order('label')
  if (error) return { rows: [], error: error.message }
  return { rows: (data as KuActivityPointsRow[]) ?? [], error: null }
}

export async function adminSaveKuActivityPoints(rows: { key: string; points: number }[]) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (rows.some((row) => !Number.isInteger(row.points) || row.points < 0 || row.points > 100)) {
    return { success: false, error: 'I KU Karma per attività devono essere numeri interi da 0 a 100.' }
  }
  const service = getServiceClient()
  for (const row of rows) {
    const { error } = await service.from('ku_activity_points').update({ points: row.points, updated_at: new Date().toISOString() }).eq('key', row.key)
    if (error) return { success: false, error: error.message }
  }
  return { success: true }
}

// ============================================================
// Pass servizio: un singolo servizio per un anno, senza abbonamento
// ============================================================

// Vendibile da solo (sì/no) e prezzo del pass, per servizio
export async function adminUpdateToolPass(toolName: string, enabled: boolean, priceEur: number) {
  const admin = await verifyAdmin('marketplace.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  const cents = Math.round(Number(priceEur) * 100)
  if (!Number.isFinite(cents) || cents < 100 || cents > 100000) return { success: false, error: 'Prezzo non valido: da 1 € a 1.000 €.' }
  const { error } = await getServiceClient()
    .from('marketplace_settings')
    .update({ pass_enabled: enabled, pass_price_cents: cents, updated_at: new Date().toISOString() })
    .eq('tool_name', toolName)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Nome del servizio (in italiano, per l'area Admin e i coupon)
async function toolTitle(tool: string) {
  const t = await getTranslations({ locale: 'it', namespace: 'marketplace' })
  return getMarketplaceTools((key) => t(key)).find((item) => item.toolName === tool)?.title ?? tool
}

// Codici pass: un lotto (es. da vendere a un negozio) oppure uno solo
// assegnato a un utente, che lo trova tra i Coupon del Wallet.
export async function adminCreatePassCodes(input: { tool: string; quantity: number; label: string; userId?: string | null }) {
  const admin = await verifyAdmin('coupons.write')
  if (!admin) return { success: false, error: 'Non autorizzato', codes: [] as string[] }
  const db = getServiceClient()
  const { data: setting } = await db.from('marketplace_settings').select('tool_name').eq('tool_name', input.tool).maybeSingle()
  if (!setting) return { success: false, error: 'Servizio non valido.', codes: [] as string[] }
  const quantity = input.userId ? 1 : Math.floor(Number(input.quantity))
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) return { success: false, error: 'Quantità da 1 a 500.', codes: [] as string[] }
  const label = input.label.trim().slice(0, 200) || null

  const codes: string[] = []
  for (let attempt = 0; attempt < 20 && codes.length < quantity; attempt++) {
    const batch = Array.from({ length: quantity - codes.length }, () => generatePassCode())
    const { data, error } = await db
      .from('tool_pass_codes')
      .upsert(
        batch.map((code) => ({ code, tool: input.tool, days: 365, label, assigned_to: input.userId ?? null, created_by: admin.id })),
        { onConflict: 'code', ignoreDuplicates: true }
      )
      .select('code')
    if (error) return { success: false, error: error.message, codes }
    codes.push(...(data ?? []).map((row: { code: string }) => row.code))
  }

  if (input.userId && codes[0]) {
    const title = await toolTitle(input.tool)
    const { error } = await db.from('wallet_coupons').insert({
      user_id: input.userId,
      code: codes[0],
      title: `Pass ${title} – 1 anno`,
      description: 'Attiva il servizio per un anno, oppure regala il codice: chi lo inserisce nella pagina del servizio lo attiva per sé.',
      pass_tool: input.tool,
      issued_by: admin.id,
    })
    if (error) return { success: false, error: error.message, codes }
  }
  return { success: true, codes }
}

export type AdminPassCodeRow = {
  code: string
  tool: string
  toolTitle: string
  label: string | null
  created_at: string
  redeemed_at: string | null
  assigned: boolean
}

export async function adminListPassCodes() {
  const admin = await verifyAdmin('coupons.read')
  if (!admin) return { codes: [] as AdminPassCodeRow[], error: 'Non autorizzato' }
  const { data, error } = await getServiceClient()
    .from('tool_pass_codes')
    .select('code, tool, label, created_at, redeemed_at, assigned_to')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return { codes: [] as AdminPassCodeRow[], error: error.message }
  const t = await getTranslations({ locale: 'it', namespace: 'marketplace' })
  const titles = new Map(getMarketplaceTools((key) => t(key)).map((item) => [item.toolName, item.title]))
  return {
    codes: (data ?? []).map((row) => ({
      code: row.code,
      tool: row.tool,
      toolTitle: titles.get(row.tool) ?? row.tool,
      label: row.label,
      created_at: row.created_at,
      redeemed_at: row.redeemed_at,
      assigned: !!row.assigned_to,
    })),
    error: null,
  }
}

// ============================================================
// Aspetto della homepage: layout scelto dall'Admin
// ============================================================

export async function adminGetHomeLayout() {
  const admin = await verifyAdmin('settings.read')
  if (!admin) return { layout: null as string | null }
  const { data } = await getServiceClient().from('system_settings').select('value').eq('key', 'home_layout').maybeSingle()
  let value: unknown = data?.value
  try {
    value = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    // testo semplice
  }
  return { layout: isHomeLayout(value) ? value : DEFAULT_HOME_LAYOUT }
}

export async function adminSetHomeLayout(layout: string) {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!isHomeLayout(layout)) return { success: false, error: 'Layout non valido' }
  const { error } = await getServiceClient().from('system_settings').upsert({ key: 'home_layout', value: JSON.stringify(layout) }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  // La homepage mostra subito il nuovo aspetto
  updateTag(HOME_LAYOUT_CACHE_TAG)
  return { success: true }
}
