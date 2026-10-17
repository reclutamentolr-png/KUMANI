'use client'

import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp, Contact, Link2, Mail, MessageCircle, MessageSquare, Phone, Plus, Trash2, Wifi, type LucideIcon } from 'lucide-react'
import { MULTI_MAX_ITEMS, QR_ITEM_TYPES, emptyDestinationFor, type MultiDestination, type QrItemType } from '@/lib/qrPro'
import QrDestinationFields from '@/components/qrPro/QrDestinationFields'
import QrMultiView from '@/components/qrPro/QrMultiView'

const ICONS: Record<QrItemType, LucideIcon> = { link: Link2, whatsapp: MessageCircle, phone: Phone, sms: MessageSquare, email: Mail, wifi: Wifi, vcard: Contact }
const field =
  'w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm'

// «Più contatti»: titolo, sottotitolo e i contatti della pagina (uno per tipo o
// più dello stesso tipo), da mettere nell'ordine voluto. Accanto (sotto sul
// telefono) l'anteprima della pagina com'è per chi inquadra il QR.
export default function QrMultiEditor({ value, onChange }: { value: MultiDestination; onChange: (next: MultiDestination) => void }) {
  const t = useTranslations('qrCodePro')
  const items = value.items ?? []
  const setItems = (next: MultiDestination['items']) => onChange({ ...value, items: next })
  const move = (index: number, by: -1 | 1) => {
    const next = [...items]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    setItems(next)
  }
  const add = (type: QrItemType) => setItems([...items, { type, label: '', data: emptyDestinationFor(type) as unknown as Record<string, string> }])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <p className="rounded-lg border border-[var(--gold)]/20 bg-[var(--gold-pale)]/50 p-3 text-xs text-[var(--muted)]">{t('multiNotice')}</p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('multiTitleLabel')}</label>
          <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value.slice(0, 80) })} placeholder={t('multiTitlePlaceholder')} className={field} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">{t('multiSubtitleLabel')}</label>
          <input value={value.subtitle} onChange={(e) => onChange({ ...value, subtitle: e.target.value.slice(0, 160) })} placeholder={t('multiSubtitlePlaceholder')} className={field} />
        </div>

        <p className="pt-1 text-sm font-semibold text-[var(--ink)]">{t('multiItemsLabel')}</p>
        {items.length === 0 && <p className="text-sm text-[var(--muted)]">{t('multiEmpty')}</p>}
        <ol className="space-y-3">
          {items.map((item, index) => {
            const Icon = ICONS[item.type]
            return (
              <li key={index} className="space-y-3 rounded-xl border-2 border-[var(--gold)]/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)]">{index + 1}</span>
                  <Icon className="h-4 w-4 text-[var(--gold)]" aria-hidden />
                  <span className="flex-1 text-sm font-bold text-[var(--ink)]">{t(`type_${item.type}`)}</span>
                  <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={t('multiMoveUp')} title={t('multiMoveUp')} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label={t('multiMoveDown')} title={t('multiMoveDown')} className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setItems(items.filter((_, i) => i !== index))} aria-label={t('multiRemove')} title={t('multiRemove')} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('multiButtonLabel')}</label>
                  <input
                    value={item.label}
                    onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, label: e.target.value.slice(0, 60) } : it)))}
                    placeholder={t(`btn_${item.type}`)}
                    className={field}
                  />
                </div>
                <QrDestinationFields
                  inPage
                  type={item.type}
                  d={item.data}
                  set={(key, v) => setItems(items.map((it, i) => (i === index ? { ...it, data: { ...it.data, [key]: v } } : it)))}
                />
              </li>
            )
          })}
        </ol>

        {items.length < MULTI_MAX_ITEMS ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">{t('multiAddLabel')}</p>
            <div className="flex flex-wrap gap-2">
              {QR_ITEM_TYPES.map((type) => {
                const Icon = ICONS[type]
                return (
                  <button key={type} type="button" onClick={() => add(type)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-[var(--gold)]/25 px-3 text-xs font-semibold text-[var(--ink)] hover:border-[var(--gold)]">
                    <Plus className="h-3.5 w-3.5" aria-hidden /> <Icon className="h-4 w-4 text-[var(--gold)]" aria-hidden /> {t(`type_${type}`)}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--muted)]">{t('multiMax', { max: MULTI_MAX_ITEMS })}</p>
        )}
      </div>

      {/* Anteprima della pagina, in una cornice da telefono */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">{t('multiPreview')}</p>
        <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-[var(--ink)] bg-[var(--background)] p-4 shadow-[0_14px_34px_rgba(23,23,23,0.22)]">
          <div className="max-h-[540px] overflow-y-auto rounded-[1.4rem] bg-[var(--paper)] p-4">
            <QrMultiView destination={value} preview />
          </div>
        </div>
      </div>
    </div>
  )
}
