import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import AffinityDuo from '@/components/affinity/AffinityDuo'
import { createClient } from '@/lib/supabase/server'
import { isAffinityArchetype, isAffinityMap, type AffinityArchetype, type AffinityMap } from '@/lib/affinity'
import { ServiceStopped } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

type DuoRow = { first_name: string | null; archetype: string; map: unknown; referral_code: string | null }

// Pagina pubblica del link "Gioca in Duo" (/affinity/duo/<codice>): si gioca
// anche senza account.
export default async function AffinityDuoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!(await isToolOnline('affinity'))) return <ServiceStopped />
  const t = await getTranslations('affinity')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let owner: { firstName: string; archetype: AffinityArchetype; map: AffinityMap; referralCode: string | null } | null = null
  if (/^[a-f0-9]{6,16}$/i.test(code)) {
    const { data } = await supabase.rpc('get_affinity_duo', { p_code: code })
    const row = ((data as DuoRow[] | null) ?? [])[0]
    if (row && isAffinityMap(row.map) && isAffinityArchetype(row.archetype)) {
      owner = { firstName: row.first_name || 'KUMANI', archetype: row.archetype, map: row.map, referralCode: row.referral_code }
    }
  }

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo size={44} className="h-11 w-11" />
          <span className="text-lg font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI</span>
        </Link>
        {owner ? (
          <AffinityDuo owner={owner} isLoggedIn={!!user} />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <p className="text-white/80">{t('duoNotFound')}</p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)]"
            >
              KUMANI
            </Link>
          </div>
        )}
        <p className="mt-10 text-center text-xs leading-5 text-white/40">{t('disclaimer')}</p>
      </div>
    </div>
  )
}
