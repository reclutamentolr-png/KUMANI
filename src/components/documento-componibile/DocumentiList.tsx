'use client'

// Elenco dei documenti componibili: apri, duplica, elimina
import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, FileText, LoaderCircle, Pencil, PlusCircle, Search, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { askConfirm } from '@/lib/confirm'
import { limitTextOf } from '@/lib/limitText'
import { deleteComposableDocument, duplicateComposableDocument } from '@/app/actions/documentoComponibile'
import type { ComposableDocSummary } from '@/lib/documentoComponibile'

function shortDate(iso: string, locale: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(d)
}

export default function DocumentiList({ initial }: { initial: ComposableDocSummary[] }) {
  const t = useTranslations('documentoComponibile')
  const locale = useLocale()
  const [docs, setDocs] = useState(initial)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return docs
    return docs.filter((d) => d.title.toLowerCase().includes(q))
  }, [docs, search])

  const duplicate = async (d: ComposableDocSummary) => {
    if (busy) return
    setBusy(d.id)
    setMessage(null)
    try {
      const res = await duplicateComposableDocument(d.id, t('copySuffix'))
      if (!res.success) {
        setMessage({ ok: false, text: limitTextOf(res) ?? (t.has(`error_${res.message}`) ? t(`error_${res.message}`) : t('error_saveError')) })
        return
      }
      setDocs((all) => [res.data, ...all])
      setMessage({ ok: true, text: t('duplicated', { title: res.data.title }) })
    } catch {
      setMessage({ ok: false, text: t('error_saveError') })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (d: ComposableDocSummary) => {
    if (busy) return
    if (!(await askConfirm(t('deleteConfirm', { title: d.title })))) return
    setBusy(d.id)
    setMessage(null)
    try {
      const res = await deleteComposableDocument(d.id)
      if (!res.success) {
        setMessage({ ok: false, text: t('error_deleteError') })
        return
      }
      setDocs((all) => all.filter((x) => x.id !== d.id))
      setMessage({ ok: true, text: t('deleted') })
    } catch {
      setMessage({ ok: false, text: t('error_deleteError') })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/app/documento-componibile/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
        >
          <PlusCircle className="h-5 w-5" /> {t('newDoc')}
        </Link>
        {docs.length > 5 && (
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

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white px-6 py-14 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-[var(--gold)]" />
          <p className="font-semibold text-[var(--ink)]">{t('emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('emptyText')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-8 text-center text-sm text-[var(--muted)]">{t('noResults')}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((d) => (
            <li key={d.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
              <Link href={`/app/documento-componibile/${d.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)]">
                  <FileText className="h-5 w-5 text-[var(--gold)]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-[var(--ink)]">{d.title}</span>
                  <span className="block text-xs text-[var(--muted)]">
                    {t('fieldsCount', { n: d.field_count ?? 0 })} · {t('updated', { date: shortDate(d.updated_at, locale) })}
                  </span>
                </span>
              </Link>
              <div className="flex gap-2 sm:shrink-0">
                <Link
                  href={`/app/documento-componibile/${d.id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white sm:flex-none"
                >
                  <Pencil className="h-4 w-4" /> {t('open')}
                </Link>
                <button
                  type="button"
                  onClick={() => void duplicate(d)}
                  disabled={busy !== null}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--gold)]/40 bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-50 sm:flex-none"
                >
                  {busy === d.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} {t('duplicate')}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(d)}
                  disabled={busy !== null}
                  aria-label={t('delete')}
                  title={t('delete')}
                  className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
