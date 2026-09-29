'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Link2, Mail, MessageCircle, Send, Share2 } from 'lucide-react'

// Condivisione del Manuale Anti-Truffa. Il link porta all'anteprima
// pubblica (/manuale-antitruffa) con il codice invito di chi condivide:
// chi non è iscritto legge l'anteprima e si iscrive nella sua rete.
export default function GuideShareButtons({ url, title }: { url: string; title: string }) {
  const t = useTranslations('antitruffa')
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    queueMicrotask(() => setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function'))
  }, [])

  const text = t('shareMessage')
  const fullText = `${text}\n${url}`
  const u = encodeURIComponent(url)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('copyLink'), url)
    }
  }

  const nativeShare = async () => {
    try {
      await navigator.share({ title, text, url })
    } catch {
      // Condivisione annullata
    }
  }

  const social =
    'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md'

  return (
    <section className="rounded-3xl border-2 border-[var(--gold)] bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] print:hidden sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
        <Share2 className="h-6 w-6 shrink-0 text-[var(--gold-bright)]" />
        {t('shareTitle')}
      </h2>
      <p className="mt-1 text-sm leading-6 text-white/70">{t('shareSubtitle')}</p>

      {canNativeShare && (
        <button
          type="button"
          onClick={nativeShare}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-4 text-base font-extrabold text-[var(--ink)] shadow-lg transition hover:brightness-105"
        >
          <Share2 className="h-5 w-5" />
          {t('shareNative')}
        </button>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <a href={`https://wa.me/?text=${encodeURIComponent(fullText)}`} target="_blank" rel="noopener noreferrer" className={`${social} bg-[#25d366]`}>
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener noreferrer" className={`${social} bg-[#1877f2]`}>
          <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-xs font-black text-[#1877f2]">f</span> Facebook
        </a>
        <a href={`https://t.me/share/url?url=${u}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={`${social} bg-[#229ed9]`}>
          <Send className="h-5 w-5" /> Telegram
        </a>
        <a href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${u}`} target="_blank" rel="noopener noreferrer" className={`${social} bg-black ring-1 ring-white/20`}>
          <span className="text-base font-black leading-none">𝕏</span> X
        </a>
        <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${u}`} target="_blank" rel="noopener noreferrer" className={`${social} bg-[#0a66c2]`}>
          <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-[10px] font-black text-[#0a66c2]">in</span> LinkedIn
        </a>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(fullText)}`} className={`${social} bg-[var(--gold)] text-[var(--ink)]`}>
          <Mail className="h-5 w-5" /> Email
        </a>
      </div>

      <button
        type="button"
        onClick={copy}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-sm font-semibold transition hover:bg-white/10"
      >
        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Link2 className="h-4 w-4" />}
        {copied ? t('linkCopied') : t('copyLink')}
      </button>
      <p className="mt-2 text-center text-xs leading-5 text-white/50">{t('shareHint')}</p>
    </section>
  )
}
