'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, LoaderCircle, Share2 } from 'lucide-react'
import { askConfirm } from '@/lib/confirm'
import { letterFileName, letterModel, missingPlaceholders, type CoverLetterForm } from '@/lib/letteraPresentazione'

// «Scarica PDF» e «Condividi»: il PDF si fa nel browser con i dati del
// modulo (anche non ancora salvati). Condividi manda il file vero (telefono,
// WhatsApp, email); dove non si può, il PDF si scarica.

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export default function LetteraPdfButtons({ form, className = '' }: { form: CoverLetterForm; className?: string }) {
  const t = useTranslations('letteraPresentazione')
  const [busy, setBusy] = useState<'pdf' | 'share' | null>(null)

  // Parti tra parentesi quadre ancora da completare: si chiede prima
  const ready = async () => {
    const missing = missingPlaceholders(letterModel(form))
    if (!missing.length) return true
    return askConfirm(t('missingConfirm', { list: missing.slice(0, 6).join(', ') }), {
      title: t('missingTitle'),
      confirmLabel: t('missingContinue'),
      cancelLabel: t('missingFix'),
      tone: 'default',
    })
  }

  const makeFile = async () => {
    // jsPDF solo al clic, fuori dal caricamento della pagina
    const { buildLetterPdfBlob } = await import('@/lib/letteraPresentazionePdf')
    const blob = await buildLetterPdfBlob(form)
    return new File([blob], letterFileName(form), { type: 'application/pdf' })
  }

  const handleDownload = async () => {
    if (busy || !(await ready())) return
    setBusy('pdf')
    try {
      download(await makeFile())
    } catch (err) {
      console.error(err)
      alert(t('pdfError'))
    } finally {
      setBusy(null)
    }
  }

  const handleShare = async () => {
    if (busy || !(await ready())) return
    setBusy('share')
    try {
      const file = await makeFile()
      const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
      if (!canShare) {
        download(file)
        return
      }
      try {
        await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Il PDF ci ha messo troppo: il telefono vuole un tocco nuovo
        if (e instanceof DOMException && e.name === 'NotAllowedError' && (await askConfirm(t('shareReady'), { confirmLabel: t('share'), tone: 'default' }))) {
          try {
            await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/, '') })
            return
          } catch (again) {
            if (again instanceof DOMException && again.name === 'AbortError') return
          }
        }
        download(file)
      }
    } catch (err) {
      console.error(err)
      alert(t('pdfError'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div data-guest-hide className={`flex flex-wrap gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy !== null}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[var(--ink-soft)] disabled:opacity-50 sm:flex-none"
      >
        {busy === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy === 'pdf' ? t('pdfMaking') : t('downloadPdf')}
      </button>
      <button
        type="button"
        onClick={handleShare}
        disabled={busy !== null}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-5 py-3 text-sm font-bold text-[var(--ink)] transition-all hover:bg-[var(--gold-pale)] disabled:opacity-50 sm:flex-none"
      >
        {busy === 'share' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        {t('share')}
      </button>
    </div>
  )
}
