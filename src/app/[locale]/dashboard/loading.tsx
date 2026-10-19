// Schermata mostrata subito quando si apre la dashboard (anche tornando da
// un servizio), mentre il server prepara i dati: stessa forma della Home
// (interruttore della vista, pulsanti, 3 schede, contenuto, servizi), così
// il passaggio è immediato e senza salti.
export default function DashboardLoading() {
  const block = 'animate-pulse rounded-2xl bg-[var(--ink)]/[0.06]'
  return (
    <div className="min-h-screen bg-[var(--background)]" aria-busy="true">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-white/10" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-white/10" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--gold)]/40" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Interruttore della vista (Lite · Completa · Icone) */}
        <div className="grid h-11 grid-cols-3 gap-1 rounded-xl border border-[var(--gold)]/25 bg-white p-1">
          <div className="animate-pulse rounded-lg bg-[var(--ink)]/80" />
          <div className="animate-pulse rounded-lg bg-[var(--ink)]/[0.05]" />
          <div className="animate-pulse rounded-lg bg-[var(--ink)]/[0.05]" />
        </div>

        {/* Abbonati e «Hai un codice?» */}
        <div className="grid grid-cols-2 gap-2">
          <div className="h-11 animate-pulse rounded-xl bg-[var(--ink)]/80" />
          <div className="h-11 animate-pulse rounded-xl border border-[var(--gold)]/40 bg-white" />
        </div>

        {/* Schede di stato: KU Karma, Piano, Invito */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-28 space-y-2 rounded-2xl border border-[var(--gold)]/30 bg-white p-3 sm:p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--ink)]/[0.08]" />
              <div className="h-7 w-12 animate-pulse rounded-lg bg-[var(--ink)]/[0.1]" />
            </div>
          ))}
        </div>

        {/* Contenuto principale */}
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--gold)]/30 bg-white" />

        {/* I tuoi servizi */}
        <div className="space-y-3">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-[var(--ink)]/[0.08]" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`h-[72px] ${block}`} />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
