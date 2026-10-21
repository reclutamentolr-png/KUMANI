'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check, Dices, HeartHandshake, LoaderCircle, ShieldCheck } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { saveAffinityMap } from '@/app/actions/affinity'
import {
  AFFINITY_AXES,
  compatibilityTier,
  computeAffinityMap,
  computeArchetype,
  computeCompatibility,
  type AffinityArchetype,
  type AffinityMap,
} from '@/lib/affinity'
import AffinityQuiz from './AffinityQuiz'
import AffinityRadar from './AffinityRadar'
import ArchetypeIcon from './ArchetypeIcon'

type Owner = { firstName: string; archetype: AffinityArchetype; map: AffinityMap; referralCode: string | null }

const OWNER_COLOR = '#a78bfa'
const YOU_COLOR = '#e7c56a'

// Link "Gioca in Duo": chi lo riceve fa il gioco (anche senza account) e
// vede la compatibilità con chi l'ha condiviso. Per chi non è iscritto non
// si salva nulla; chi è iscritto può salvare la propria mappa.
export default function AffinityDuo({ owner, isLoggedIn }: { owner: Owner; isLoggedIn: boolean }) {
  const t = useTranslations('affinity')
  const [mode, setMode] = useState<'intro' | 'quiz' | 'result'>('intro')
  const [mine, setMine] = useState<{ map: AffinityMap; archetype: AffinityArchetype } | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  const axisLabels = Object.fromEntries(AFFINITY_AXES.map((axis) => [axis, t(`axis_${axis}`)]))

  const finish = (answers: number[]) => {
    const map = computeAffinityMap(answers)
    setMine({ map, archetype: computeArchetype(map, answers) })
    setMode('result')
  }

  const save = async () => {
    if (!mine) return
    setSaveState('saving')
    try {
      const result = await saveAffinityMap(mine.map, mine.archetype)
      setSaveState(result.success ? 'saved' : 'error')
    } catch {
      setSaveState('error')
    }
  }

  if (mode === 'intro') {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
          <HeartHandshake className="h-8 w-8" />
        </span>
        <h1 className="mt-5 text-3xl font-bold">{t('duoInvite', { name: owner.firstName })}</h1>
        <p className="mt-3 leading-7 text-white/75">{t('duoInviteBody')}</p>
        <button
          type="button"
          onClick={() => setMode('quiz')}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-8 py-4 text-lg font-bold text-[var(--ink)] shadow-lg hover:brightness-110"
        >
          <Dices className="h-5 w-5" /> {t('start')}
        </button>
        <p className="mx-auto mt-6 flex max-w-md items-start justify-center gap-2 text-xs leading-5 text-white/50">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {t('duoPrivacy')}
        </p>
      </div>
    )
  }

  if (mode === 'quiz' || !mine) {
    return (
      <div className="rounded-3xl bg-[var(--background)] p-5 text-[var(--ink)] sm:p-8">
        <AffinityQuiz onComplete={finish} />
      </div>
    )
  }

  const percent = computeCompatibility(mine.map, owner.map)
  const tier = compatibilityTier(percent)

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--gold)]/30 bg-white/[0.04] p-6 text-center sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('compatibility')}</p>
        <p className="mt-2 text-6xl font-bold text-white">{percent}%</p>
        <p className="mt-3 font-semibold text-[var(--gold-bright)]">
          {t('duoPair', { a: t(`arch_${mine.archetype}_name`), b: t(`arch_${owner.archetype}_name`) })}
        </p>
        <p className="mt-2 text-white/75">{t(`compat_${tier}`)}</p>

        <div className="mt-6">
          <AffinityRadar
            series={[
              { map: owner.map, color: OWNER_COLOR },
              { map: mine.map, color: YOU_COLOR },
            ]}
            labels={axisLabels}
            dark
          />
          <div className="mt-2 flex justify-center gap-5 text-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: YOU_COLOR }} /> {t('you')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full" style={{ background: OWNER_COLOR }} /> {owner.firstName}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('yourArchetype')}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
            <ArchetypeIcon archetype={mine.archetype} className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-bold">{t(`arch_${mine.archetype}_name`)}</h2>
        </div>
        <p className="mt-3 leading-7 text-white/75">{t(`arch_${mine.archetype}_desc`)}</p>
      </div>

      {isLoggedIn ? (
        saveState === 'saved' ? (
          <Link
            href="/marketplace/affinity"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
          >
            <Check className="h-5 w-5" /> {t('duoSaved')} <ArrowRight className="h-5 w-5" />
          </Link>
        ) : (
          <div>
            <button
              type="button"
              onClick={save}
              disabled={saveState === 'saving'}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-60"
            >
              {saveState === 'saving' && <LoaderCircle className="h-5 w-5 animate-spin" />} {t('duoSaveCta')}
            </button>
            {saveState === 'error' && <p className="mt-3 text-center text-sm text-amber-200">{t('saveError')}</p>}
          </div>
        )
      ) : (
        <Link
          href={owner.referralCode ? `/register?invito=${encodeURIComponent(owner.referralCode)}` : '/register'}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
        >
          {t('duoRegisterCta')} <ArrowRight className="h-5 w-5" />
        </Link>
      )}

      <button type="button" onClick={() => setMode('quiz')} className="block w-full text-center text-sm text-white/60 hover:text-white">
        {t('replay')}
      </button>
    </div>
  )
}
