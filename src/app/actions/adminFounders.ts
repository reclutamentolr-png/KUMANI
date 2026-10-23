'use server'

import { revalidateTag } from 'next/cache'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { pushDb } from '@/lib/push'
import { FOUNDERS_CACHE_TAG, SOLD_OUT_BANNER_MS, includeExistingFounders, soldOutHours } from '@/lib/founders'

// Admin → Voucher e coupon → Fondatori: promozione accesa/spenta, posti,
// elenco dei Fondatori e regalo del Plus agli iscritti di prima.

export type AdminFounder = { number: number | null; counted: boolean; name: string; email: string | null; joinedAt: string; voucher: 'active' | 'redeemed' | 'none' }

// soldOut: posti finiti (ora, ore impiegate, fine del banner, banner nascosto)
export type AdminSoldOut = { fullAt: string; hours: number | null; bannerUntil: string; hidden: boolean }

export async function adminGetFounders(): Promise<{ enabled: boolean; limit: number; soldOut: AdminSoldOut | null; founders: AdminFounder[] } | { error: string }> {
  if (!(await verifyAdmin('coupons.read'))) return { error: 'Non autorizzato' }
  const db = pushDb()
  const [{ data: settings }, { data: rows }] = await Promise.all([
    db.from('system_settings').select('key, value').in('key', ['founders_enabled', 'founders_limit', 'founders_started_at', 'founders_full_at', 'founders_soldout_hidden']),
    db.from('founder_members').select('user_id, number, counted, voucher_code, created_at').order('created_at', { ascending: true }),
  ])
  const ids = (rows ?? []).map((r) => r.user_id as string)
  const codes = (rows ?? []).map((r) => r.voucher_code).filter(Boolean) as string[]
  const [{ data: people }, { data: vouchers }] = await Promise.all([
    ids.length ? db.from('profiles').select('id, first_name, last_name, email').in('id', ids) : Promise.resolve({ data: [] }),
    codes.length ? db.from('subscription_vouchers').select('code, status').in('code', codes) : Promise.resolve({ data: [] }),
  ])
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]))
  const statusOf = new Map((vouchers ?? []).map((v) => [v.code as string, v.status as string]))
  const val = (k: string) => String(settings?.find((s) => s.key === k)?.value ?? '').replace(/"/g, '')
  const fullAt = val('founders_full_at')
  return {
    enabled: val('founders_enabled') === 'true',
    limit: parseInt(val('founders_limit'), 10) || 50,
    soldOut: fullAt
      ? {
          fullAt,
          hours: soldOutHours(val('founders_started_at'), fullAt),
          bannerUntil: new Date(Date.parse(fullAt) + SOLD_OUT_BANNER_MS).toISOString(),
          hidden: val('founders_soldout_hidden') === 'true',
        }
      : null,
    founders: (rows ?? []).map((r) => {
      const p = byId.get(r.user_id as string)
      const st = r.voucher_code ? statusOf.get(r.voucher_code as string) : null
      return {
        number: (r.number as number | null) ?? null,
        counted: Boolean(r.counted),
        name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—',
        email: (p?.email as string | null) ?? null,
        joinedAt: r.created_at as string,
        voucher: st === 'active' ? 'active' : st === 'redeemed' ? 'redeemed' : 'none',
      }
    }),
  }
}

export async function adminSetFounders(enabled: boolean, limit: number): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('coupons.write'))) return { success: false, error: 'Non autorizzato' }
  const n = Math.round(Number(limit))
  if (!Number.isFinite(n) || n < 1 || n > 1000) return { success: false, error: 'Numero di posti non valido' }
  const now = new Date().toISOString()
  const db = pushDb()
  // Più posti di quelli presi: la promozione riparte e l'ora di esaurimento si azzera
  const { count } = await db.from('founder_members').select('user_id', { count: 'exact', head: true }).eq('counted', true)
  if (n > (count ?? 0)) await db.from('system_settings').delete().in('key', ['founders_full_at', 'founders_soldout_hidden'])
  // Prima accensione: da qui si contano le ore del banner «esauriti»
  if (enabled) await db.from('system_settings').upsert({ key: 'founders_started_at', value: now, updated_at: now }, { onConflict: 'key', ignoreDuplicates: true })
  const { error } = await db
    .from('system_settings')
    .upsert(
      [
        { key: 'founders_enabled', value: enabled ? 'true' : 'false', updated_at: now },
        { key: 'founders_limit', value: String(n), updated_at: now },
      ],
      { onConflict: 'key' }
    )
  if (error) return { success: false, error: error.message }
  revalidateTag(FOUNDERS_CACHE_TAG, { expire: 0 })
  return { success: true }
}

// Banner «posti esauriti»: nasconderlo prima delle 48 ore (o rimostrarlo)
export async function adminHideFoundersSoldOut(hidden: boolean): Promise<{ success: boolean; error?: string }> {
  if (!(await verifyAdmin('coupons.write'))) return { success: false, error: 'Non autorizzato' }
  const { error } = await pushDb()
    .from('system_settings')
    .upsert({ key: 'founders_soldout_hidden', value: hidden ? 'true' : 'false', updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  revalidateTag(FOUNDERS_CACHE_TAG, { expire: 0 })
  return { success: true }
}

export async function adminGrantFoundersExisting(): Promise<{ success: boolean; included?: number; error?: string }> {
  if (!(await verifyAdmin('coupons.write'))) return { success: false, error: 'Non autorizzato' }
  const r = await includeExistingFounders()
  return { success: true, ...r }
}
