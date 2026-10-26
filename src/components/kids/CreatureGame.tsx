'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Ban, Check, Dices, Pencil, Share2, Sparkles } from 'lucide-react'
import { CREATURE_PARTS, assembleCreature, type CreatureSelection } from '@/lib/kids/creature'
import { OPTIONAL, PICK_ORDER, SLOTS, type Slot } from '@/lib/kids/creature/types'
import { standaloneSvg } from '@/lib/kids/export'
import { KIDS_SVG_CSS, applyPivots } from '@/lib/kids/moves'
import type { CreatureState, CurrentDrawing, KidProfile } from '@/lib/kids/storage'
import ColorStage, { KidsButton } from './ColorStage'
import { melody, speak, tone } from './kidsAudio'
import type { KidsActions } from './actions'
import KidChip from './KidChip'

// «Crea il tuo animale»: si sceglie un pezzo per volta (testa, orecchie o
// corna, corpo, braccia, piedi, coda, ali), poi si colora la creatura, che si
// sveglia, si anima e ha un nome inventato.

const rand = () => Math.random()

// Riquadro di ogni pezzo nelle miniature (coordinate del disegno)
const THUMB_BOX: Record<Slot, string> = {
  testa: '110 55 180 180',
  sopra: '90 20 220 150',
  corpo: '110 205 180 195',
  braccia: '80 225 240 135',
  piedi: '100 360 200 60',
  coda: '235 200 145 200',
  ali: '25 140 350 215',
}

const randomSelection = (): CreatureSelection =>
  Object.fromEntries(
    SLOTS.map((s) => {
      const list = CREATURE_PARTS[s]
      // I pezzi facoltativi a volte restano vuoti (non tutte le creature hanno le ali)
      if (OPTIONAL.includes(s) && rand() < 0.3) return [s, null]
      return [s, list[Math.floor(rand() * list.length)]?.id ?? null]
    })
  ) as CreatureSelection

