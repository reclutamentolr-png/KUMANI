'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, Loader2, Plus, Radio, Trash2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useRouter } from 'next/navigation'
import { createWebinar, deleteWebinar } from '@/app/actions/webinar'
import { askConfirm } from '@/lib/confirm'
import type { WebinarStatus } from '@/lib/webinar'
import { useMounted } from '@/components/webinar/rtc'

export type WebinarListItem = { id: string; code: string; title: string; startsAt: string; status: WebinarStatus; viewers: number }

const field =
  'min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base shadow-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'

// Data e ora locali per il campo «datetime-local» (fra 30 minuti, arrotondate)
function defaultStart() {
  const d = new Date(Date.now() + 30 * 60_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function WebinarList({ items }: { items: WebinarListItem[] }) {
  const t = useTranslations('webinar')
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(items.length === 0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const mounted = useMounted()

  // Proposta «fra 30 minuti» nell'ora del browser, finché non si sceglie
  const startValue = startsAt || (mounted ? defaultStart() : '')

  const linkOf = (code: string) => `${window.location.origin}${locale === 'it' ? '' : `/${locale}`}/webinar/${code}`

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    const res = await createWebinar({ title, description, startsAt: new Date(startValue).toISOString() })
    setBusy(false)
    if ('error' in res) {
      setError(res.error === 'title' ? t('errorTitle') : res.error === 'date' ? t('errorDate') : res.error === 'too_many' ? t('errorTooMany') : t('errorGeneric'))
      return
    }
    router.push(`${locale === 'it' ? '' : `/${locale}`}/app/webinar/${res.id}`)
  }

  const remove = async (item: WebinarListItem) => {
    if (!(await askConfirm(t('deleteConfirm', { title: item.title }), { title: t('deleteTitle'), cancelLabel: t('endNo') }))) return
    await deleteWebinar(item.id)
    router.refresh()
  }

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(linkOf(code))
      setCopied(code)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
    }
  }

  // Ora locale del browser: dopo il primo disegno
  const when = (iso: string) => !mounted ? '' : new Date(iso).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      {open ? (
        <form onSubmit={create} className="space-y-4 rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-5">
          <h2 className="text-xl font-extrabold">{t('newTitle')}</h2>
          <div>
            <label htmlFor="w-title" className="mb-1.5 block text-sm font-bold">
              {t('fieldTitle')}
            </label>
            <input id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder={t('fieldTitlePlaceholder')} className={field} />
          </div>
          <div>
            <label htmlFor="w-start" className="mb-1.5 block text-sm font-bold">
              {t('fieldStart')}
            </label>
            <input id="w-start" type="datetime-local" value={startValue} onChange={(e) => setStartsAt(e.target.value)} required className={field} />
          </div>
          <div>
            <label htmlFor="w-desc" className="mb-1.5 block text-sm font-bold">
              {t('fieldDescription')} <span className="font-normal text-[var(--muted)]">({t('optional')})</span>
            </label>
            <textarea id="w-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} className={`${field} py-3`} />
          </div>
          <p className="rounded-2xl bg-[var(--gold-pale)] p-3 text-sm">{t('seatsNote')}</p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !title.trim()}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-6 font-bold text-[var(--gold-bright)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {t('create')}
            </button>
            {items.length > 0 && (
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-full px-4 font-semibold text-[var(--muted)] hover:bg-stone-100">
                {t('endNo')}
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-lg font-bold text-[var(--gold-bright)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
        >
          <Plus className="h-5 w-5" aria-hidden />
          {t('createCta')}
        </button>
      )}

      {items.length > 0 && (
        <section aria-labelledby="w-list">
          <h2 id="w-list" className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
            {t('myWebinars')}
          </h2>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {item.status === 'live' ? (
                    <span className="rounded-full bg-red-700 px-2.5 py-0.5 font-extrabold text-white">{t('liveBadge')}</span>
                  ) : item.status === 'ended' ? (
                    <span className="rounded-full bg-stone-200 px-2.5 py-0.5 font-bold text-stone-700">{t('endedBadge')}</span>
                  ) : null}
                  <span className="text-[var(--muted)]">{when(item.startsAt)}</span>
                </div>
                <h3 className="mt-1 text-lg font-extrabold">{item.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.status !== 'ended' && (
                    <Link
                      href={`/app/webinar/${item.id}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                    >
                      <Radio className="h-4 w-4" aria-hidden />
                      {item.status === 'live' ? t('backToStudio') : t('openStudio')}
                    </Link>
                  )}
                  {item.status !== 'ended' && (
                    <button
                      type="button"
                      onClick={() => copy(item.code)}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
                    >
                      <Copy className="h-4 w-4" aria-hidden />
                      {copied === item.code ? t('copied') : t('copyLink')}
                    </button>
                  )}
                  {item.status !== 'live' && (
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      aria-label={t('deleteAria', { title: item.title })}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[var(--muted)] hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      {t('delete')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
