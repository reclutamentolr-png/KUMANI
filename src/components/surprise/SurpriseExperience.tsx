'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarClock, Gift, Lock, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { THEME_STYLE, type SurpriseView, type SurpriseViewStep } from '@/lib/surprise'

// Pagina di chi riceve (e anteprima di chi crea): scatola da aprire, tappe
// del percorso che si svelano nel tempo e buono finale.

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function Countdown({ to }: { to: string }) {
  const t = useTranslations('surprise')
  const router = useRouter()
  const now = useNow()
  const left = Math.max(0, new Date(to).getTime() - now)
  useEffect(() => {
    if (left === 0) {
      const id = setTimeout(() => router.refresh(), 1500)
      return () => clearTimeout(id)
    }
  }, [left, router])
  const d = Math.floor(left / 86_400_000)
  const h = Math.floor((left % 86_400_000) / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  return <span className="font-mono">{d > 0 ? t('countdownDays', { d, h, m }) : t('countdownHours', { h, m, s })}</span>
}

function Media({ url, type }: { url: string; type: 'image' | 'video' | 'audio' | null | undefined }) {
  if (type === 'video') return <video src={url} controls playsInline className="mt-3 w-full rounded-xl bg-black" />
  if (type === 'audio') return <audio src={url} controls className="mt-3 w-full" />
  // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo dello Storage
  return <img src={url} alt="" className="mt-3 w-full rounded-xl object-cover" />
}

function StepCard({ step, accent }: { step: SurpriseViewStep; accent: string }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  if (!step.open) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-5 text-white/80 backdrop-blur">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: accent }}>
          <Lock className="h-4 w-4" /> {t('day', { day: step.day })}
        </p>
        <p className="mt-2 font-semibold text-white">{t('lockedStep')}</p>
        <p className="mt-1 text-sm">
          {t('opensIn')} <Countdown to={step.unlockAt} />
        </p>
        <p className="mt-0.5 text-xs text-white/50">
          {new Date(step.unlockAt).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-white p-5 text-gray-800 shadow-xl">
      <p className="text-sm font-bold uppercase tracking-wider" style={{ color: accent }}>
        {t('day', { day: step.day })}
      </p>
      {step.title && <h3 className="mt-1 text-xl font-bold text-gray-900">{step.title}</h3>}
      {step.message && <p className="mt-2 whitespace-pre-wrap leading-relaxed">{step.message}</p>}
      {step.mediaUrl && <Media url={step.mediaUrl} type={step.mediaType} />}
      {step.hint && (
        <p className="mt-3 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: `${accent}1f`, color: '#333' }}>
          🔎 {step.hint}
        </p>
      )}
    </div>
  )
}

export default function SurpriseExperience({ view, preview = false, editorHref }: { view: SurpriseView; preview?: boolean; editorHref?: string }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const style = THEME_STYLE[view.theme]
  const [opened, setOpened] = useState(preview)
  const v = view.voucher

  return (
    <div className={`min-h-screen bg-gradient-to-b ${style.bg} px-4 pb-16 pt-8 text-white`}>
      {preview && (
        <div className="mx-auto mb-6 flex max-w-xl flex-wrap items-center justify-between gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm">
          <span>{t('previewBanner')}</span>
          {editorHref && (
            <Link href={editorHref} className="font-semibold underline">
              {t('backToEditor')}
            </Link>
          )}
        </div>
      )}
      <div className="mx-auto max-w-xl">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">{t('viewFor', { name: view.recipientName || '…' })}</p>
          {view.senderName && <p className="mt-1 text-white/80">{t('viewFrom', { name: view.senderName })}</p>}
        </div>

        {!opened ? (
          <button type="button" onClick={() => setOpened(true)} className="group mx-auto mt-14 flex flex-col items-center">
            <span
              className="flex h-40 w-40 items-center justify-center rounded-3xl shadow-2xl transition-transform group-hover:scale-105 group-active:scale-95 motion-safe:animate-[bounce_2.4s_ease-in-out_infinite]"
              style={{ background: `linear-gradient(135deg, ${style.accent}, #ffffff55)` }}
            >
              <Gift className="h-20 w-20 text-white drop-shadow" />
            </span>
            <span className="mt-8 rounded-full bg-white px-8 py-3 text-lg font-bold" style={{ color: style.accent }}>
              {t('openGift')}
            </span>
          </button>
        ) : (
          <div className="mt-8 space-y-4 motion-safe:animate-[fadeIn_0.6s_ease-out]">
            {view.kind !== 'voucher' && (
              <p className="flex items-center justify-center gap-2 text-center text-sm text-white/70">
                <CalendarClock className="h-4 w-4" /> {t('journeyIntro', { days: view.days })}
              </p>
            )}
            {view.steps.map((step) => (
              <StepCard key={step.id} step={step} accent={style.accent} />
            ))}

            {v.open ? (
              <div className={`overflow-hidden rounded-3xl ${style.card} ${style.text} shadow-2xl`}>
                {v.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- link firmato e temporaneo dello Storage
                  <img src={v.coverUrl} alt="" className="h-56 w-full object-cover" />
                )}
                <div className="p-6">
                  <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: style.accent }}>
                    <Sparkles className="h-4 w-4" /> {t('finalGift')}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold leading-tight">{v.title}</h2>
                  {v.message && <p className="mt-3 whitespace-pre-wrap leading-relaxed opacity-90">{v.message}</p>}
                  {v.howToUse && (
                    <div className="mt-4 rounded-xl bg-black/5 p-4">
                      <p className="text-sm font-bold">{t('howToUseTitle')}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{v.howToUse}</p>
                    </div>
                  )}
                  {v.validUntil && (
                    <p className="mt-3 text-sm opacity-70">
                      {t('validUntilView', { date: new Date(v.validUntil + 'T12:00:00').toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
                    </p>
                  )}
                  {view.senderName && <p className="mt-4 text-right font-semibold italic">— {view.senderName}</p>}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border-2 border-dashed border-white/25 p-6 text-center">
                <Gift className="mx-auto h-10 w-10" style={{ color: style.accent }} />
                <p className="mt-2 text-lg font-bold">{view.kind === 'voucher' ? t('voucherLocked') : t('finalLocked')}</p>
                <p className="mt-1 text-sm text-white/80">
                  {t('opensIn')} <Countdown to={v.unlockAt} />
                </p>
              </div>
            )}
          </div>
        )}

        <p className="mt-12 text-center text-xs text-white/50">
          {t('madeWith')}{' '}
          <Link href="/sorprese" className="font-semibold text-white/80 underline">
            {t('madeWithCta')}
          </Link>
        </p>
      </div>
    </div>
  )
}
