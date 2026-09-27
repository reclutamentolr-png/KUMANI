'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Dices, HeartHandshake, LoaderCircle, RotateCcw, Share2, ShieldCheck, Trash2 } from 'lucide-react'
import { deleteAffinityMap, saveAffinityMap } from '@/app/actions/affinity'
import { AFFINITY_AXES, computeAffinityMap, computeArchetype, type AffinityArchetype, type AffinityMap } from '@/lib/affinity'
import { renderAffinityShareCard } from '@/lib/affinityShareCard'
import AffinityFriends from './AffinityFriends'
import AffinityQuiz from './AffinityQuiz'
import AffinityRadar from './AffinityRadar'
import ArchetypeIcon from './ArchetypeIcon'

type Saved = { map: AffinityMap; archetype: AffinityArchetype; duoCode: string }

// Strumento Affinity (utente iscritto): introduzione → 20 domande →
// risultato salvato (mappa + archetipo), immagine da condividere, link Duo.
export default function AffinityGame({ initial, siteUrl }: { initial: Saved | null; siteUrl: string }) {
  const t = useTranslations('affinity')
  const [saved, setSaved] = useState<Saved | null>(initial)
  const [mode, setMode] = useState<'intro' | 'quiz' | 'result'>(initial ? 'result' : 'intro')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const axisLabels = Object.fromEntries(AFFINITY_AXES.map((axis) => [axis, t(`axis_${axis}`)]))

  const finish = async (answers: number[]) => {
    const map = computeAffinityMap(answers)
    const archetype = computeArchetype(map, answers)
    setBusy(true)
    setError(null)
    try {
      const result = await saveAffinityMap(map, archetype)
      if (!result.success || !result.duoCode) throw new Error('save')
      setSaved({ map, archetype, duoCode: result.duoCode })
      setMode('result')
    } catch {
      setError(t('saveError'))
      setMode('intro')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm(t('deleteConfirm'))) return
    setBusy(true)
    const result = await deleteAffinityMap()
    setBusy(false)
    if (result.success) {
      setSaved(null)
      setMode('intro')
    }
  }

  const shareImage = async () => {
    if (!saved) return
    const blob = await renderAffinityShareCard(saved.map, {
      eyebrow: t('cardEyebrow'),
      archetypeName: t(`arch_${saved.archetype}_name`),
      archetypeLine: t(`arch_${saved.archetype}_short`),
      axisLabels,
      footer: t('cardFooter'),
      site: siteUrl.replace(/^https?:\/\//, ''),
    })
    if (!blob) return
    const file = new File([blob], `kumani-affinity-${saved.archetype}.png`, { type: 'image/png' })
    const text = t('shareText', { archetype: t(`arch_${saved.archetype}_name`) })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text })
      } catch {
        // Condivisione annullata.
      }
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const shareDuo = async () => {
    if (!saved) return
    const url = `${window.location.origin}/affinity/duo/${saved.duoCode}`
    const text = t('duoShareText')
    if (navigator.share) {
      try {
        await navigator.share({ title: 'KUMANI Affinity', text, url })
      } catch {
        // Condivisione annullata.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Appunti non disponibili.
    }
  }

  if (busy && mode === 'quiz') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-[var(--muted)]">
        <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold)]" /> {t('saving')}
      </div>
    )
  }

  if (mode === 'quiz') return <AffinityQuiz onComplete={finish} />

  if (mode === 'intro' || !saved) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-lg leading-8 text-[var(--muted)]">{t('intro')}</p>
        {error && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{error}</p>}
        <button
          type="button"
          onClick={() => setMode('quiz')}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-8 py-4 text-lg font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
        >
          <Dices className="h-5 w-5" /> {t('start')}
        </button>
        <p className="mx-auto mt-6 flex max-w-md items-start justify-center gap-2 text-xs leading-5 text-[var(--muted)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('privacyNote')}
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="grid items-center gap-6 rounded-3xl border border-[var(--gold)]/30 bg-[var(--ink)] p-6 text-white sm:grid-cols-2 sm:p-8">
        <div className="text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('yourArchetype')}</p>
          <div className="mt-3 flex items-center justify-center gap-3 sm:justify-start">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
              <ArchetypeIcon archetype={saved.archetype} className="h-7 w-7" />
            </span>
            <h2 className="text-3xl font-bold">{t(`arch_${saved.archetype}_name`)}</h2>
          </div>
          <p className="mt-4 leading-7 text-white/80">{t(`arch_${saved.archetype}_desc`)}</p>
        </div>
        <div>
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{t('yourMap')}</p>
          <AffinityRadar series={[{ map: saved.map, color: '#e7c56a' }]} labels={axisLabels} dark />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={shareImage}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3.5 font-bold text-[var(--ink)] shadow-sm hover:brightness-110"
        >
          <Share2 className="h-5 w-5" /> {t('shareImage')}
        </button>
        <button
          type="button"
          onClick={() => setMode('quiz')}
          className="flex items-center justify-center gap-2 rounded-xl border-2 border-[var(--gold)]/40 bg-white px-5 py-3.5 font-bold text-[var(--ink)] hover:border-[var(--gold)]"
        >
          <RotateCcw className="h-5 w-5" /> {t('replay')}
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-6">
        <div className="flex items-start gap-3">
          <HeartHandshake className="mt-0.5 h-7 w-7 shrink-0 text-[var(--gold)]" />
          <div className="flex-1">
            <h3 className="font-bold text-[var(--ink)]">{t('duoTitle')}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('duoBody')}</p>
            <button
              type="button"
              onClick={shareDuo}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ink-soft)]"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />} {copied ? t('duoCopied') : t('duoShare')}
            </button>
          </div>
        </div>
      </div>

      <AffinityFriends myMap={saved.map} />

      <div className="flex flex-col items-center gap-2 text-center text-xs text-[var(--muted)]">
        <p className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('privacyNote')}
        </p>
        <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-1.5 font-semibold text-red-500 hover:text-red-700">
          <Trash2 className="h-3.5 w-3.5" /> {t('deleteMap')}
        </button>
      </div>
    </div>
  )
}
