'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { FileUp, LoaderCircle, Smartphone } from 'lucide-react'
import CancelButton from '@/components/ui/CancelButton'
import { importContacts } from '@/app/actions/memolife'
import { cleanContact, emailKey, parseContactsFile, phoneKey, toVcf, type ImportedContact } from '@/lib/contactsImport'
import type { MemoContact } from './MemoLifeApp'

// Rubrica del telefono (Contact Picker API): oggi solo Chrome su Android
type PickedContact = { name?: string[]; tel?: string[]; email?: string[] }
type ContactsManager = { select: (props: string[], options: { multiple: boolean }) => Promise<PickedContact[]> }
const contactsApi = () => (typeof navigator !== 'undefined' ? (navigator as Navigator & { contacts?: ContactsManager }).contacts : undefined)

export function exportContactsVcf(contacts: MemoContact[]) {
  const blob = new Blob([toVcf(contacts)], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `contacts-${new Date().toLocaleDateString('sv-SE')}.vcf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ContactsImport({ existing, onDone }: { existing: MemoContact[]; onDone: () => void }) {
  const t = useTranslations('agenda')
  const fileInput = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<ImportedContact[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ added: number; updated: number; skipped: number; overLimit: number } | null>(null)
  const [canPick] = useState(() => !!contactsApi())

  // Quanti sono nuovi e quanti già in rubrica (stesso telefono o email)
  const preview = useMemo(() => {
    if (!items) return null
    const phones = new Set(existing.map((c) => phoneKey(c.phone)).filter(Boolean))
    const emails = new Set(existing.map((c) => emailKey(c.email)).filter(Boolean))
    let duplicates = 0
    for (const c of items) {
      const p = phoneKey(c.phone)
      const e = emailKey(c.email)
      if ((p && phones.has(p)) || (e && emails.has(e))) duplicates++
      else {
        if (p) phones.add(p)
        if (e) emails.add(e)
      }
    }
    return { total: items.length, duplicates, fresh: items.length - duplicates }
  }, [items, existing])

  const load = (list: ImportedContact[]) => {
    setResult(null)
    if (!list.length) {
      setItems(null)
      setError(t('importEmpty'))
      return
    }
    setError(null)
    setItems(list)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError(t('importTooBig'))
      return
    }
    const buffer = await file.arrayBuffer()
    // Excel salva spesso i CSV in Windows-1252: se l'UTF-8 non è valido si riprova
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    } catch {
      text = new TextDecoder('windows-1252').decode(buffer)
    }
    load(parseContactsFile(file.name, text))
  }

  const pickFromPhone = async () => {
    const api = contactsApi()
    if (!api) return
    try {
      const picked = await api.select(['name', 'tel', 'email'], { multiple: true })
      load(picked.map((p) => cleanContact({ name: p.name?.[0], phone: p.tel?.[0], email: p.email?.[0] })).filter((c): c is ImportedContact => !!c))
    } catch {
      // annullato dall'utente
    }
  }

  const confirm = async () => {
    if (!items) return
    setBusy(true)
    setError(null)
    const res = await importContacts(items)
    setBusy(false)
    if (!res.success) {
      setError(t(res.message === 'subscriptionRequired' ? 'importNoAccess' : 'importError'))
      return
    }
    setItems(null)
    setResult(res)
  }

  if (result) {
    return (
      <div>
        <div className="space-y-1 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-bold">{t('importAdded', { count: result.added })}</p>
          {result.updated > 0 && <p>{t('importUpdated', { count: result.updated })}</p>}
          {result.skipped > 0 && <p>{t('importSkipped', { count: result.skipped })}</p>}
        </div>
        {result.overLimit > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{t('importOverLimit', { count: result.overLimit })}</p>}
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onDone} className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-2.5 font-bold text-[var(--ink)] shadow-md hover:brightness-110">
            {t('importClose')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-4 text-sm text-[var(--muted)]">{t('importIntro')}</p>
      <div className={`grid gap-2 ${canPick ? 'sm:grid-cols-2' : ''}`}>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--gold-bright)]">
            <FileUp className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-semibold text-[var(--ink)]">{t('importFile')}</span>
            <span className="block text-xs text-[var(--muted)]">{t('importFileHint')}</span>
          </span>
        </button>
        {canPick && (
          <button
            type="button"
            onClick={pickFromPhone}
            className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Smartphone className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-semibold text-[var(--ink)]">{t('importPhone')}</span>
              <span className="block text-xs text-[var(--muted)]">{t('importPhoneHint')}</span>
            </span>
          </button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".vcf,.csv,text/vcard,text/x-vcard,text/csv"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <details className="mt-3 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer font-semibold">{t('importHowTitle')}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t('importHowAndroid')}</li>
          <li>{t('importHowIphone')}</li>
          <li>{t('importHowGoogle')}</li>
          <li>{t('importHowOutlook')}</li>
        </ul>
      </details>

      {preview && items && (
        <div className="mt-4 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/30 p-3">
          <p className="text-sm font-bold text-[var(--ink)]">{t('importFound', { count: preview.total })}</p>
          <p className="text-xs text-[var(--muted)]">
            {t('importNew', { count: preview.fresh })} · {t('importDuplicates', { count: preview.duplicates })}
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
            {items.slice(0, 50).map((c, i) => (
              <li key={i} className="truncate">
                <span className="font-semibold text-[var(--ink)]">{c.name}</span>
                <span className="text-xs text-[var(--muted)]"> {[c.phone, c.email].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
            {items.length > 50 && <li className="text-xs text-[var(--muted)]">{t('importMore', { count: items.length - 50 })}</li>}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}
      <div className="mt-5 flex items-center justify-end gap-2">
        <CancelButton />
        <button
          type="button"
          disabled={!items || busy}
          onClick={confirm}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-2.5 font-bold text-[var(--ink)] shadow-md hover:brightness-110 disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('importConfirm')}
        </button>
      </div>
    </div>
  )
}
