'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Dices, LayoutGrid, Share2, Star } from 'lucide-react'
import { DRAWINGS, drawingById, pickDrawing } from '@/lib/kids/catalog'
import { standaloneSvg } from '@/lib/kids/export'
import type { CurrentDrawing, KidProfile } from '@/lib/kids/storage'
import ColorStage, { KidsButton } from './ColorStage'
import { speak } from './kidsAudio'
import type { KidsActions } from './actions'

// «Colora e Anima»: i 19 disegni del catalogo, uno a caso o scelto
export default function ColoringGame({
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
  const [chooser, setChooser] = useState(false)

  // Disegno in corso (ripreso da dove era rimasto) o uno nuovo a caso
  const current: CurrentDrawing = useMemo(() => {
    if (profile.current && drawingById(profile.current.drawingId)) return profile.current
    const d = pickDrawing({ age: profile.age, gender: profile.gender, recent: profile.recent, done: profile.done })
    return { drawingId: d.id, fills: {}, awake: false, mission: null }
  }, [profile])
  const drawing = drawingById(current.drawingId)!

  // Il disegno scelto a caso si salva subito: riaprendo si ritrova lo stesso
  useEffect(() => {
    if (!profile.current) onProfileChange({ ...profile, recent: [...profile.recent, current.drawingId].slice(-6), current })
  }, [profile, current, onProfileChange])

  // Disegno finito: segnato tra quelli già colorati (stella nella griglia)
  const onState = useCallback(
    (next: Partial<CurrentDrawing>, extra: Partial<KidProfile> = {}) => {
      const done = next.awake && !profile.done.includes(current.drawingId) ? { done: [...profile.done, current.drawingId] } : {}
      onProfileChange({ ...profile, ...extra, ...done, current: { ...current, ...next } })
    },
    [profile, current, onProfileChange]
  )

  const title = t(`drawings.${drawing.id}`)

  const startDrawing = (id?: string) => {
    const d = id ? drawingById(id)! : pickDrawing({ age: profile.age, gender: profile.gender, recent: [...profile.recent, current.drawingId], done: profile.done })
    setChooser(false)
    onProfileChange({
      ...profile,
      recent: [...profile.recent.filter((r) => r !== d.id), d.id].slice(-6),
      current: { drawingId: d.id, fills: {}, awake: false, mission: null },
    })
    if (voice) speak(t('newDrawingSay', { drawing: t(`drawings.${d.id}`) }), locale)
  }

  const finished = (fills: Record<string, string>) => {
    void actions
      .makePng(standaloneSvg(drawing.svg, fills), title)
      .then((png) => actions.saveToAlbum({ drawingId: drawing.id, png }))
      .catch(() => {})
  }

  const share = async () => {
    try {
      const png = await actions.makePng(standaloneSvg(drawing.svg, current.fills), title)
      actions.openShare({ drawingId: drawing.id, title, png, blankSvg: standaloneSvg(drawing.svg, {}, true) })
    } catch {
      actions.toast(t('exportError'))
    }
  }

  return (
    <>
      <ColorStage
        key={drawing.id}
        drawing={drawing}
        state={current}
        onState={onState}
        profile={profile}
        sound={sound}
        voice={voice}
        praise={() => ({ text: t('praise', { name: profile.name, gender: profile.gender }), voice: t('praiseVoice', { gender: profile.gender }) })}
        onFinished={finished}
      >
        <KidsButton onClick={() => startDrawing()} accent>
          <Dices className="h-5 w-5" /> {t('newDrawing')}
        </KidsButton>
        <KidsButton onClick={() => setChooser(true)} label={t('chooseDrawing')}>
          <LayoutGrid className="h-5 w-5" />
        </KidsButton>
        {current.awake && (
          <KidsButton onClick={() => void share()}>
            <Share2 className="h-5 w-5" /> {t('saveShare')}
          </KidsButton>
        )}
      </ColorStage>

      {/* Scegli il disegno */}
      {chooser && (
        <div className="fixed inset-0 z-10 flex flex-col bg-[#F3F7FB] p-4" role="dialog" aria-modal="true" aria-label={t('chooseDrawing')}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-extrabold text-[#2B2D52]">{t('chooseDrawing')}</h2>
            <button type="button" onClick={() => setChooser(false)} className="rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 py-2 font-extrabold text-[#2B2D52]">
              {t('close')}
            </button>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-3 overflow-y-auto pb-6 sm:grid-cols-4 md:grid-cols-5">
            {DRAWINGS.map((d) => (
              <button key={d.id} type="button" onClick={() => startDrawing(d.id)} className="relative overflow-hidden rounded-2xl border-[3px] border-[#2B2D52] bg-white p-1 text-center">
                <svg viewBox="0 0 400 440" className="kids-svg asleep pointer-events-none block w-full" dangerouslySetInnerHTML={{ __html: d.svg }} aria-hidden />
                <span className="block truncate px-1 pb-1 text-sm font-extrabold text-[#2B2D52]">{t(`drawings.${d.id}`)}</span>
                {profile.done.includes(d.id) && (
                  <span className="absolute right-1 top-1 rounded-full bg-[#FFC93C] p-1 text-[#2B2D52]" aria-label={t('doneBadge')}>
                    <Star className="h-4 w-4 fill-current" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
