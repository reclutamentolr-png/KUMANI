import { getTranslations } from 'next-intl/server'
import { ArrowRight, HandPlatter, Hourglass, PartyPopper, Star, Tag, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { fetchToolRows, type ToolRow } from '@/components/HomePlans'

// Homepage: la Community KUMANI in una sezione sua (Bacheca, Kordata, Banca
// del Tempo, Eventi, Kumano del Giorno), con chi può usare ogni spazio.
// Etichette e sezioni accese/spente vengono dalle impostazioni dell'Admin.
const ITEMS = [
  { setting: 'listings', Icon: Tag, title: 'listings', desc: 'listingsDescription' },
  { setting: 'convivio', Icon: HandPlatter, title: 'convivio', desc: 'convivioDescription' },
  { setting: 'timebank', Icon: Hourglass, title: 'timebank', desc: 'timebankDescription' },
  { setting: 'events', Icon: PartyPopper, title: 'events', desc: 'eventsDescription' },
  { setting: 'spotlight', Icon: Star, title: 'kumanoDelGiorno', desc: 'kumanoDelGiornoDescription' },
] as const

export default async function HomeCommunity() {
  const [t, marketplaceT, rows] = await Promise.all([
    getTranslations('landingHome'),
    getTranslations('marketplace'),
    fetchToolRows().catch(() => [] as ToolRow[]),
  ])
  const byName = new Map(rows.map((row) => [row.tool_name, row]))
  const items = ITEMS.filter((item) => byName.get(item.setting)?.is_enabled !== false)
  if (items.length === 0) return null

  // Chi può usarla: gratis, oppure con il piano richiesto (gli Eventi si
  // consultano sempre gratis, il piano serve per organizzarli)
  const label = (setting: string) => {
    const plan = byName.get(setting)?.required_plan ?? 'free'
    if (setting === 'events') return { text: plan === 'free' ? t('communityHubFree') : t('communityHubEvents'), free: true }
    if (plan === 'free') return { text: t('communityHubFree'), free: true }
    return { text: plan === 'pro' ? t('communityHubPro') : t('communityHubBase'), free: false }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-10 sm:mb-12">
        <div className="inline-flex items-center gap-2 bg-[var(--gold)]/10 border border-[var(--gold)]/30 px-4 py-1.5 rounded-full text-sm font-medium text-[var(--gold-bright)] mb-4">
          <Users className="w-4 h-4" />
          {t('communityHubEyebrow')}
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold text-white mb-4 break-words">
          {t('communityHubTitle')}{' '}
          <span className="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] bg-clip-text text-transparent">{t('communityHubAccent')}</span>
        </h2>
        <p className="text-base sm:text-xl text-gray-300 max-w-3xl mx-auto">{t('communityHubDescription')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(({ setting, Icon, title, desc }) => {
          const tag = label(setting)
          return (
            <div key={setting} className="flex flex-col rounded-2xl border border-[var(--gold)]/20 bg-white/[0.04] p-5 transition-colors hover:border-[var(--gold)]/50">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-bold text-white">{marketplaceT(title)}</h3>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-gray-400">{marketplaceT(desc)}</p>
              <span
                className={`mt-4 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  tag.free ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--gold)]/15 text-[var(--gold-bright)]'
                }`}
              >
                {tag.text}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 text-center">
        <p className="text-xl font-bold text-white sm:text-2xl">{t('communityHubQuote')}</p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-xl hover:brightness-110"
        >
          {t('communityHubCta')} <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
