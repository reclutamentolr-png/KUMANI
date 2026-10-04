import LanguageSwitcher from '@/components/LanguageSwitcher'

// Intestazione delle pagine principali raggiunte dal menu fisso (Servizi,
// Community): titolo, sottotitolo e lingua. Si torna indietro dal menu.
export default function HubHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-white/65">{subtitle}</p>}
        </div>
        <LanguageSwitcher dark compact />
      </div>
    </header>
  )
}
