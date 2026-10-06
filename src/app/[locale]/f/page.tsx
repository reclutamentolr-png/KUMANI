import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { ChevronRight, Wallet } from 'lucide-react'
import { getFidelityServiceClient, readWalletTokens } from '@/lib/fidelity-server'
import { createClient } from '@/lib/supabase/server'
import { effectiveStamps } from '@/lib/fidelity'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

type WalletRow = {
  token: string
  stamps_count: number
  last_stamp_at: string | null
  fidelity_cards: { business_name: string; prize: string; stamps_needed: number; stamps_expire_days: number | null } | null
}

// Portafoglio del cliente: tutte le Kumi Card ricordate da questo browser.
export default async function FidelityWalletPage() {
  const t = await getTranslations('fidelity')
  // Tessere ricordate da questo browser + quelle legate all'account KUMANI
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const linked = user ? (((await supabase.rpc('my_fidelity_cards')).data ?? []) as { token: string }[]).map((c) => c.token) : []
  const tokens = [...new Set([...(await readWalletTokens()), ...linked])]
  const { data } = tokens.length
    ? await getFidelityServiceClient()
        .from('fidelity_members')
        .select('token, stamps_count, last_stamp_at, fidelity_cards(business_name, prize, stamps_needed, stamps_expire_days)')
        .in('token', tokens)
        .returns<WalletRow[]>()
    : { data: [] as WalletRow[] }
  const cards = (data ?? []).filter((row) => row.fidelity_cards)

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-white">
          <Wallet className="h-6 w-6 text-[var(--gold-bright)]" />
          <h1 className="text-xl font-bold">{t('walletTitle')}</h1>
        </div>

        {cards.length === 0 ? (
          <p className="rounded-2xl bg-white/5 p-6 text-center text-sm text-white/70">{t('walletEmpty')}</p>
        ) : (
          <div className="space-y-3">
            {cards.map((row) => {
              const card = row.fidelity_cards!
              return (
                <Link
                  key={row.token}
                  href={`/f/${row.token}`}
                  className="flex items-center gap-4 rounded-2xl border border-[var(--gold)]/25 bg-gradient-to-br from-[#2a2721] to-[var(--ink)] p-4 text-white transition-colors hover:border-[var(--gold)]/60"
                >
                  <Logo size={40} className="h-10 w-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{card.business_name}</p>
                    <p className="truncate text-xs text-white/60">{card.prize}</p>
                  </div>
                  <span className="text-sm font-bold text-[var(--gold-bright)]">
                    {Math.min(effectiveStamps(card, row), card.stamps_needed)}/{card.stamps_needed}
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/40" />
                </Link>
              )
            })}
          </div>
        )}
        <p className="mt-8 text-center text-xs text-white/40">{t('poweredBy')}</p>
      </div>
    </div>
  )
}
