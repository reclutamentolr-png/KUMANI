// Schermata mostrata subito aprendo «Servizi» (anche con «Torna ai servizi»
// da uno strumento), mentre il server prepara il catalogo: stessa forma della
// pagina (link al catalogo, ricerca, filtri, schede dei servizi).
export default function ServicesLoading() {
  const block = 'animate-pulse rounded-2xl bg-[var(--ink)]/[0.06]'
  return (
    <div className="min-h-screen bg-[var(--background)]" aria-busy="true">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-white/10" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--gold)]/40" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Link al catalogo */}
        <div className="h-12 animate-pulse rounded-2xl border border-[var(--gold)]/35 bg-[var(--gold-pale)]" />
        {/* Ricerca e filtri */}
        <div className="h-11 animate-pulse rounded-xl border border-[var(--gold)]/25 bg-white" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-[var(--ink)]/[0.08]" />
          ))}
        </div>
        {/* Gruppi di servizi */}
        {Array.from({ length: 2 }, (_, g) => (
          <div key={g} className="space-y-3">
            <div className="h-7 w-48 animate-pulse rounded-lg bg-[var(--ink)]/[0.08]" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={`h-[72px] ${block}`} />
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}
