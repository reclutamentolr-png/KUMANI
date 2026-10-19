'use client'

import { useEffect, useState } from 'react'
import { Info, Sparkles, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// «Cosa sono?» accanto a KU Karma nella dashboard: sul computer la scritta,
// sul telefono il cerchio con la «i». Apre una spiegazione breve (finestra in
// basso sul telefono, al centro sul computer). Testi passati dalla pagina.
export type KarmaInfoTexts = {
  button: string
  title: string
  intro: string
  earnTitle: string
  earn: string[]
  useTitle: string
  use: string
  pointsNote: string
  wallet: string
  close: string
}

// variant «text»: «(Cosa sono?)», solo dal computer; «icon»: cerchio con la «i», solo dal telefono
export default function KarmaInfoButton({ texts, variant }: { texts: KarmaInfoTexts; variant: 'text' | 'icon' }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={texts.button}
        className={
          variant === 'icon'
            ? "relative inline-flex shrink-0 items-center justify-center rounded-full text-[var(--gold)] transition after:absolute after:-inset-2.5 after:content-[''] hover:text-[var(--ink)] sm:hidden"
            : 'hidden shrink-0 text-[11px] font-semibold text-[var(--gold)] underline underline-offset-2 transition hover:text-[var(--ink)] sm:inline'
        }
      >
        {variant === 'icon' ? <Info className="h-[18px] w-[18px]" aria-hidden /> : `(${texts.button})`}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="karma-info-title" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] text-left shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 id="karma-info-title" className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
                <Sparkles className="h-5 w-5 text-[var(--gold)]" /> {texts.title}
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={texts.close} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-[var(--ink)]">{texts.intro}</p>
            <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">{texts.earnTitle}</h3>
            <ul className="mt-1.5 space-y-1.5 text-sm text-[var(--muted)]">
              {texts.earn.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">{texts.useTitle}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{texts.use}</p>
            <p className="mt-4 rounded-xl bg-[var(--gold)]/[0.08] px-3 py-2.5 text-xs leading-relaxed text-[var(--ink)]">{texts.pointsNote}</p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Link href="/wallet" className="inline-flex min-h-10 items-center rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-white hover:bg-[var(--ink-soft)]">
                {texts.wallet}
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
                {texts.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
