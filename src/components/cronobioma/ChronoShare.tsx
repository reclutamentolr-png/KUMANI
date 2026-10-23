'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import localFont from 'next/font/local'
import { useTranslations } from 'next-intl'
import { Download, LoaderCircle, Share2 } from 'lucide-react'
import { CHRONOTYPE_EMOJI, fmt, type ChronoResult, type DayPlan } from '@/lib/cronobioma'
import ChronoClock from './ChronoClock'
import { useDuration } from './ChronoResult'

// Immagine da condividere: cronotipo, quadrante personale e invito a fare il
// test. La disegna il browser (niente file sul server) e diventa un PNG.
const inter = localFont({ src: '../../fonts/Inter.woff2', weight: '100 900' })
const playfair = localFont({ src: '../../fonts/PlayfairDisplay.woff2', weight: '400 900' })
const GOLD_TEXT = { background: 'linear-gradient(180deg,#f6dd8a 0%,#d4af37 55%,#a87f22 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } as const

type Format = 'post' | 'story'
const SIZE: Record<Format, { w: number; h: number }> = { post: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } }

type CardTexts = { eyebrow: string; name: string; sleep: string; jetlag: string; question: string; cta: string; link: string }

const ShareCard = forwardRef<HTMLDivElement, { format: Format; result: ChronoResult; plan: DayPlan; texts: CardTexts }>(function ShareCard({ format, result, plan, texts }, ref) {
  const story = format === 'story'
  const { w, h } = SIZE[format]
  return (
    <div
      ref={ref}
      className={inter.className}
      style={{
        width: w,
        height: h,
        background: 'radial-gradient(circle at 75% 12%, rgba(212,175,55,0.28), transparent 45%), radial-gradient(circle at 15% 90%, rgba(30,42,90,0.75), transparent 55%), #121212',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: story ? '110px 80px 100px' : '70px 80px 60px',
        boxSizing: 'border-box',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-gold.png" alt="" width={story ? 96 : 76} height={story ? 96 : 76} style={{ width: story ? 96 : 76, height: story ? 96 : 76, objectFit: 'contain' }} />
        <span className={playfair.className} style={{ fontSize: story ? 50 : 40, fontWeight: 800, letterSpacing: '0.18em', ...GOLD_TEXT }}>
          KUMANI
        </span>
      </div>
      <div style={{ marginTop: story ? 70 : 36, fontSize: story ? 34 : 28, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#f1d78a' }}>{texts.eyebrow}</div>
      <div style={{ marginTop: 10, fontSize: story ? 120 : 96, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.02em' }}>
        {CHRONOTYPE_EMOJI[result.chronotype]} <span style={GOLD_TEXT}>{texts.name}</span>
      </div>
      <div style={{ marginTop: story ? 50 : 20, width: story ? 760 : 560 }}>
        <ChronoClock className="h-auto w-full" bed={plan.bed} wake={plan.wake} events={plan.events} center={{ emoji: '', title: `${fmt(result.naturalBed)} – ${fmt(result.naturalWake)}`, sub: '' }} />
      </div>
      <div style={{ marginTop: story ? 40 : 18, fontSize: story ? 38 : 30, color: 'rgba(255,255,255,0.85)' }}>{texts.sleep}</div>
      <div style={{ marginTop: 8, fontSize: story ? 38 : 30, color: 'rgba(255,255,255,0.85)' }}>{texts.jetlag}</div>
      <div style={{ marginTop: 'auto', fontSize: story ? 64 : 50, fontWeight: 900, lineHeight: 1.1 }}>{texts.question}</div>
      <div
        style={{
          marginTop: story ? 40 : 24,
          padding: story ? '26px 44px' : '20px 36px',
          borderRadius: 999,
          background: 'linear-gradient(90deg,#c79a3b,#f1d78a)',
          color: '#171717',
          fontSize: story ? 36 : 30,
          fontWeight: 800,
        }}
      >
        {texts.cta} {texts.link}
      </div>
    </div>
  )
})

// shareUrl: il link del test con il codice d'invito di chi condivide
export default function ChronoShare({ result, plan, shareUrl }: { result: ChronoResult; plan: DayPlan; shareUrl: string }) {
  const t = useTranslations('cronobioma')
  const dur = useDuration()
  const [format, setFormat] = useState<Format>('post')
  const [busy, setBusy] = useState<'png' | 'share' | null>(null)
  const [error, setError] = useState(false)
  const [scale, setScale] = useState(0.3)
  const box = useRef<HTMLDivElement>(null)
  const node = useRef<HTMLDivElement>(null)
  const { w, h } = SIZE[format]
  const name = t(`type_${result.chronotype}`)
  const texts: CardTexts = {
    eyebrow: t('shareImgEyebrow'),
    name,
    sleep: t('shareImgSleep', { bed: fmt(result.naturalBed), wake: fmt(result.naturalWake) }),
    jetlag: t('shareImgJetlag', { time: dur(result.socialJetlag) }),
    question: t('shareImgQuestion'),
    cta: t('shareImgCta'),
    link: shareUrl.replace(/^https?:\/\//, '').replace(/\?.*$/, ''),
  }

  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setScale(el.clientWidth / w)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [w])

  const fileName = `KUMANI_cronobioma_${result.chronotype}_${format}.png`
  const renderPng = async () => {
    const { toPng } = await import('html-to-image')
    await document.fonts.ready
    return toPng(node.current!, { width: w, height: h, pixelRatio: 1, cacheBust: true, style: { transform: 'none' } })
  }

  const download = async () => {
    setBusy('png')
    setError(false)
    try {
      const a = document.createElement('a')
      a.href = await renderPng()
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      console.error('[cronobioma] immagine', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    setBusy('share')
    setError(false)
    const text = t('shareMessage', { name, emoji: CHRONOTYPE_EMOJI[result.chronotype], url: shareUrl })
    try {
      const file = new File([await (await fetch(await renderPng())).blob()], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text })
      else if (navigator.share) await navigator.share({ text })
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        console.error('[cronobioma] condivisione', e)
        setError(true)
      }
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--gold)]/30 bg-white p-5 sm:p-6">
      <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('shareTitle')}</h3>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('shareText')}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--ink)]">{t('shareChallenge')}</p>
      <div className="mt-4 flex gap-2">
        {(['post', 'story'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            aria-pressed={format === f}
            className={`min-h-10 rounded-xl border-2 px-4 text-sm font-semibold ${format === f ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 text-gray-600'}`}
          >
            {t(f === 'post' ? 'formatPost' : 'formatStory')}
          </button>
        ))}
      </div>
      <div ref={box} className={`mx-auto mt-4 overflow-hidden rounded-2xl shadow-lg ${format === 'story' ? 'max-w-[16rem]' : 'max-w-[22rem]'}`} style={{ height: h * scale }}>
        <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <ShareCard ref={node} format={format} result={result} plan={plan} texts={texts} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={share} disabled={busy !== null} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-60">
          {busy === 'share' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} {busy === 'share' ? t('shareMaking') : t('shareSend')}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={busy !== null}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 font-bold text-[var(--ink)] hover:brightness-105 disabled:opacity-60"
        >
          {busy === 'png' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {busy === 'png' ? t('shareMaking') : t('shareDownload')}
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{t('shareError')}</p>}
    </div>
  )
}
