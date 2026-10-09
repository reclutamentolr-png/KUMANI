import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { getLocale, getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowLeft, Info, Lock } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { CONTACT_INFO } from '@/lib/contactInfo'
import { CookiePreferencesLink } from '@/components/consent/ConsentGate'
import { getConsentConfig } from '@/lib/consentServer'

// Informativa Privacy essenziale (7 lingue, namespace "privacyPage"). La
// versione completa è in revisione dal consulente: è nello storico git di
// questo file (commit precedente a "privacy essenziale") e tornerà qui,
// con i dati del titolare, quando sarà approvata.

const LAST_UPDATE = '2026-10-09'
const LIST_SECTIONS = new Set([2, 3, 6])

// Pagina uguale per tutti: preparata in anticipo per ogni lingua e rifatta
// in background (al massimo ogni ora; prima se cambiano lingue o traduzioni)
export const revalidate = 3600

type LocaleProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: LocaleProps): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const t = await getTranslations('privacyPage')
  return pageMetadata('/privacy', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function PrivacyPage({ params }: LocaleProps) {
  setRequestLocale((await params).locale)
  const locale = await getLocale()
  const t = await getTranslations('privacyPage')
  // Con il banner acceso dall'Admin si aggiunge il cookie che lo ricorda
  const consentOn = (await getConsentConfig()).enabled
  const email = CONTACT_INFO.privacyEmail ?? 'privacy@kumani.io'
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(LAST_UPDATE))
  const withEmail = (text: string) => {
    const [before, after] = text.split('{email}')
    return (
      <>
        {before}
        {after !== undefined && (
          <a href={`mailto:${email}`} className="font-semibold text-[var(--gold)] hover:underline">
            {email}
          </a>
        )}
        {after}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('back')}
          </Link>
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <Lock className="h-5 w-5 text-[var(--gold-bright)]" /> {t('title')}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-[var(--muted)]">{t('subtitle')}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('updated', { date })}</p>

        <p className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" /> {t('notice')}
        </p>

        <div className="mt-8 space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
            const body = t.raw(`s${n}`) as string
            return (
              <section key={n} id={n === 7 ? 'cookie' : undefined} className="scroll-mt-24 rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-[var(--ink)]">
                  {n}. {t(`s${n}t`)}
                </h2>
                {LIST_SECTIONS.has(n) ? (
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                    {body.split('|').map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">{withEmail(body)}</p>
                )}
                {/* Cookie: elenco preciso (nome, a cosa serve, durata) */}
                {n === 7 && (
                  <>
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                      {[...(t.raw('s7list') as string).split('|'), ...(consentOn ? [t('s7consentCookie')] : [])].map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">{t('s7note')}</p>
                    <CookiePreferencesLink className="mt-3 text-sm font-semibold text-[var(--gold)] underline" />
                  </>
                )}
              </section>
            )
          })}
        </div>
      </main>
    </div>
  )
}
