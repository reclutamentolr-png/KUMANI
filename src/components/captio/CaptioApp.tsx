'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Copy, ImagePlus, LoaderCircle, Sparkles, X } from 'lucide-react'
import { generateCaptions } from '@/app/actions/captio'
import { CAPTIO_GOALS, CAPTIO_IMAGE_MAX_SIDE, CAPTIO_LENGTHS, CAPTIO_NETWORKS, CAPTIO_TONES, type CaptioRequest, type CaptioResult } from '@/lib/captio'

type Prefs = Omit<CaptioRequest, 'description' | 'cta' | 'image'>
const PREFS_KEY = 'kumani:captio:prefs'
const DEFAULT_PREFS: Prefs = { business: '', place: '', network: 'instagram', tone: 'friendly', goal: 'inform', length: 'medium', emoji: true }

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
    if (!raw) return DEFAULT_PREFS
    return {
      business: typeof raw.business === 'string' ? raw.business.slice(0, 200) : '',
      place: typeof raw.place === 'string' ? raw.place.slice(0, 80) : '',
      network: raw.network && CAPTIO_NETWORKS.includes(raw.network) ? raw.network : DEFAULT_PREFS.network,
      tone: raw.tone && CAPTIO_TONES.includes(raw.tone) ? raw.tone : DEFAULT_PREFS.tone,
      goal: raw.goal && CAPTIO_GOALS.includes(raw.goal) ? raw.goal : DEFAULT_PREFS.goal,
      length: raw.length && CAPTIO_LENGTHS.includes(raw.length) ? raw.length : DEFAULT_PREFS.length,
      emoji: raw.emoji !== false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

// Foto ridotta nel telefono (lato lungo 1024 px, JPEG): all'AI arriva solo questa
async function shrinkImage(file: File): Promise<{ base64: string; preview: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, CAPTIO_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const preview = canvas.toDataURL('image/jpeg', 0.82)
  return { base64: preview.split(',')[1], preview }
}

// KUMANI CAPTIO: descrivi il post (e, se vuoi, aggiungi la foto), scegli
// social, tono e obiettivo: tre didascalie diverse e gli hashtag da copiare.
export default function CaptioApp({ initialDescription = '', initialNetwork }: { initialDescription?: string; initialNetwork?: string }) {
  const t = useTranslations('captio')
  const locale = useLocale()
  const [prefs, setPrefs] = useState<Prefs>(() => {
    const p = readPrefs()
    return CAPTIO_NETWORKS.includes(initialNetwork as Prefs['network']) ? { ...p, network: initialNetwork as Prefs['network'] } : p
  })
  const [description, setDescription] = useState(initialDescription)
  const [cta, setCta] = useState('')
  const [image, setImage] = useState<{ base64: string; preview: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CaptioResult | null>(null)
  const [off, setOff] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const setPref = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        // facoltativo
      }
      return next
    })

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      setImage(await shrinkImage(file))
    } catch {
      setError(t('errorImage'))
    }
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const r = await generateCaptions({ ...prefs, description, cta, image: image?.base64 }, locale)
    setBusy(false)
    if (!r.success) return setError(t(`error_${r.message}` as 'error_aiError'))
    setResult(r.data)
    setOff(new Set())
    requestAnimationFrame(() => document.getElementById('captio-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const allTags = result ? [...result.hashtags.broad, ...result.hashtags.niche, ...result.hashtags.local] : []
  const chosenTags = allTags.filter((h) => !off.has(h)).join(' ')
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    } catch {
      // copia non riuscita: il testo resta selezionabile
    }
  }

  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 text-gray-600 hover:border-[var(--gold)]/60'}`
  const field = 'mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'
  const copyBtn = (key: string, text: string, label: string) => (
    <button
      type="button"
      onClick={() => copy(key, text)}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold ${copied === key ? 'bg-emerald-600 text-white' : 'bg-[var(--ink)] text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]'}`}
    >
      {copied === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied === key ? t('copied') : label}
    </button>
  )

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
        <p className="text-sm font-semibold text-[var(--ink)]">{t('network')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAPTIO_NETWORKS.map((n) => (
            <button key={n} type="button" onClick={() => setPref({ network: n })} aria-pressed={prefs.network === n} className={chip(prefs.network === n)}>
              {t(`network_${n}`)}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-sm font-semibold text-[var(--ink)]">
          {t('description')}
          <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} rows={3} placeholder={t('descriptionPlaceholder')} className={field} />
        </label>

        <div className="mt-3">
          {image ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- anteprima locale della foto scelta */}
              <img src={image.preview} alt="" className="h-20 w-20 rounded-xl object-cover" />
              <div className="text-sm text-[var(--muted)]">
                {t('imageAdded')}
                <button type="button" onClick={() => setImage(null)} className="mt-1 flex items-center gap-1 font-semibold text-gray-600 underline">
                  <X className="h-4 w-4" /> {t('imageRemove')}
                </button>
              </div>
            </div>
          ) : (
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--gold)]/50 px-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold)]/5">
              <ImagePlus className="h-4 w-4 text-[var(--gold)]" /> {t('imageAdd')}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
          )}
          <p className="mt-1 text-xs text-[var(--muted)]">{t('imageNote')}</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('business')}
            <input value={prefs.business} onChange={(e) => setPref({ business: e.target.value.slice(0, 200) })} placeholder={t('businessPlaceholder')} className={field} />
          </label>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('place')}
            <input value={prefs.place} onChange={(e) => setPref({ place: e.target.value.slice(0, 80) })} placeholder={t('placePlaceholder')} className={field} />
          </label>
        </div>

        <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('goal')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAPTIO_GOALS.map((g) => (
            <button key={g} type="button" onClick={() => setPref({ goal: g })} aria-pressed={prefs.goal === g} className={chip(prefs.goal === g)}>
              {t(`goal_${g}`)}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('tone')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAPTIO_TONES.map((tone) => (
            <button key={tone} type="button" onClick={() => setPref({ tone })} aria-pressed={prefs.tone === tone} className={chip(prefs.tone === tone)}>
              {t(`tone_${tone}`)}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-[var(--ink)]">{t('length')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {CAPTIO_LENGTHS.map((l) => (
            <button key={l} type="button" onClick={() => setPref({ length: l })} aria-pressed={prefs.length === l} className={chip(prefs.length === l)}>
              {t(`length_${l}`)}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <input type="checkbox" checked={prefs.emoji} onChange={(e) => setPref({ emoji: e.target.checked })} className="h-5 w-5 accent-[var(--gold)]" />
            {t('emoji')}
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold text-[var(--ink)]">
          {t('cta')}
          <input value={cta} onChange={(e) => setCta(e.target.value.slice(0, 200))} placeholder={t('ctaPlaceholder')} className={field} />
        </label>

        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy || (description.trim().length < 5 && !image)}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-base font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
          {busy ? t('writing') : result ? t('again') : t('generate')}
        </button>
      </section>

      {result && (
        <section id="captio-results" className="scroll-mt-24 space-y-4">
          {result.captions.map((c, i) => (
            <article key={i} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{t('option', { n: i + 1 })}</p>
              <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-[var(--ink)]">{c}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {copyBtn(`c${i}`, c, t('copy'))}
                {chosenTags && copyBtn(`ch${i}`, `${c}\n\n${chosenTags}`, t('copyWithTags'))}
              </div>
            </article>
          ))}

          {allTags.length > 0 && (
            <article className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
              <p className="font-bold text-[var(--ink)]">{t('hashtags')}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{t('hashtagsHint')}</p>
              {(['broad', 'niche', 'local'] as const).map((group) =>
                result.hashtags[group].length ? (
                  <div key={group} className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t(`tags_${group}`)}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {result.hashtags[group].map((h) => {
                        const on = !off.has(h)
                        return (
                          <button
                            key={h}
                            type="button"
                            aria-pressed={on}
                            onClick={() =>
                              setOff((s) => {
                                const next = new Set(s)
                                if (on) next.add(h)
                                else next.delete(h)
                                return next
                              })
                            }
                            className={`rounded-full px-2.5 py-1 text-sm font-semibold ${on ? 'bg-[var(--gold)]/15 text-[var(--ink)]' : 'bg-gray-100 text-gray-400 line-through'}`}
                          >
                            {h}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null
              )}
              <div className="mt-4">{chosenTags && copyBtn('tags', chosenTags, t('copyTags'))}</div>
            </article>
          )}
          <p className="text-center text-xs text-[var(--muted)]">{t('note')}</p>
        </section>
      )}
    </div>
  )
}
