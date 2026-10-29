import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// Sezione che si apre e si chiude toccando il titolo: chiusa all'inizio, così
// le pagine con tante impostazioni restano pulite e si apre solo quello che serve.
export default function FoldSection({ title, icon, children, className = '', defaultOpen = false }: { title: ReactNode; icon?: ReactNode; children: ReactNode; className?: string; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className={`group rounded-2xl border border-[var(--gold)]/30 bg-white shadow-sm ${className}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-bold text-[var(--ink)]">
          {icon}
          {title}
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 text-[var(--gold)] transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}
