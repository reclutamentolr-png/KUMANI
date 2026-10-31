import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ArrowRight, Building2, Globe, Mail, MapPin, MessageCircle, Phone, Share2, Smartphone, UserPlus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { escapeVcard } from '@/lib/contactsImport'
import { cleanClassic, type ClassicField } from '@/lib/businessCardClassic'
import { getMyBusinessProfile } from '@/lib/businessProfile-server'
import { businessFullAddress, businessWebsiteUrl } from '@/lib/businessProfile'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

// Pagina del biglietto da visita (si apre dal QR o dal tag NFC).
// Biglietto KUMANI: nome e i contatti scelti per la pagina del QR.
// Biglietto classico: gli stessi dati stampati sul biglietto (ruolo, azienda,
// sito, indirizzo…) e il logo scelto, presi da profilo e Scheda attività.

type Card = { first_name: string | null; last_name: string | null; referral_code: string; phone: string | null; whatsapp: string | null; email: string | null }

async function loadCard(code: string) {
  if (!/^[A-Za-z0-9-]{3,20}$/.test(code)) return null
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_business_card', { p_code: code }).maybeSingle<Card>()
  return data
}

// Biglietto classico: solo i campi spuntati per la stampa (null se il
// biglietto in uso è quello KUMANI). La pagina esiste già solo se
// get_business_card l'ha trovata (iscritto attivo, non agente).
async function loadClassic(code: string) {
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: p } = await db.from('profiles').select('id, first_name, last_name, occupation, phone, email').eq('referral_code', code.trim().toUpperCase()).maybeSingle()
  if (!p) return null
  const { data: c } = await db.from('business_cards').select('kind, classic').eq('user_id', p.id).maybeSingle()
  if (c?.kind !== 'classic') return null
  const s = cleanClassic(c.classic)
  const b = await getMyBusinessProfile(db, p.id)
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const source: Record<ClassicField, string> = {
    name: [text(p.first_name), text(p.last_name)].filter(Boolean).join(' '),
    role: text(p.occupation),
    company: text(b.companyName),
    phone: text(b.phone) || text(p.phone),
    mobile: text(b.whatsapp),
    email: text(b.email) || text(p.email),
    website: text(b.website).replace(/^https?:\/\//i, '').replace(/\/$/, ''),
    address: businessFullAddress(b),
    vat: text(b.vatNumber),
    social: Object.values(b.socials).map(text).find(Boolean) ?? '',
  }
  const value = (f: ClassicField) => (s.fields[f] ? s.values[f] || source[f] || '' : '')
  const logoUrl = s.logo === 'business' ? b.logoUrl : null
  return { value, logoUrl, kumaniLogo: s.logo === 'kumani' }
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const card = await loadCard(code)
  const name = card ? `${card.first_name ?? ''} ${card.last_name ?? ''}`.trim() : 'KUMANI'
  return { title: { absolute: `${name} · KUMANI` }, robots: { index: false, follow: false } }
}

type Row = { icon: typeof Phone; label: string; value: string; action?: string; href?: string }

