import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  ChevronDown,
  Clock,
  HandHeart,
  LifeBuoy,
  Mail,
  MessageCircle,
  PenLine,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ContactForm from '@/components/contact/ContactForm'
import type { ContactTopic } from '@/app/actions/contact'
import { CONTACT_INFO } from '@/lib/contactInfo'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contactPage')
  return pageMetadata('/contact', { title: t('metaTitle'), description: t('metaDescription') })
}

const TOPICS: ContactTopic[] = ['support', 'billing', 'pro', 'partnership', 'privacy', 'other']
const FAQ_COUNT = 8

type Channel = {
  key: string
  Icon: typeof Mail
  title: string
  text: string
  cta: string
  href: string | null // null → card "In arrivo"
  external?: boolean
  detail?: string | null
}

// Pagina Contatti pubblica (funziona anche senza login). I recapiti arrivano da
// CONTACT_INFO: finché un valore è null la card relativa resta "In arrivo".
export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const t = await getTranslations('contactPage')
  const commonT = await getTranslations('common')
  const { topic: topicParam } = await searchParams
  const defaultTopic = TOPICS.includes(topicParam as ContactTopic) ? (topicParam as ContactTopic) : 'support'

  // Se l'utente è loggato precompiliamo nome ed email (profilo solo via get_my_profile)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let defaultName = ''
  let defaultEmail = ''
  if (user) {
    const { data: profile } = await supabase
      .rpc('get_my_profile')
      .maybeSingle<{ first_name?: string | null; last_name?: string | null; email?: string | null }>()
    defaultName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
    defaultEmail = user.email ?? profile?.email ?? ''
  }

  const whatsappDigits = CONTACT_INFO.whatsapp ? CONTACT_INFO.whatsapp.replace(/\D/g, '') : ''

  const channels: Channel[] = [
    {
      key: 'email',
      Icon: Mail,
      title: t('channelEmailTitle'),
      text: t('channelEmailText'),
      cta: t('channelEmailCta'),
      href: CONTACT_INFO.supportEmail ? `mailto:${CONTACT_INFO.supportEmail}` : null,
      detail: CONTACT_INFO.supportEmail,
    },
    {
      key: 'whatsapp',
      Icon: MessageCircle,
      title: t('channelWhatsappTitle'),
      text: t('channelWhatsappText'),
      cta: t('channelWhatsappCta'),
      href: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
      external: true,
      detail: CONTACT_INFO.whatsapp,
    },
    {
      key: 'faq',
      Icon: LifeBuoy,
      title: t('channelFaqTitle'),
      text: t('channelFaqText'),
      cta: t('channelFaqCta'),
      href: '#faq',
    },
    {
      key: 'pro',
      Icon: Briefcase,
      title: t('channelProTitle'),
      text: t('channelProText'),
      cta: t('channelProCta'),
      href: '?topic=partnership#scrivici',
    },
  ]

  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({ q: t(`faq${i + 1}Q`), a: t(`faq${i + 1}A`) }))

  const company = CONTACT_INFO.company
  const companyRows = [
    { label: t('companyName'), value: company.name },
    { label: t('companyAddress'), value: company.address },
    { label: t('companyVat'), value: company.vatNumber },
    { label: t('companyPec'), value: company.pec },
  ]
  const hasCompanyData = companyRows.some((row) => !!row.value)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {user ? commonT('backToDashboard') : t('backHome')}
          </Link>
          <div className="flex items-center gap-2">
            <HandHeart className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">{t('headerLabel')}</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--ink)] text-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[var(--gold)]/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 sm:pb-20 sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">{t('heroEyebrow')}</p>
          <h1 className="mt-3 text-5xl font-bold leading-none sm:text-7xl">{t('heroTitle')}</h1>
          <p className="mt-5 max-w-2xl text-lg text-[var(--gold-pale)] sm:text-xl">{t('heroSubtitle')}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/30 bg-white/5 px-4 py-2 text-sm text-white/80">
            <Clock className="h-4 w-4 text-[var(--gold-bright)]" />
            {t('heroResponse', { time: CONTACT_INFO.responseTime })}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#scrivici"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] transition hover:brightness-110"
            >
              <PenLine className="h-5 w-5" /> {t('heroCtaWrite')}
            </a>
            <a href="#faq" className="flex items-center gap-2 rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:border-[var(--gold-bright)]">
              <LifeBuoy className="h-5 w-5" /> {t('heroCtaFaq')}
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4">
        {/* Canali */}
        <section className="relative z-10 mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label={t('channelsTitle')}>
          {channels.map((c) => (
            <ChannelCard key={c.key} channel={c} comingSoon={t('comingSoon')} comingSoonHint={t('comingSoonHint')} />
          ))}
        </section>

        {/* Modulo */}
        <section id="scrivici" className="scroll-mt-24 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">{t('formEyebrow')}</p>
              <h2 className="mt-2 text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('formTitle')}</h2>
              <p className="mt-3 text-[var(--muted)]">{t('formSubtitle')}</p>
              <ul className="mt-6 space-y-3 text-sm text-[var(--ink-soft)]">
                {[1, 2, 3].map((n) => (
                  <li key={n} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)]">{n}</span>
                    <span>{t(`formStep${n}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-3">
              <ContactForm defaultName={defaultName} defaultEmail={defaultEmail} defaultTopic={defaultTopic} />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 border-t border-[var(--ink)]/10 py-14 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">{t('faqEyebrow')}</p>
            <h2 className="mt-2 text-center text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('faqTitle')}</h2>
            <p className="mt-3 text-center text-[var(--muted)]">{t('faqSubtitle')}</p>
            <div className="mt-10 space-y-3">
              {faqs.map((f, i) => (
                <details key={i} className="group rounded-2xl border border-[var(--ink)]/10 bg-[var(--paper)] open:border-[var(--gold)]/40 open:shadow-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-[var(--ink)] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <ChevronDown className="h-5 w-5 flex-shrink-0 text-[var(--gold)] transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="whitespace-pre-line px-5 pb-5 text-sm leading-relaxed text-[var(--ink-soft)]">{f.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-8 text-center">
              <p className="text-[var(--muted)]">{t('faqMore')}</p>
              <a href="#scrivici" className="mt-2 inline-flex items-center gap-1 font-semibold text-[var(--ink)] hover:text-[var(--gold)]">
                {t('faqMoreCta')} <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* Chi c'è dietro KUMANI */}
        <section className="pb-16">
          <div className="rounded-2xl bg-[var(--ink)] p-6 text-white sm:p-10">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-[var(--gold-bright)]" />
              <h2 className="text-xl font-bold sm:text-2xl">{t('companyTitle')}</h2>
            </div>
            <p className="mt-3 max-w-2xl text-sm text-white/70">{t('companyText')}</p>
            {hasCompanyData ? (
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                {companyRows.map((row) => (
                  <div key={row.label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--gold)]">{row.label}</dt>
                    <dd className={`mt-1 break-words ${row.value ? 'text-white' : 'italic text-white/50'}`}>{row.value ?? t('companyUpdating')}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--gold-pale)]">{t('companyPending')}</p>
            )}
            <p className="mt-8 text-sm font-semibold text-[var(--gold-bright)]">{t('tagline')}</p>
          </div>
        </section>
      </main>
    </div>
  )
}

function ChannelCard({ channel, comingSoon, comingSoonHint }: { channel: Channel; comingSoon: string; comingSoonHint: string }) {
  const { Icon, title, text, cta, href, external, detail } = channel

  const body: ReactNode = (
    <>
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${href ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]' : 'bg-[var(--ink)]/5 text-[var(--muted)]'}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className={`mt-4 font-bold ${href ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>{title}</h3>
      <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{text}</p>
      {href ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--gold)]">
          {detail ? <span className="break-all">{detail}</span> : cta} <ArrowRight className="h-4 w-4 flex-shrink-0" />
        </span>
      ) : (
        <span className="mt-4 inline-flex w-fit items-center rounded-full bg-[var(--ink)]/5 px-3 py-1 text-xs font-semibold text-[var(--muted)]" title={comingSoonHint}>
          {comingSoon}
        </span>
      )}
    </>
  )

  const base = 'group flex h-full flex-col rounded-2xl border p-5 shadow-sm'
  if (!href) {
    return <div className={`${base} border-dashed border-[var(--ink)]/15 bg-[var(--paper)]/60`} aria-disabled="true">{body}</div>
  }
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${base} border-[var(--ink)]/10 bg-[var(--paper)] transition hover:-translate-y-0.5 hover:border-[var(--gold)]/50 hover:shadow-md`}
    >
      {body}
    </a>
  )
}
