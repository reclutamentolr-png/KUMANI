// Schermata mostrata subito quando si apre la dashboard (anche tornando da
// un servizio), mentre il server prepara i dati: stessa forma della pagina,
// così il passaggio è immediato e senza salti.
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
        <div className={`h-16 ${block}`} />
        <div className={`h-14 ${block}`} />

        {/* Calendario */}
        <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white">
          <div className="space-y-4 bg-gradient-to-br from-[#26221c] to-[var(--ink)] px-5 pb-5 pt-5">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-white/10" />
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className={`h-16 animate-pulse rounded-xl ${i === 0 ? 'bg-[var(--gold)]/60' : 'bg-white/[0.08]'}`} />
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="h-20 animate-pulse rounded-xl bg-[var(--gold-pale)]" />
          </div>
        </div>

        {/* Schede di stato */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="relative h-36 overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
              <div className="space-y-3 p-5 pt-6">
                <div className="h-8 w-40 animate-pulse rounded-lg bg-[var(--ink)]/[0.06]" />
                <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--ink)]/[0.08]" />
              </div>
            </div>
          ))}
        </div>

        {/* Strumenti */}
        <div className="space-y-3">
          <div className="h-7 w-40 animate-pulse rounded-lg bg-[var(--ink)]/[0.08]" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className={`h-[72px] ${block}`} />
          ))}
        </div>
      </main>
    </div>
  )
}
