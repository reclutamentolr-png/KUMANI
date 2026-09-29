'use client'

import { useTranslations } from 'next-intl'
import { ChevronDown, HelpCircle } from 'lucide-react'

// Istruzioni brevi per incollare la firma nei client di posta più diffusi.
const CLIENTS = [
  { id: 'gmail', steps: 4 },
  { id: 'outlookWeb', steps: 4 },
  { id: 'outlookDesktop', steps: 4 },
  { id: 'apple', steps: 4 },
  { id: 'iphone', steps: 4 },
] as const

export default function SignatureInstructions() {
  const t = useTranslations('firmaEmail')

  return (
    <section className="rounded-3xl border border-black/5 bg-[var(--paper)] p-5 shadow-sm sm:p-6">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-[var(--ink)]">
        <HelpCircle className="h-5 w-5 text-[var(--gold)]" />
        {t('instructionsTitle')}
      </h3>
      <div className="space-y-2">
        {CLIENTS.map(client => (
          <details key={client.id} className="group overflow-hidden rounded-2xl border border-black/5 bg-white open:border-[var(--gold)]/40">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="flex-1 text-sm font-semibold text-[var(--ink)]">{t(`${client.id}Title`)}</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" />
            </summary>
            <ol className="space-y-2 border-t border-black/5 px-4 pb-4 pt-3">
              {Array.from({ length: client.steps }, (_, i) => (
                <li key={i} className="flex gap-3 text-sm leading-6 text-[var(--ink)]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)]">
                    {i + 1}
                  </span>
                  {t(`${client.id}${i + 1}`)}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  )
}
