'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Contact, Copy, Link2, Mail, MessageCircle, MessageSquare, Phone, Wifi, type LucideIcon } from 'lucide-react'
import { qrItemHref, type MultiDestination, type QrItemType } from '@/lib/qrPro'

const ICONS: Record<QrItemType, LucideIcon> = { link: Link2, whatsapp: MessageCircle, phone: Phone, sms: MessageSquare, email: Mail, wifi: Wifi, vcard: Contact }

// Pagina «Più contatti» di un QR Code PRO: titolo, sottotitolo e un pulsante per
// contatto nell'ordine scelto. La stessa per chi inquadra il QR (/qr/<codice>) e
// per l'anteprima nel modulo (preview: pulsanti non cliccabili).
export default function QrMultiView({ destination, code, preview = false }: { destination: MultiDestination; code?: string; preview?: boolean }) {
  const t = useTranslations('qrCodePro')
  const items = destination.items ?? []
  return (
    <div className="w-full">
      <div className="text-center">
        <h1 className="break-words text-2xl font-extrabold text-[var(--ink)]">{destination.title?.trim() || t('multiTitleFallback')}</h1>
        {destination.subtitle?.trim() && <p className="mt-1.5 text-sm text-[var(--muted)]">{destination.subtitle}</p>}
      </div>
      <ul className="mt-6 space-y-3">
        {items.length === 0 && <li className="rounded-2xl border border-dashed border-[var(--gold)]/40 p-4 text-center text-sm text-[var(--muted)]">{t('multiEmptyPreview')}</li>}
        {items.map((item, index) => {
          const Icon = ICONS[item.type]
          const label = item.label?.trim() || t(`btn_${item.type}`)
          if (item.type === 'wifi') return <WifiItem key={index} label={label} data={item.data} />
          const href = item.type === 'vcard' ? (code ? `/q/${encodeURIComponent(code)}/contatto/${index}` : '#') : qrItemHref(item.type, item.data)
          if (!href) return null
          return (
            <li key={index}>
              <a
                href={href}
                target={item.type === 'link' ? '_blank' : undefined}
                rel={item.type === 'link' ? 'noopener noreferrer' : undefined}
                aria-disabled={preview || undefined}
                onClick={preview ? (e) => e.preventDefault() : undefined}
                className="flex min-h-14 items-center gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-white shadow-md transition hover:brightness-110"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate font-bold">{label}</span>
              </a>
            </li>
          )
        })}
      </ul>
      <p className="mt-8 text-center text-xs text-[var(--muted)]">
        <a href="https://kumani.io" target="_blank" rel="noopener noreferrer" onClick={preview ? (e) => e.preventDefault() : undefined} className="font-semibold text-[var(--gold)]">
          {t('madeWithKumani')}
        </a>
      </p>
    </div>
  )
}

// Wi-Fi: dal browser non ci si collega in automatico; si mostrano rete e
// password con «Copia»
function WifiItem({ label, data }: { label: string; data: Record<string, string> }) {
  const t = useTranslations('qrCodePro')
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, value: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }
  const rows = [
    { key: 'ssid', label: t('wifiNetwork'), value: data.ssid ?? '' },
    ...(data.encryption !== 'nopass' && data.password ? [{ key: 'password', label: t('wifiPasswordLabel'), value: data.password }] : []),
  ]
  return (
    <li className="rounded-2xl border border-[var(--gold)]/35 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-3 font-bold text-[var(--ink)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
          <Wifi className="h-5 w-5" aria-hidden />
        </span>
        {label}
      </p>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2 rounded-xl bg-[var(--background)] px-3 py-2">
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-[var(--muted)]">{row.label}</dt>
              <dd className="truncate font-mono text-sm font-semibold text-[var(--ink)]">{row.value || '—'}</dd>
            </div>
            {row.value && (
              <button type="button" onClick={() => copy(row.key, row.value)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[var(--gold)]/40 px-3 text-xs font-bold text-[var(--ink)]">
                {copied === row.key ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                {copied === row.key ? t('copied') : t('copy')}
              </button>
            )}
          </div>
        ))}
      </dl>
    </li>
  )
}
