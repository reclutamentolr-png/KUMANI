'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'

// Apre tutte le schede chiuse prima della stampa (anche con Ctrl+P), così
// il PDF contiene il manuale completo; "Salva come PDF" lo scarica.
function openAll() {
  document.querySelectorAll<HTMLDetailsElement>('[data-guide] details').forEach(d => {
    d.open = true
  })
}

export default function PrintGuideButton({ label }: { label: string }) {
  useEffect(() => {
    window.addEventListener('beforeprint', openAll)
    return () => window.removeEventListener('beforeprint', openAll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => {
        openAll()
        window.print()
      }}
      className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-semibold text-[var(--ink)] shadow transition hover:bg-[var(--gold-bright)] print:hidden"
    >
      <Printer className="h-4 w-4" />
      {label}
    </button>
  )
}
