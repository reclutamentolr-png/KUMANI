'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle, QrCode, X } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import NativeShareButton from '@/components/NativeShareButton'
import Kumi from '@/components/kids/Kumi'

// Invito dal polpo della rete: chi tocca il «+» di un tentacolo libero (o il
// «+» sotto il polpo pieno) manda il proprio link. La registrazione la fa sempre
// la persona nuova (sua email, sua password, suoi consensi); il posto arriva
// al pagamento: primo tentacolo libero, oppure Spillover se sono pieni. Dal
// polpo di un proprio Kumano il link prenota il posto sotto di lui (?t=).
export type NetworkInvite = {
  // Link corto (kumani.io/i/…) e pagina d'invito con il codice
  // (kumani.io/ref/CODICE), che porta la prenotazione del posto
  url: string
  placeUrl: string
  // Messaggi già scritti, con «__LINK__» e «__NAME__» al posto di link e nome
  message: string
  messageNamed: string
  shareText: string
}

export const NAME_TOKEN = '__NAME__'
export const LINK_TOKEN = '__LINK__'

export default function InviteSheet({
  invite,
  slot,
  target,
  onClose,
}: {
  invite: NetworkInvite
  slot: number | null
  // Posto sotto un proprio Kumano: nome e posto in matrice
  target?: { name: string; nodeId: string }
  onClose: () => void
}) {
  const t = useTranslations('dashboard')
  const [name, setName] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)

  const url = target ? `${invite.placeUrl}?t=${target.nodeId.slice(0, 8)}` : invite.url

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [qrFor, setQrFor] = useState('')
  useEffect(() => {
    if (!showQr || (qr && qrFor === url)) return
    let alive = true
    import('qrcode')
      .then((QRCode) => QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#171717', light: '#ffffff' } }))
      .then((data) => {
        if (!alive) return
        setQr(data)
        setQrFor(url)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [showQr, qr, qrFor, url])

  const cleanName = name.trim().slice(0, 40)
  const message = (cleanName ? invite.messageNamed.replace(NAME_TOKEN, cleanName) : invite.message).replace(LINK_TOKEN, url)
  const spillover = slot === null
  const title = target ? t('inviteTargetTitle', { name: target.name }) : spillover ? t('inviteHelpTitle') : t('inviteSlotTitle', { n: slot + 1 })
  const text = target ? t('inviteTargetText', { name: target.name }) : spillover ? t('inviteHelpText') : t('inviteSlotText')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-sheet-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[var(--paper)] p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start gap-3">
          <Kumi className="h-16 w-16 shrink-0" mood="happy" move="wave" />
          <div className="min-w-0 flex-1">
            <h2 id="invite-sheet-title" className="text-lg font-bold leading-snug text-[var(--ink)]">
              {title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('inviteClose')} className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--gold-pale)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{text}</p>

        <label htmlFor="invite-name" className="mt-4 block text-xs font-bold text-[var(--muted)]">
          {t('inviteNameLabel')}
        </label>
        <input
          id="invite-name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('inviteNamePlaceholder')}
          className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-base focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
        />

        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 text-sm font-bold text-[var(--ink)] hover:brightness-110"
        >
          <MessageCircle className="h-4 w-4" /> {t('inviteWhatsapp')}
        </a>
        <div className="mt-2 flex gap-2">
          <input
            readOnly
            value={url}
            aria-label={t('inviteLinkLabel')}
            className="min-w-0 flex-1 rounded-xl border border-[var(--gold)]/35 bg-white px-3 py-2 text-sm text-[var(--ink)]"
          />
          <CopyButton text={url} variant="light" />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/45 bg-white px-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
          >
            <QrCode className="h-4 w-4" /> {showQr ? t('inviteHideQr') : t('inviteShowQr')}
          </button>
          <NativeShareButton url={url} title="KUMANI" text={cleanName ? message.replace(url, '').trim() : invite.shareText} variant="light" copyFallback={false} className="flex-1" />
        </div>
        {showQr && (
          <div className="mt-3 flex flex-col items-center rounded-2xl border border-[var(--gold)]/30 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr ? <img src={qr} alt={t('inviteQrAlt')} className="h-56 w-56" /> : <div className="h-56 w-56 animate-pulse rounded-xl bg-stone-100" />}
            <p className="mt-2 text-center text-xs text-[var(--muted)]">{t('inviteQrHint')}</p>
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{t('inviteSelfSignup')}</p>
      </div>
    </div>
  )
}
