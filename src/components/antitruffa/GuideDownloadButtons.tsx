'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, LoaderCircle, Printer } from 'lucide-react'

// Manuale Antitruffa: «Scarica PDF» salva il manuale impaginato, «Stampa» lo
// apre e fa partire la stampa (sul telefono si apre il PDF, che ha già il suo
// pulsante per stampare o condividere). Il PDF arriva da
// /api/antitruffa/manuale, che conta ogni download.
function openAll() {
  // Ctrl+P sulla pagina: si stampano anche le schede chiuse
  document.querySelectorAll<HTMLDetailsElement>('[data-guide] details').forEach((d) => {
    d.open = true
  })
}

export default function GuideDownloadButtons({ lang, download, print, preparing }: { lang: string; download: string; print: string; preparing: string }) {
  const [busy, setBusy] = useState(false)
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const url = (mode: 'pdf' | 'print') => `/api/antitruffa/manuale?lang=${encodeURIComponent(lang)}&mode=${mode}`

  useEffect(() => {
    window.addEventListener('beforeprint', openAll)
    return () => {
      window.removeEventListener('beforeprint', openAll)
      frameRef.current?.remove()
    }
  }, [])

  const printPdf = () => {
    // Telefono e tablet: il PDF si apre in una scheda nuova
    if (window.matchMedia('(pointer: coarse)').matches) {
      window.open(url('print'), '_blank', 'noopener')
      return
    }
    setBusy(true)
    frameRef.current?.remove()
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
    frame.src = url('print')
    frame.onload = () => {
      setBusy(false)
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
      } catch {
        window.open(url('print'), '_blank', 'noopener')
      }
    }
    document.body.appendChild(frame)
    frameRef.current = frame
  }

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row print:hidden">
      <a
        href={url('pdf')}
        download
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-bold text-[var(--ink)] shadow transition hover:bg-[var(--gold-bright)]"
      >
        <Download className="h-4 w-4" aria-hidden />
        {download}
      </a>
      <button
        type="button"
        onClick={printPdf}
        disabled={busy}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/60 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-70"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Printer className="h-4 w-4" aria-hidden />}
        {busy ? preparing : print}
      </button>
    </div>
  )
}
