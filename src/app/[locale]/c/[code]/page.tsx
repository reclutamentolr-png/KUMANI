import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, Mail, MessageCircle, Phone, UserPlus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

// Pagina del biglietto da visita (si apre dal QR): nome e cognome del
// Kumano, i contatti che ha scelto di mostrare e l'invito a iscriversi.

type Card = { first_name: string | null; last_name: string | null; referral_code: string; phone: string | null; whatsapp: string | null; email: string | null }

async function loadCard(code: string) {
  if (!/^[A-Za-z0-9-]{3,20}$/.test(code)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_business_card', { p_code: code }).maybeSingle<Card>()
  return data
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const card = await loadCard(code)
  const name = card ? `${card.first_name ?? ''} ${card.last_name ?? ''}`.trim() : 'KUMANI'
  return { title: `${name} · KUMANI`, robots: { index: false, follow: false } }
}

export default async function BusinessCardPublicPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const card = await loadCard(code)
  if (!card) notFound()
  const t = await getTranslations('businessCard')

  const name = `${card.first_name ?? ''} ${card.last_name ?? ''}`.trim()
  const initials = `${card.first_name?.[0] ?? ''}${card.last_name?.[0] ?? ''}`.toUpperCase() || 'K'
  const digits = (value: string) => value.replace(/[^\d+]/g, '')
  const waNumber = card.whatsapp ? digits(card.whatsapp).replace(/^\+/, '').replace(/^(?=3\d{8,9}$)/, '39') : null

  const vcard = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${card.last_name ?? ''};${card.first_name ?? ''};;;`,
    `FN:${name}`,
    card.phone || card.whatsapp ? `TEL;TYPE=CELL:${digits((card.phone || card.whatsapp)!)}` : '',
    card.email ? `EMAIL:${card.email}` : '',
    'END:VCARD',
  ]
    .filter(Boolean)
    .join('\r\n')

  const rows = [
    card.phone && { icon: Phone, label: t('phone'), value: card.phone, action: t('call'), href: `tel:${digits(card.phone)}` },
    card.email && { icon: Mail, label: t('email'), value: card.email, action: t('write'), href: `mailto:${card.email}` },
    waNumber && { icon: MessageCircle, label: 'WhatsApp', value: card.whatsapp!, action: t('open'), href: `https://wa.me/${waNumber}` },
  ].filter(Boolean) as { icon: typeof Phone; label: string; value: string; action: string; href: string }[]

  return (
    <div className="min-h-screen bg-[#f6f2e9]">
      <div className="mx-auto max-w-md">
        <header className="bg-[#111] px-6 pb-8 pt-9 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-gold-hd.png" alt="KUMANI" className="mx-auto w-24" />
          <div className="mx-auto mt-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] font-serif text-4xl font-bold text-[#111]">
            {initials}
          </div>
          <h1 className="mt-4 font-serif text-3xl font-bold text-white">{name}</h1>
          <p className="mt-1 text-sm tracking-[0.18em] text-[var(--gold-bright)]">KUMANO · {card.referral_code}</p>
        </header>

        <main className="space-y-3 px-5 py-6">
          {rows.map(({ icon: Icon, label, value, action, href }) => (
            <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-[#e8dcc0] bg-white p-4 transition hover:border-[var(--gold)]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111] text-[var(--gold-bright)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-[#8a7d63]">{label}</span>
                <span className="block truncate font-semibold text-[#111]">{value}</span>
              </span>
              <span className="text-sm font-bold text-[#8a6d1f]">{action}</span>
            </a>
          ))}
          {rows.length > 0 && (
            <a
              href={`data:text/vcard;charset=utf-8,${encodeURIComponent(vcard)}`}
              download={`${name || 'KUMANI'}.vcf`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--gold)] bg-white p-4 text-sm font-semibold text-[#555]"
            >
              <UserPlus className="h-4 w-4 text-[var(--gold)]" /> {t('saveContact')}
            </a>
          )}

          <section className="mt-4 rounded-3xl bg-[#111] p-6 text-center">
            <h2 className="text-lg font-bold text-white">{t('joinTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">{t('joinText', { name: card.first_name ?? name })}</p>
            <Link
              href={`/ref/${encodeURIComponent(card.referral_code)}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-extrabold text-[#111]"
            >
              {t('joinButton')} <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        </main>
      </div>
    </div>
  )
}
