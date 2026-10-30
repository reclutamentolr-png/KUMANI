'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, FileText, LoaderCircle, Pencil, PlusCircle, Search, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { askConfirm } from '@/lib/confirm'
import { limitTextOf } from '@/lib/limitText'
import { deleteCoverLetter, duplicateCoverLetter } from '@/app/actions/letteraPresentazione'
import { LETTER_LANG_NAMES, asLetterLang, type CoverLetterSummary } from '@/lib/letteraPresentazione'

// Elenco delle lettere (una per candidatura): apri, duplica, elimina

function shortDate(iso: string, locale: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome' }).format(d)
}

export default function LettereList({ initial, hasCv }: { initial: CoverLetterSummary[]; hasCv: boolean }) {
  const t = useTranslations('letteraPresentazione')
  const locale = useLocale()
  const [letters, setLetters] = useState(initial)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return letters
    return letters.filter((l) => [l.title, l.recipient_company, l.position].some((x) => x?.toLowerCase().includes(q)))
  }, [letters, search])

  const duplicate = async (l: CoverLetterSummary) => {
    setBusy(l.id)
    setMessage(null)
    try {
      const res = await duplicateCoverLetter(l.id, t('copySuffix'))
      if (!res.success) {
        setMessage({ ok: false, text: limitTextOf(res) ?? (t.has(`error_${res.message}`) ? t(`error_${res.message}`) : t('error_saveError')) })
        return
      }
      setLetters((all) => [res.data, ...all])
      setMessage({ ok: true, text: t('duplicated', { title: res.data.title }) })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (l: CoverLetterSummary) => {
    if (!(await askConfirm(t('deleteConfirm', { title: l.title })))) return
    setBusy(l.id)
    setMessage(null)
    try {
      const res = await deleteCoverLetter(l.id)
      if (!res.success) {
        setMessage({ ok: false, text: t('error_deleteError') })
        return
      }
      setLetters((all) => all.filter((x) => x.id !== l.id))
      setMessage({ ok: true, text: t('deleted') })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      {!hasCv && (
        <p className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
          {t('noCvTip')}{' '}
          <Link href="/app/kumani-cv" className="font-semibold underline">
            {t('noCvLink')}
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/app/lettera-presentazione/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
        >
          <PlusCircle className="h-5 w-5" /> {t('newLetter')}
        </Link>
        {letters.length > 4 && (
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--gold)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="w-full rounded-xl border-2 border-[var(--gold)]/20 bg-white py-2.5 pl-9 pr-3 text-base focus:border-[var(--gold)] focus:outline-none sm:text-sm"
            />
          </div>
        )}
      </div>

      {message && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </p>
      )}

      {letters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white px-6 py-14 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-[var(--gold)]" />
          <p className="font-semibold text-[var(--ink)]">{t('emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('emptyText')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('noResults')}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((l) => {
            const sub = [l.recipient_company, l.position].filter(Boolean).join(' · ')
            const date = l.letter_date ? shortDate(l.letter_date, locale) : ''
            return (
              <li key={l.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
                <Link href={`/app/lettera-presentazione/${l.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)]">
                    <FileText className="h-5 w-5 text-[var(--gold)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-[var(--ink)]">{l.title}</span>
                    {sub && <span className="block truncate text-sm text-gray-700">{sub}</span>}
                    <span className="block text-xs text-[var(--muted)]">
                      {[date && t('letterDate', { date }), LETTER_LANG_NAMES[asLetterLang(l.content_language)], t('updated', { date: shortDate(l.updated_at, locale) })].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
                <div className="flex gap-2 sm:shrink-0">
                  <Link
                    href={`/app/lettera-presentazione/${l.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white sm:flex-none"
                  >
                    <Pencil className="h-4 w-4" /> {t('open')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => duplicate(l)}
                    disabled={busy !== null}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--gold)]/40 bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-50 sm:flex-none"
                  >
                    {busy === l.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} {t('duplicate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(l)}
                    disabled={busy !== null}
                    aria-label={t('delete')}
                    title={t('delete')}
                    className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
