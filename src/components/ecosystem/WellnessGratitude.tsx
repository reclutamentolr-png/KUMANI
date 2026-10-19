'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Heart, LoaderCircle, Plus, Shuffle, Trash2, X } from 'lucide-react'
import { addWellnessGratitude, deleteWellnessGratitude, listWellnessGratitude, type GratitudeNote, type WellnessToday } from '@/app/actions/ecosystem'

// «Una cosa bella di oggi»: una riga privata (fino a 3 al giorno) che finisce
// nel barattolo, da rileggere o cancellare. Conta per la serie, senza KU Karma.
const MAX_PER_DAY = 3

export default function WellnessGratitude({ state, onChange }: { state: WellnessToday; onChange: (state: WellnessToday) => void }) {
  const t = useTranslations('ecosystem')
  const locale = useLocale()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [jar, setJar] = useState<GratitudeNote[] | null>(null)
  const [open, setOpen] = useState(false)
  const [memory, setMemory] = useState<GratitudeNote | null>(null)
  const full = state.gratitude_today >= MAX_PER_DAY
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

  const add = async () => {
    if (!text.trim() || busy || full) return
    setBusy(true)
    const result = await addWellnessGratitude(text)
    setBusy(false)
    if (!result) return
    onChange(result)
    if (!result.error) {
      setText('')
      setJar(null)
    }
  }

  const loadJar = async () => {
    const notes = jar ?? (await listWellnessGratitude())
    setJar(notes)
    return notes
  }

  const pickMemory = async () => {
    const notes = await loadJar()
    if (!notes.length) return
    const others = notes.length > 1 && memory ? notes.filter((n) => n.id !== memory.id) : notes
    setMemory(others[Math.floor(Math.random() * others.length)])
  }

  const remove = async (id: string) => {
    if (!(await deleteWellnessGratitude(id))) return
    setJar((prev) => prev?.filter((n) => n.id !== id) ?? null)
    if (memory?.id === id) setMemory(null)
    onChange({ ...state, gratitude_total: Math.max(0, state.gratitude_total - 1) })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-rose-200 bg-white p-3.5">
      <div>
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
          <Heart className="h-4 w-4 text-rose-500" /> {t('wellnessGratitudeTitle')}
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{t('wellnessGratitudeHint')}</p>
      </div>
      {full ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{t('wellnessGratitudeLimit')}</p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <label htmlFor="wellness-gratitude" className="sr-only">
            {t('wellnessGratitudeTitle')}
          </label>
          <input
            id="wellness-gratitude"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder={t('wellnessGratitudePlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-rose-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
          />
          <button type="submit" disabled={!text.trim() || busy} aria-label={t('wellnessGratitudeAdd')} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-rose-500 px-3 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-40">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">{t('wellnessGratitudeAdd')}</span>
          </button>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="font-semibold text-[var(--muted)]">{t('wellnessJar', { count: state.gratitude_total })}</span>
        {state.gratitude_total > 0 && (
          <>
            <button type="button" onClick={pickMemory} className="inline-flex items-center gap-1 font-bold text-rose-700 hover:text-rose-900">
              <Shuffle className="h-3.5 w-3.5" /> {t('wellnessJarRandom')}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!open) await loadJar()
                setOpen(!open)
              }}
              className="font-bold text-rose-700 hover:text-rose-900"
            >
              {open ? t('wellnessJarClose') : t('wellnessJarOpen')}
            </button>
          </>
        )}
      </div>
      {memory && !open && (
        <figure className="relative rounded-lg bg-rose-50 px-3 py-2.5 pr-8">
          <blockquote className="text-sm italic text-rose-950">«{memory.body}»</blockquote>
          <figcaption className="mt-1 text-[11px] text-rose-700">{day(memory.day)}</figcaption>
          <button type="button" onClick={() => setMemory(null)} aria-label={t('wellnessJarClose')} className="absolute right-1.5 top-1.5 p-1 text-rose-400 hover:text-rose-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </figure>
      )}
      {open && jar && (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto">
          {jar.length === 0 && <li className="text-xs text-[var(--muted)]">{t('wellnessJarEmpty')}</li>}
          {jar.map((n) => (
            <li key={n.id} className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm text-rose-950">
                {n.body}
                <span className="block text-[11px] text-rose-700">{day(n.day)}</span>
              </span>
              <button type="button" onClick={() => remove(n.id)} aria-label={t('wellnessJarDelete')} className="p-1 text-rose-300 hover:text-rose-700">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
