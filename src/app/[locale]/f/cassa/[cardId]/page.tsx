import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Stamp } from 'lucide-react'
import FidelityCassa from '@/components/fidelity/FidelityCassa'
import { getFidelityServiceClient, hasCassaAccess } from '@/lib/fidelity-server'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

// Modalità cassa della Kumi Card. Fuori da /marketplace di proposito: deve
// funzionare anche sul tablet del negozio senza account, sbloccato con il
// PIN. Il titolare loggato entra direttamente.
export default async function FidelityCassaPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) notFound()

  const t = await getTranslations('fidelity')
  const { data: card } = await getFidelityServiceClient()
    .from('fidelity_cards')
    .select('id, business_name, prize, stamps_needed, review_url')
    .eq('id', cardId)
    .maybeSingle()
  if (!card) notFound()

  const hasAccess = await hasCassaAccess(cardId)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)]">
        <div className="mx-auto flex max-w-md items-center justify-center gap-2 px-4 py-4 text-white">
          <Stamp className="h-5 w-5 text-[var(--gold-bright)]" />
          <span className="font-semibold">{t('cassaTitle')}</span>
        </div>
      </header>
      <main className="px-4 py-8">
        <FidelityCassa
          hasAccess={hasAccess}
          card={{
            id: card.id,
            businessName: card.business_name,
            prize: card.prize,
            stampsNeeded: card.stamps_needed,
            reviewEnabled: !!card.review_url,
          }}
        />
      </main>
    </div>
  )
}