export default function CreatureGame({
  profile,
  sound,
  voice,
  onProfileChange,
  actions,
}: {
  profile: KidProfile
  sound: boolean
  voice: boolean
  onProfileChange: (profile: KidProfile) => void
  actions: KidsActions
}) {
  const t = useTranslations('kids')
  const locale = useLocale()
  const names = useMemo(() => t('creatureNames').split('|'), [t])
  const [slot, setSlot] = useState<Slot>('testa')

  const pickName = useCallback(() => names[Math.floor(rand() * names.length)], [names])

  const creature: CreatureState = useMemo(
    () => profile.creature ?? { drawingId: 'creatura', sel: Object.fromEntries(SLOTS.map((s) => [s, CREATURE_PARTS[s][0]?.id ?? null])) as CreatureSelection, fills: {}, awake: false, mission: null, name: '', step: 'build' },
    [profile.creature]
  )
  const drawing = useMemo(() => assembleCreature(creature.sel), [creature.sel])

  // Prima creatura: pezzi a caso e un nome, salvati subito
  useEffect(() => {
    if (!profile.creature) onProfileChange({ ...profile, creature: { ...creature, sel: randomSelection(), name: pickName() } })
  }, [profile, creature, onProfileChange, pickName])

  const save = useCallback((next: Partial<CreatureState>, extra: Partial<KidProfile> = {}) => onProfileChange({ ...profile, ...extra, creature: { ...creature, ...next } }), [profile, creature, onProfileChange])
  // Creatura finita: si conta tra quelle create
  const onState = useCallback(
    (next: Partial<CurrentDrawing>, extra: Partial<KidProfile> = {}) => save(next, next.awake ? { ...extra, creatures: (profile.creatures ?? 0) + 1 } : extra),
    [save, profile.creatures]
  )

  const say = (text: string) => voice && speak(text, locale)

  const choose = (s: Slot, id: string | null) => {
    if (sound) tone(PICK_ORDER.indexOf(s) * 2, 0.08)
    save({ sel: { ...creature.sel, [s]: id }, awake: false, mission: null })
  }
  const surprise = () => {
    if (sound) melody([0, 4, 7], 90)
    save({ sel: randomSelection(), awake: false, mission: null })
  }
  const newCreature = () => {
    if (sound) melody([7, 4, 0], 90)
    save({ sel: randomSelection(), fills: {}, awake: false, mission: null, name: pickName(), step: 'build' })
    setSlot('testa')
  }
  const toColor = () => {
    if (sound) melody([0, 2, 4, 7], 110)
    say(t('creatureReady'))
    save({ step: 'color' })
  }

  const title = creature.name || t('drawings.creatura')

  const finished = (fills: Record<string, string>) => {
    void actions
      .makePng(standaloneSvg(drawing.svg, fills), title)
      .then((png) => actions.saveToAlbum({ drawingId: 'creatura', png }))
      .catch(() => {})
  }

  const share = async () => {
    try {
      const png = await actions.makePng(standaloneSvg(drawing.svg, creature.fills), title)
      actions.openShare({ drawingId: 'creatura', title, png, blankSvg: standaloneSvg(drawing.svg, {}, true) })
    } catch {
      actions.toast(t('exportError'))
    }
  }

  const nameChip = (
    <div className="flex items-center justify-center gap-2">
      <span className="rounded-full border-[3px] border-[#2B2D52] bg-white px-4 py-1.5 text-lg font-extrabold text-[#2B2D52]">{t('creatureName', { name: title })}</span>
      <button
        type="button"
        onClick={() => {
          const name = pickName()
          if (sound) tone(9, 0.08)
          save({ name })
          say(name)
        }}
        aria-label={t('creatureNewName')}
        title={t('creatureNewName')}
        className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-[#2B2D52] bg-[#FFC93C] text-[#2B2D52]"
      >
        <Dices className="h-5 w-5" />
      </button>
    </div>
  )

  if (creature.step === 'color') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {nameChip}
        <ColorStage
          drawing={drawing}
          state={creature}
          onState={onState}
          profile={profile}
          sound={sound}
          voice={voice}
          praise={() => ({ text: t('creaturePraise', { name: profile.name, creature: title }), voice: t('creaturePraiseVoice') })}
          onFinished={finished}
        >
          <KidsButton onClick={() => save({ step: 'build', awake: false, mission: null })}>
            <Pencil className="h-5 w-5" /> {t('creatureChangeParts')}
          </KidsButton>
          <KidsButton onClick={newCreature} accent>
            <Sparkles className="h-5 w-5" /> {t('creatureNew')}
          </KidsButton>
          {creature.awake && (
            <KidsButton onClick={() => void share()}>
              <Share2 className="h-5 w-5" /> {t('saveShare')}
            </KidsButton>
          )}
        </ColorStage>
      </div>
    )
  }

  // Costruzione: anteprima, schede dei pezzi, miniature
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <style>{KIDS_SVG_CSS}</style>
      {nameChip}
      <div className="flex min-h-[140px] flex-1 items-center justify-center [container-type:size]">
        <div className="relative">
          <KidChip />
          <div className="relative mx-auto aspect-[400/440] w-[min(calc(100cqw-104px),calc((100cqh-6px)*0.909))] overflow-hidden rounded-[22px] border-[3px] border-[#2B2D52] bg-white shadow-[5px_5px_0_#2B2D52]">
            <PreviewSvg svg={drawing.svg} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t('creatureParts')}>
        {PICK_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={slot === s}
            onClick={() => setSlot(s)}
            className={`shrink-0 rounded-full border-[3px] border-[#2B2D52] px-3 py-1.5 text-sm font-extrabold text-[#2B2D52] ${slot === s ? 'bg-[#FFC93C]' : 'bg-white'}`}
          >
            {t(`creature.slots.${s}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="tabpanel">
        {OPTIONAL.includes(slot) && (
          <PartButton active={!creature.sel[slot]} label={t('creatureNone')} onClick={() => choose(slot, null)}>
            <Ban className="h-8 w-8 text-[#61648A]" aria-hidden />
          </PartButton>
        )}
        {CREATURE_PARTS[slot].map((p) => (
          <PartButton key={p.id} active={creature.sel[slot] === p.id} label={t(`creature.parts.${slot}.${p.id}`)} onClick={() => choose(slot, p.id)}>
            <svg viewBox={THUMB_BOX[slot]} className="kids-svg h-14 w-full" dangerouslySetInnerHTML={{ __html: p.svg }} aria-hidden />
          </PartButton>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <KidsButton onClick={surprise}>
          <Dices className="h-5 w-5" /> {t('creatureRandom')}
        </KidsButton>
        <KidsButton onClick={toColor} accent>
          <Check className="h-5 w-5" /> {t('creatureDone')}
        </KidsButton>
      </div>
    </div>
  )
}

function PartButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={label} className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl border-[3px] border-[#2B2D52] p-1 ${active ? 'bg-[#FFF3C4] ring-4 ring-[#FFC93C]' : 'bg-white'}`}>
      {children}
      <span className="w-full truncate text-center text-[11px] font-extrabold text-[#2B2D52]">{label}</span>
    </button>
  )
}

// Anteprima della creatura mentre si sceglie (respira e sbatte gli occhi)
function PreviewSvg({ svg }: { svg: string }) {
  return (
    <svg
      viewBox="0 0 400 440"
      className="kids-svg alive mode-saluta pointer-events-none block h-full w-full"
      ref={(el) => {
        if (!el) return
        el.innerHTML = svg
        applyPivots(el)
      }}
      aria-hidden
    />
  )
}
