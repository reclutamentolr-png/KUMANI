'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { IdCard, QrCode } from 'lucide-react'
import { saveClassicCard } from '@/app/actions/businessCard'

// Entrando nel biglietto: si sceglie quello KUMANI con QR o quello classico.
// La scelta resta salvata per la volta dopo.

type Kind = 'kumani' | 'classic'

export default function BusinessCardChooser({ initial, kumani, classic }: { initial: Kind; kumani: ReactNode; classic: ReactNode }) {
  const t = useTranslations('businessCard')
  const [kind, setKind] = useState<Kind>(initial)

  const choose = (k: Kind) => {
    if (k === kind) return
    setKind(k)
    void saveClassicCard(k)
  }

  const options: { k: Kind; icon: typeof QrCode; title: string; text: string }[] = [
    { k: 'kumani', icon: QrCode, title: t('chooseKumani'), text: t('chooseKumaniText') },
    { k: 'classic', icon: IdCard, title: t('chooseClassic'), text: t('chooseClassicText') },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map(({ k, icon: Icon, title, text }) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => choose(k)}
            className={`flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${
              kind === k ? 'border-[var(--gold)] bg-[var(--gold-pale)] shadow-sm' : 'border-[var(--gold)]/20 bg-white hover:border-[var(--gold)]/60'
            }`}
          >
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${kind === k ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[#8a6a1f]'}`}>
              <Icon className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-[var(--ink)]">{title}</span>
              <span className="mt-0.5 block text-sm text-[var(--muted)]">{text}</span>
            </span>
          </button>
        ))}
      </div>
      {kind === 'kumani' ? kumani : classic}
    </div>
  )
}
