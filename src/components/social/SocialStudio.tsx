'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Candy, Download, Ghost, LoaderCircle, MoonStar, Share2, Sparkles, type LucideIcon } from 'lucide-react'
import SocialCanvas, { SOCIAL_SIZE, type SocialFormat } from './SocialCanvas'
import { ICONS } from '@/components/flyers/FlyerCanvas'

// Documenti → Immagini per i social: si sceglie l'immagine (frasi di KUMANI o
// un servizio), il formato (post o storia) e se scrivere in basso il proprio
// link d'invito; poi «Scarica» o «Condividi» (con l'immagine allegata dove il
// telefono lo permette). Tutto nel browser: nessun file salvato.

export type SocialItem = {
  id: string
  group: 'general' | 'services'
  label: string
  icon: string
  eyebrow: string
  title: string
  gold: string
  sub: string
  points: { icon: string; text: string }[]
  // Tema stagionale della tela
  theme?: 'halloween'
}

type Texts = {
  choose: string
  groupGeneral: string
  groupServices: string
  format: string
  post: string
  story: string
  withLink: string
  noLink: string
  download: string
  share: string
  generating: string
  error: string
  shareText: string
}

const EXTRA_ICONS: Record<string, LucideIcon> = { Ghost, Candy, MoonStar }
const iconOf = (name: string) => ICONS[name] ?? EXTRA_ICONS[name] ?? Sparkles

export default function SocialStudio({ items, inviteUrl, texts }: { items: SocialItem[]; inviteUrl: string | null; texts: Texts }) {
  const [id, setId] = useState(items[0]?.id ?? '')
  const [format, setFormat] = useState<SocialFormat>('post')
  const [withLink, setWithLink] = useState(!!inviteUrl)
  const [busy, setBusy] = useState<'png' | 'share' | null>(null)
  const [error, setError] = useState(false)
  const [scale, setScale] = useState(0.3)
  const node = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)

  const item = items.find((i) => i.id === id) ?? items[0]
  const content = useMemo(
    () => ({ Icon: iconOf(item.icon), eyebrow: item.eyebrow, title: item.title, gold: item.gold, sub: item.sub, points: item.points.map((p) => ({ Icon: iconOf(p.icon), text: p.text })), theme: item.theme }),
    [item]
  )
  const footer = withLink && inviteUrl ? inviteUrl.replace(/^https?:\/\//, '') : 'kumani.io'
  const { w, h } = SOCIAL_SIZE[format]

  // L'anteprima si adatta alla larghezza della pagina (la storia resta più stretta)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const update = () => setScale(el.clientWidth / w)
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    return () => obs.disconnect()
  }, [w])

  const fileName = `KUMANI_${item.id.replace(/[^a-z0-9-]/gi, '')}_${format}.png`
  const renderPng = async () => {
    const { toPng } = await import('html-to-image')
    await document.fonts.ready
    return toPng(node.current!, { width: w, height: h, pixelRatio: 1, cacheBust: true, style: { transform: 'none' } })
  }

  const download = async () => {
    if (!node.current) return
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
      console.error('[immagini social]', e)
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  const share = async () => {
    if (!node.current) return
    setBusy('share')
    setError(false)
    const link = withLink && inviteUrl ? inviteUrl : 'https://kumani.io'
    const text = `${texts.shareText} ${link}`
    try {
      const file = new File([await (await fetch(await renderPng())).blob()], fileName, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text })
      else if (navigator.share) await navigator.share({ text, url: link })
      else await download()
    } catch (e) {
      // Condivisione annullata: nessun errore da mostrare
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        console.error('[immagini social]', e)
        setError(true)
      }
    } finally {
      setBusy(null)
    }
  }

  const general = items.filter((i) => i.group === 'general')
  const services = items.filter((i) => i.group === 'services')
  const pill = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-bold transition-colors ${active ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]'}`

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-2xl border border-[var(--gold)]/30 bg-white p-4 shadow-sm">
        <label className="block text-sm font-bold text-[var(--ink)]">
          {texts.choose}
          <select
            value={item.id}
            onChange={(e) => setId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm font-normal text-gray-900 focus:border-[var(--gold)] focus:outline-none"
          >
            <optgroup label={texts.groupGeneral}>
              {general.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={texts.groupServices}>
              {services.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[var(--ink)]">{texts.format}</span>
          <button type="button" onClick={() => setFormat('post')} aria-pressed={format === 'post'} className={pill(format === 'post')}>
            {texts.post}
          </button>
          <button type="button" onClick={() => setFormat('story')} aria-pressed={format === 'story'} className={pill(format === 'story')}>
            {texts.story}
          </button>
        </div>
        {inviteUrl ? (
          <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={withLink} onChange={(e) => setWithLink(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
            {texts.withLink}
          </label>
        ) : (
          <p className="text-xs text-[var(--muted)]">{texts.noLink}</p>
        )}
      </div>

      <div className={`mx-auto ${format === 'story' ? 'max-w-[360px]' : 'max-w-full'}`}>
        <div ref={box} className="relative w-full overflow-hidden rounded-2xl shadow-lg" style={{ height: h * scale }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: w, height: h }}>
            <SocialCanvas ref={node} format={format} content={content} footer={footer} logoUrl="/brand/logo-gold.png" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={share}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-extrabold text-white shadow-sm transition hover:brightness-125 disabled:opacity-60"
        >
          {busy === 'share' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5 text-[var(--gold-bright)]" />}{' '}
          {busy === 'share' ? texts.generating : texts.share}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105 disabled:opacity-60"
        >
          {busy === 'png' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} {busy === 'png' ? texts.generating : texts.download}
        </button>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{texts.error}</p>}
    </div>
  )
}
