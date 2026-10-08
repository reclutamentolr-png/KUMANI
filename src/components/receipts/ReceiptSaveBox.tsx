'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BookmarkCheck, BookmarkPlus, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { claimReceipt } from '@/app/actions/digitalReceipt'

// Per chi riceve una ricevuta (anche con il piano Free): la salva nel proprio
// account e la ritrova in Wallet e Documenti. Senza account: registrazione
// gratuita con l'invito di chi l'ha emessa, e la ricevuta si salva da sola al
// primo ingresso (vedi PendingReceiptClaim).

export const PENDING_RECEIPT_KEY = 'kumani-pending-receipt'

export default function ReceiptSaveBox({
  code,
  savedByMe,
  canSave,
  loggedIn,
  signupHref,
  loginHref,
}: {
  code: string
  savedByMe: boolean
  canSave: boolean
  loggedIn: boolean
  signupHref: string
  loginHref: string
}) {
  const t = useTranslations('digitalReceipt')
  const [saved, setSaved] = useState(savedByMe)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  if (loggedIn && !saved && !canSave) return null

  const save = async () => {
    setBusy(true)
    setError(false)
    const r = await claimReceipt(code)
    setBusy(false)
    if (r === 'saved') setSaved(true)
    else setError(true)
  }
  const rememberForSignup = () => {
    try {
      localStorage.setItem(PENDING_RECEIPT_KEY, code)
    } catch {
      /* memoria del browser non disponibile */
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
          {saved ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}
        </span>
        <div>
          <p className="font-bold text-[var(--ink)]">{saved ? t('saveDoneTitle') : t('saveTitle')}</p>
          <p className="text-sm text-[var(--muted)]">{saved ? t('saveDoneText') : loggedIn ? t('saveText') : t('saveTextGuest')}</p>
        </div>
      </div>
      {saved ? (
        <Link href="/documenti" className="self-start rounded-xl border border-[var(--gold)]/50 bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
          {t('saveOpenDocuments')}
        </Link>
      ) : loggedIn ? (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-60"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('saveButton')}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            href={signupHref}
            onClick={rememberForSignup}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]"
          >
            {t('saveSignup')}
          </Link>
          <Link href={loginHref} className="inline-flex items-center justify-center rounded-xl border border-[var(--gold)]/50 bg-white px-4 py-2.5 text-sm font-bold text-[var(--ink)]">
            {t('saveLogin')}
          </Link>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{t('saveError')}</p>}
    </div>
  )
}