export default async function BusinessCardPublicPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const card = await loadCard(code)
  if (!card) notFound()
  const [t, classic] = await Promise.all([getTranslations('businessCard'), loadClassic(code)])

  const digits = (value: string) => value.replace(/[^\d+]/g, '')
  // Numero per WhatsApp: solo i cellulari (italiani senza prefisso → +39)
  const waOf = (value: string) => {
    const d = digits(value).replace(/^\+/, '').replace(/^00/, '')
    return /^3\d{8,9}$/.test(d) ? `39${d}` : /^393\d{8,9}$/.test(d) ? d : null
  }

  let name: string, role = '', company = '', rows: Row[], vcardExtra: string[]
  if (classic) {
    const v = classic.value
    name = v('name') || `${card.first_name ?? ''} ${card.last_name ?? ''}`.trim()
    role = v('role')
    company = v('company')
    const wa = waOf(v('mobile')) ?? waOf(v('phone'))
    const site = v('website')
    const social = v('social')
    rows = [
      v('phone') && { icon: Phone, label: t('phone'), value: v('phone'), action: t('call'), href: `tel:${digits(v('phone'))}` },
      v('mobile') && { icon: Smartphone, label: t('classic.field_mobile'), value: v('mobile'), action: t('call'), href: `tel:${digits(v('mobile'))}` },
      wa && { icon: MessageCircle, label: 'WhatsApp', value: v('mobile') || v('phone'), action: t('open'), href: `https://wa.me/${wa}` },
      v('email') && { icon: Mail, label: t('email'), value: v('email'), action: t('write'), href: `mailto:${v('email')}` },
      site && { icon: Globe, label: t('classic.field_website'), value: site, action: t('open'), href: businessWebsiteUrl(site) },
      v('address') && { icon: MapPin, label: t('classic.field_address'), value: v('address'), action: t('map'), href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v('address'))}` },
      social && { icon: Share2, label: t('classic.field_social'), value: social.replace(/^https?:\/\//i, ''), ...(/^(https?:\/\/|www\.)|\.[a-z]{2,}\//i.test(social) ? { action: t('open'), href: businessWebsiteUrl(social) } : {}) },
      v('vat') && { icon: Building2, label: t('classic.field_vat'), value: v('vat') },
    ].filter(Boolean) as Row[]
    vcardExtra = [
      v('phone') ? `TEL;TYPE=WORK:${digits(v('phone'))}` : '',
      v('mobile') ? `TEL;TYPE=CELL:${digits(v('mobile'))}` : '',
      v('email') ? `EMAIL:${escapeVcard(v('email'))}` : '',
      company ? `ORG:${escapeVcard(company)}` : '',
      role ? `TITLE:${escapeVcard(role)}` : '',
      site ? `URL:${escapeVcard(businessWebsiteUrl(site))}` : '',
      v('address') ? `ADR;TYPE=WORK:;;${escapeVcard(v('address'))};;;;` : '',
    ]
  } else {
    name = `${card.first_name ?? ''} ${card.last_name ?? ''}`.trim()
    const wa = card.whatsapp ? digits(card.whatsapp).replace(/^\+/, '').replace(/^(?=3\d{8,9}$)/, '39') : null
    rows = [
      card.phone && { icon: Phone, label: t('phone'), value: card.phone, action: t('call'), href: `tel:${digits(card.phone)}` },
      card.email && { icon: Mail, label: t('email'), value: card.email, action: t('write'), href: `mailto:${card.email}` },
      wa && { icon: MessageCircle, label: 'WhatsApp', value: card.whatsapp!, action: t('open'), href: `https://wa.me/${wa}` },
    ].filter(Boolean) as Row[]
    vcardExtra = [card.phone || card.whatsapp ? `TEL;TYPE=CELL:${digits((card.phone || card.whatsapp)!)}` : '', card.email ? `EMAIL:${escapeVcard(card.email)}` : '']
  }

  const [first, ...rest] = name.split(' ')
  const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeVcard(rest.join(' '))};${escapeVcard(first ?? '')};;;`, `FN:${escapeVcard(name)}`, ...vcardExtra, 'END:VCARD'].filter(Boolean).join('\r\n')

  return (
    <div className="min-h-screen bg-[#f6f2e9]">
      <div className="mx-auto max-w-md">
        <header className="bg-[#111] px-6 pb-8 pt-9 text-center">
          {/* Il logo scelto per il biglietto (della propria attività), altrimenti KUMANI */}
          {classic?.logoUrl ? (
            <span className="mx-auto flex h-28 w-48 items-center justify-center rounded-2xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={classic.logoUrl} alt={company || name} className="max-h-full max-w-full object-contain" />
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/logo-gold-hd.png" alt="KUMANI" className="mx-auto w-24" />
          )}
          <h1 className="mt-5 font-serif text-3xl font-bold text-white">{name}</h1>
          {role && <p className="mt-1 text-base font-semibold text-[var(--gold-bright)]">{role}</p>}
          {company && <p className="mt-0.5 text-sm text-gray-300">{company}</p>}
          {!classic && <p className="mt-1 text-sm tracking-[0.18em] text-[var(--gold-bright)]">KUMANO · {card.referral_code}</p>}
        </header>

        <main className="space-y-3 px-5 py-6">
          {rows.map(({ icon: Icon, label, value, action, href }) => {
            const inner = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111] text-[var(--gold-bright)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-[#8a7d63]">{label}</span>
                  <span className="block break-words font-semibold text-[#111]">{value}</span>
                </span>
                {action && <span className="shrink-0 text-sm font-bold text-[#8a6d1f]">{action}</span>}
              </>
            )
            const box = 'flex items-center gap-3 rounded-2xl border border-[#e8dcc0] bg-white p-4'
            return href ? (
              <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className={`${box} transition hover:border-[var(--gold)]`}>
                {inner}
              </a>
            ) : (
              <div key={label} className={box}>
                {inner}
              </div>
            )
          })}
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
            {classic && !classic.kumaniLogo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/logo-gold-hd.png" alt="KUMANI" className="mx-auto mb-3 w-14" />
            )}
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
