'use client'

import { useState, useEffect } from 'react'
import { notify } from '@/lib/adminNotify'
import { getAdminFinancialSummary, adminSetFinanceStatsSince } from '@/app/actions/admin'
import type { ReportTab } from '@/components/admin/ReportsPanel'
import { PiggyBank } from 'lucide-react'
import { askConfirm } from '@/lib/confirm'

// Sezione "financials" dell'Admin, caricata solo quando la si apre.
export default function AdminFinancialsPanel({ openReport }: { openReport: (tab: ReportTab) => void }) {
  const [financialSummary, setFinancialSummary] = useState<Awaited<ReturnType<typeof getAdminFinancialSummary>> | null>(null)
  const [loadingFinancialSummary, setLoadingFinancialSummary] = useState(false)

  const loadFinancialSummary = async () => {
    setLoadingFinancialSummary(true)
    const result = await getAdminFinancialSummary()
    setFinancialSummary(result)
    setLoadingFinancialSummary(false)
  }

  // Dati della sezione all'apertura
  useEffect(() => {
    // Caricamento dei dati della sezione (con il segnale "caricamento"):
    // è proprio il compito di questo effetto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFinancialSummary()
  }, [])

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
    const Card = ({ title, subtitle, detail, children }: { title: string; subtitle: string; detail?: ReportTab; children: React.ReactNode }) => (
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-[var(--gold)]/30 bg-[var(--gold-pale)] px-5 py-3">
          <h3 className="text-base font-bold text-[var(--ink)]">{title}</h3>
          <p className="text-xs text-gray-600">{subtitle}</p>
        </div>
        <div className="px-5 py-2">{children}</div>
        {detail && (
          <div className="border-t border-gray-100 px-5 py-2.5 text-right">
            <button type="button" onClick={() => openReport(detail)} className="text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
              Dettaglio e classifica →
            </button>
          </div>
        )}
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
          {/* Data di partenza dei conteggi: i movimenti precedenti non contano */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">
              {f.statsSince
                ? `Conteggi dal ${new Date(f.statsSince).toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Conteggi su tutto lo storico di Stripe'}
            </span>
            <button
              type="button"
              onClick={async () => {
                if (!(await askConfirm('Ripartire da zero da adesso? I movimenti di Stripe precedenti non verranno più contati (restano su Stripe).'))) return
                const r = await adminSetFinanceStatsSince(true)
                if (!r.success) notify('Errore: ' + r.error)
                await loadFinancialSummary()
              }}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Riparti da oggi
            </button>
            {f.statsSince && (
              <button
                type="button"
                onClick={async () => {
                  const r = await adminSetFinanceStatsSince(false)
                  if (!r.success) notify('Errore: ' + r.error)
                  await loadFinancialSummary()
                }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"
              >
                Mostra tutto lo storico
              </button>
            )}
          </div>
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

          {f.toolPasses && (
            <Card detail="passes" title="Pass dei singoli servizi" subtitle="Un servizio per un anno, senza abbonamento (KU Points a chi invita se impostati sul Pass)">
              <Row label="Pass pagati con carta" value={String(f.toolPasses.soldCount)} />
              <Row label="Incassato dai pass" value={eur(f.toolPasses.soldCents)} strong />
              <Row label="Attivati con codice" value={String(f.toolPasses.codeCount)} />
              <Row label="Pass attivi oggi" value={String(f.toolPasses.activeCount)} />
            </Card>
          )}

          <Card detail="shops" title="Lotti di voucher per i negozi" subtitle="Venduti con fattura a parte, fuori da Stripe">
            <Row label="Lotti" value={String(f.shopBatches.count)} hint={`${f.shopBatches.vouchers} voucher, ${f.shopRedeemed.count} già usati`} />
            <Row label="Incassato dai lotti" value={eur(f.shopBatches.cents)} strong />
          </Card>

          <Card detail="agents" title="Agenti venditori" subtitle="Provvigioni registrate (rettifiche comprese)">
            <Row label="In maturazione (14 giorni)" value={eur(f.agentCommissions.pending)} />
            <Row label="Maturate, da pagare" value={eur(f.agentCommissions.matured)} />
            <Row label="Già pagate" value={eur(f.agentCommissions.paid)} />
            <Row label="Annullate (rimborsi)" value={eur(f.agentCommissions.cancelled)} />
          </Card>

          <Card detail="vouchers" title="Voucher della community" subtitle="Servizi dati senza incasso, a prezzo di listino">
            <Row label="Voucher Kumani usati" value={eur(f.kumanoVouchers.redeemedCents)} hint={`${f.kumanoVouchers.redeemedCount} voucher`} />
            <Row label="Voucher Kumani non ancora usati" value={eur(f.kumanoVouchers.activeCents)} hint={`${f.kumanoVouchers.activeCount} voucher in circolazione`} />
            <Row label="Voucher omaggio dello Staff usati" value={eur(f.staffGifts.redeemedCents)} hint={`${f.staffGifts.redeemedCount} voucher`} />
            <Row label="Servizi già dati (usati)" value={eur(f.giftedServicesCents)} strong />
          </Card>

          <Card detail="donors" title="Donazioni" subtitle="Impegno di KUMANI verso l'associazione (uscita di cassa quando versato)">
            <Row label="Maturate dagli abbonamenti" value={eur(f.donations.subscriptionCents)} />
            <Row label="Maturate dai KU Points donati" value={eur(f.donations.pointsCents)} />
            <Row label="Già versate" value={eur(f.donations.paidCents)} />
            <Row label="Da versare" value={eur(Math.max(f.donations.subscriptionCents + f.donations.pointsCents - f.donations.paidCents, 0))} strong />
          </Card>

          <Card detail="points" title="KU Points" subtitle="Assegnati dal nuovo sistema e ancora da spendere">
            <Row label="Attivazioni Base" value={`${f.pointsAwarded.activation_base} punti`} />
            <Row label="Attivazioni Pro" value={`${f.pointsAwarded.activation_pro} punti`} />
            <Row label="Passaggi a Pro" value={`${f.pointsAwarded.upgrade_pro} punti`} />
            <Row label="Pass dei singoli servizi" value={`${f.pointsAwarded.tool_pass} punti`} />
            <Row label="Bonus Accoglienza" value={`${f.pointsAwarded.matrix} punti`} />
            <Row label="Tolti per rimborsi" value={`${f.pointsAwarded.reversed} punti`} />
            <Row
              label="Punti ancora da spendere"
              value={`${f.networkPointsOutstanding} punti`}
              hint={`Si possono solo donare all'associazione: al massimo ${eur(f.networkPointsMaxCents)}`}
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

  return renderFinancials()
}
