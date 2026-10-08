'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { askConfirm } from '@/lib/confirm'
import { defaultLocale } from '../../../i18n'

// «Annulla» accanto a «Salva», uguale in tutta l'app:
// - dentro una finestra (Sheet) la chiude;
// - in una pagina torna alla schermata precedente (o a `fallbackHref` se si
//   è arrivati da un link diretto);
// - se nel modulo è già stato scritto qualcosa chiede conferma prima di
//   uscire. Le modifiche si accorgono da sole: basta un input nel <form>.

export const SheetCloseContext = createContext<(() => void) | null>(null)

export const cancelButtonClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'
// Accanto ai pulsanti grandi (py-3) che occupano la riga
export const cancelButtonLgClass =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'

export default function CancelButton({
  fallbackHref,
  href,
  onCancel,
  className,
  label,
  alwaysConfirm,
}: {
  // Pagina dove tornare se non c'è una schermata precedente nell'app
  fallbackHref?: string
  // Pagina dove andare sempre (moduli aperti dentro un'altra pagina)
  href?: string
  // Al posto del comportamento predefinito (chiudere o tornare indietro)
  onCancel?: () => void
  className?: string
  label?: string
  // Modifiche già fatte prima che il pulsante comparisse (es. foto caricate)
  alwaysConfirm?: boolean
}) {
  const t = useTranslations('common')
  const router = useRouter()
  const locale = useLocale()
  const closeSheet = useContext(SheetCloseContext)
  const ref = useRef<HTMLButtonElement>(null)
  const [dirty, setDirty] = useState(false)

  // Qualsiasi scrittura nel modulo che contiene il pulsante
  useEffect(() => {
    const form = ref.current?.closest('form') ?? ref.current?.closest('[data-cancel-scope]')
    if (!form) return
    const mark = () => setDirty(true)
    form.addEventListener('input', mark)
    form.addEventListener('change', mark)
    return () => {
      form.removeEventListener('input', mark)
      form.removeEventListener('change', mark)
    }
  }, [])

  const leave = () => {
    if (onCancel) return onCancel()
    if (closeSheet) return closeSheet()
    if (href) return router.push(locale === defaultLocale ? href : `/${locale}${href}`)
    // Schermata precedente solo se è dentro l'app
    const sameSite = typeof document !== 'undefined' && document.referrer.startsWith(window.location.origin)
    if (sameSite && window.history.length > 1) router.back()
    else if (fallbackHref) router.push(locale === defaultLocale ? fallbackHref : `/${locale}${fallbackHref}`)
    else router.back()
  }

  const click = async () => {
    if ((dirty || alwaysConfirm) && !(await askConfirm(t('leaveUnsavedText'), { title: t('leaveUnsavedTitle'), confirmLabel: t('leaveUnsavedOk'), tone: 'warning' }))) return
    leave()
  }

  return (
    <button ref={ref} type="button" onClick={click} className={className ?? cancelButtonClass}>
      {label ?? t('cancel')}
    </button>
  )
}
