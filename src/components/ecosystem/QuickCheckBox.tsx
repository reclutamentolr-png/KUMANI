'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, AtSign, Building2, Camera, Globe, Landmark, MailSearch, Phone, ShieldCheck, type LucideIcon } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { isWholeMessage, MESSAGE_HANDOFF_KEY, quickCheckFindings, type QuickCheckFinding, type QuickCheckKind } from '@/lib/quickCheck'
import { defaultLocale } from '../../../i18n'

export { quickCheckTarget } from '@/lib/quickCheck'

const KIND_ICON: Record<QuickCheckKind, LucideIcon> = { site: Globe, email: AtSign, iban: Landmark, phone: Phone, vat: Building2 }

// «Qualcosa non ti torna? Incollalo qui»: un campo solo per un valore (IBAN,
// email, partita IVA, sito, telefono) o per un messaggio intero (SMS,
// WhatsApp, email). Un valore solo → si apre subito lo strumento giusto già
// compilato; un messaggio intero → prima «Analizza tutto il messaggio» (CheckMail
// con il testo già incollato), poi le singole cose trovate. Per le foto: VeriFoto.
// Nella pagina Servizi (gruppo Sicurezza), in Dashboard e nella pagina /controlla
// (dove arrivano anche i contenuti condivisi dal telefono).
export default function QuickCheckBox({ title, initialText = '', autoRun = false, className = 'mb-4' }: { title?: string; initialText?: string; autoRun?: boolean; className?: string }) {
  const t = useTranslations('ecosystem')
  const locale = useLocale()
  const router = useRouter()
  const inputId = useId()
  const [value, setValue] = useState(initialText)
  const [unknown, setUnknown] = useState(false)
  const [findings, setFindings] = useState<QuickCheckFinding[] | null>(null)
  // Il testo incollato è un messaggio intero (non un valore solo)
  const [message, setMessage] = useState(false)
  const ran = useRef(false)
  const prefix = locale === defaultLocale ? '' : `/${locale}`

  const check = (text: string) => {
    const found = quickCheckFindings(text)
    // Messaggio intero: niente salto a uno strumento solo (una mail con un link
    // finiva in SVAT e il resto si perdeva): si sceglie qui
    if (isWholeMessage(text)) {
      setUnknown(false)
      setMessage(true)
      setFindings(found)
      return
    }
    setMessage(false)
    if (found.length === 0) {
      setFindings(null)
      setUnknown(true)
      return
    }
    if (found.length === 1) {
      router.push(`${prefix}${found[0].path}`)
      return
    }
    setUnknown(false)
    setFindings(found)
  }

  // Contenuto arrivato dal menu «Condividi» del telefono: si controlla subito
  useEffect(() => {
    if (autoRun && initialText.trim() && !ran.current) {
      ran.current = true
      check(initialText)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura
  }, [])

  // «Analizza tutto il messaggio»: il testo va a CheckMail nella memoria della scheda
  const analyzeMessage = () => {
    try {
      sessionStorage.setItem(MESSAGE_HANDOFF_KEY, JSON.stringify({ text: value.slice(0, 4000), at: Date.now() }))
    } catch {
      // memoria non disponibile: CheckMail si apre vuoto
    }
    router.push(`${prefix}/marketplace/checkmail`)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    check(value)
  }

  return (
    <form onSubmit={submit} className={`${className} rounded-2xl border border-[var(--gold)]/35 bg-white p-4 shadow-sm sm:p-5`} noValidate>
      <label htmlFor={inputId} className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
        <ShieldCheck className="h-5 w-5 text-[var(--gold)]" aria-hidden />
        {title ?? t('checkBoxTitle')}
      </label>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('checkBoxText')}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          id={inputId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setUnknown(false)
            setFindings(null)
            setMessage(false)
          }}
          onKeyDown={(event) => {
            // Invio controlla (Maiusc+Invio va a capo, per chi incolla un messaggio)
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              if (value.trim()) check(value)
            }
          }}
          rows={value.length > 60 || value.includes('\n') ? 4 : 1}
          maxLength={4000}
          placeholder={t('checkBoxPlaceholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={unknown}
          className="min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="min-h-11 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('checkBoxButton')}
        </button>
      </div>
      <Link href="/marketplace/verifoto" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        <Camera className="h-4 w-4" aria-hidden /> {t('checkBoxPhoto')}
      </Link>
      <div aria-live="polite">
        {unknown && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('checkBoxUnknown')}</p>}
        {message && (
          <button
            type="button"
            onClick={analyzeMessage}
            className="mt-3 flex w-full items-center gap-3 rounded-xl bg-[var(--ink)] px-4 py-3 text-left text-white transition-colors hover:bg-black"
          >
            <MailSearch className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{t('checkMessageTitle')}</span>
              <span className="block text-xs text-white/70">{t('checkMessageText')}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" aria-hidden />
          </button>
        )}
        {findings && findings.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-semibold text-[var(--ink)]">{message ? t('checkMessageOne') : t('checkBoxFound', { n: findings.length })}</p>
            <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {findings.map((f) => {
                const Icon = KIND_ICON[f.kind]
                return (
                  <li key={`${f.kind}-${f.value}`}>
                    <Link href={f.path} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--gold)]/5">
                      <Icon className="h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-[var(--muted)]">{t(`checkKind_${f.kind}`)}</span>
                        <span className="block truncate text-sm font-semibold text-[var(--ink)]">{f.value}</span>
                      </span>
                      <span className="hidden whitespace-nowrap text-xs font-semibold text-[var(--gold)] sm:inline">{t(`checkWith_${f.kind}`)}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--gold)]" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </form>
  )
}
