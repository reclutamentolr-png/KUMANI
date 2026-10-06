import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Download,
  FileText,
  FolderOpen,
  IdCard,
  Info,
  Megaphone,
  Presentation,
  Receipt,
  ScrollText,
  Ticket,
  TicketPercent,
  type LucideIcon,
  BookMarked,
  Building2,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import DeckDownloadButton from '@/components/documents/DeckDownloadButton'
import FlyerGrid from '@/components/flyers/FlyerGrid'
import { createClient } from '@/lib/supabase/server'
import { listKumaniDocuments, listPersonalDocuments } from '@/lib/documentsData'
import { getFlyerTitles, listPublishedFlyers } from '@/lib/flyersData'
import { FLYERS } from '@/lib/flyers'
import { DOC_LOCALES, pickLocalized, type DocLocale, type KumaniDocFile, type PersonalDocKind } from '@/lib/documents'
import AppHeader from '@/components/nav/AppHeader'
import { getSessionUser, preloadSession } from '@/lib/session'
import { getCatalog } from '@/lib/catalog-server'
import CatalogPdfButton from '@/components/catalog/CatalogPdfButton'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('documents')
  return { title: t('metaTitle') }
}

const KIND_ICONS: Record<PersonalDocKind, LucideIcon> = {
  quote: FileText,
  receipt: Receipt,
  receipt_received: Receipt,
  cv: IdCard,
  coupon: TicketPercent,
  event: CalendarCheck,
  voucher: Ticket,
}
const KIND_ORDER: PersonalDocKind[] = ['quote', 'receipt', 'receipt_received', 'cv', 'coupon', 'event', 'voucher']

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`

// Documenti: "Doc KUMANI" (materiale ufficiale da scaricare, prima nella
// lingua dell'utente) e "Doc Personali" (i documenti creati con i servizi).
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  // Utente letto una volta sola per la pagina e la sua intestazione
  preloadSession()
  const [locale, t, { tab }, supabase, user] = await Promise.all([
    getLocale(),
    getTranslations('documents'),
    searchParams,
    createClient(),
    getSessionUser(),
  ])
  const personal = tab === 'personali'
  if (!user) redirect(`/${locale}/login`)

  const languageName = (code: string) => {
    try {
      const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
      return name.charAt(0).toUpperCase() + name.slice(1)
    } catch {
      return code
    }
  }
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })

  const tabClass = (active: boolean) =>
    `flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-bold transition ${active ? 'bg-[var(--ink)] text-white shadow' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`

  const fileButton = (f: KumaniDocFile, main: boolean) => {
    const Icon = f.format === 'pdf' ? FileText : Presentation
    return (
      <a
        key={f.id}
        href={`/api/documenti/${f.id}`}
        className={
          main
            ? 'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105'
            : 'inline-flex items-center gap-1 rounded-lg border border-[var(--gold)]/40 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink)] transition hover:border-[var(--gold)]'
        }
      >
        {main ? <Download className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5 text-[var(--gold)]" />}
        {t(f.format)}
        {main && <span className="font-medium opacity-70">· {mb(f.size_bytes)}</span>}
      </a>
    )
  }

  const body = personal ? await personalTab() : await kumaniTab()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('title')} icon={<FolderOpen className="h-5 w-5" />} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('title')}</h1>
        <p className="mt-2 text-[var(--muted)]">{t('subtitle')}</p>

        <nav className="mt-6 flex gap-1 rounded-2xl border border-[var(--gold)]/30 bg-white p-1 shadow-sm">
          <Link href="/documenti" className={tabClass(!personal)}>
            {t('tabKumani')}
          </Link>
          <Link href="/documenti?tab=personali" className={tabClass(personal)}>
            {t('tabPersonal')}
          </Link>
        </nav>

        {body}
      </main>
    </div>
  )

  async function kumaniTab() {
    const [docs, published, flyerTitles, catalog, catalogT, flyersT] = await Promise.all([
      listKumaniDocuments(supabase),
      listPublishedFlyers(supabase),
      getFlyerTitles(),
      getCatalog(locale),
      getTranslations('catalog'),
      getTranslations('flyers'),
    ])
    const flyers = FLYERS.filter((f) => published.has(f.tool))
    return (
      <section className="mt-6 space-y-4">
        <p className="text-sm text-[var(--muted)]">{t('kumaniIntro')}</p>
        {docs.length === 0 && flyers.length === 0 && <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-6 text-center text-[var(--muted)]">{t('kumaniEmpty')}</p>}
        {docs.map((d) => {
          // Presentazione: il PowerPoint si crea al momento (testi aggiornati), in ogni lingua
          const live = d.category === 'presentation'
          const files = live ? d.files.filter((f) => f.format !== 'pptx') : d.files
          const mine = files.filter((f) => f.locale === locale).sort((a, b) => (a.format === 'pdf' ? -1 : 1) - (b.format === 'pdf' ? -1 : 1))
          const others = DOC_LOCALES.filter((l) => l !== locale)
            .map((l) => ({ l, files: files.filter((f) => f.locale === l) }))
            .filter((x) => live || x.files.length > 0)
          const deckButton = (l: string, main: boolean) => (
            <DeckDownloadButton key={`deck-${l}`} locale={l} main={main} label={t('pptx')} busyLabel={flyersT('generating')} errorLabel={flyersT('error')} />
          )
          const CatIcon = d.category === 'presentation' ? Presentation : d.category === 'rules' ? ScrollText : FileText
          const description = pickLocalized(d.description, locale)
          return (
            <article key={d.id} className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                  <CatIcon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{t(`category_${d.category}`)}</p>
                  <h2 className="text-xl font-bold text-[var(--ink)]">{pickLocalized(d.title, locale)}</h2>
                  {description && <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>}
                </div>
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  {t('yourLanguage')} · {languageName(locale)}
                </p>
                {mine.length || live ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {mine.map((f) => fileButton(f, true))}
                    {live && deckButton(locale, true)}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">{t('notInYourLanguage')}</p>
                )}
              </div>

              {others.length > 0 && (
                <details className="mt-4 group" open={mine.length === 0 && !live}>
                  <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)] hover:text-[var(--gold)]">{t('otherLanguages')}</summary>
                  <ul className="mt-3 space-y-2">
                    {others.map(({ l, files }) => (
                      <li key={l} className="flex flex-wrap items-center gap-2">
                        <span className="w-28 text-sm text-[var(--ink)]">{languageName(l as DocLocale)}</span>
                        {files.map((f) => fileButton(f, false))}
                        {live && deckButton(l, false)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {d.category === 'presentation' && (
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--gold-pale)] px-3 py-2 text-xs text-[var(--ink)]">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('officialNote')}
                </p>
              )}
            </article>
          )
        })}
        {/* Catalogo dei servizi: il PDF si crea al momento, nella lingua della pagina */}
        <article className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <BookMarked className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{catalogT('eyebrow', { count: catalog.total })}</p>
              <h2 className="text-xl font-bold text-[var(--ink)]">{catalogT('pageTitle')}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">{catalogT('intro')}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <CatalogPdfButton catalog={catalog} variant="light" />
            <Link href="/catalogo" className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
              {catalogT('openPage')}
            </Link>
          </div>
        </article>

        {flyers.length > 0 && (
          <div className="pt-4">
            <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
              <Megaphone className="h-5 w-5 text-[var(--gold)]" /> {flyersT('sectionTitle')}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{flyersT('sectionIntro')}</p>
            <FlyerGrid items={flyers.map((f) => ({ tool: f.tool, title: flyerTitles[f.tool] ?? f.tool, category: flyersT(`cat_${f.category}`) }))} />
          </div>
        )}
      </section>
    )
  }

  async function personalTab() {
    const [docs, bcT, bpT] = await Promise.all([listPersonalDocuments(supabase, user!.id), getTranslations('businessCard'), getTranslations('businessProfile')])
    const groups = KIND_ORDER.map((kind) => ({ kind, items: docs.filter((d) => d.kind === kind) })).filter((g) => g.items.length > 0)
    return (
      <section className="mt-6 space-y-5">
        <p className="text-sm text-[var(--muted)]">{t('personalIntro')}</p>
        {/* Biglietto da visita: sempre disponibile, creato al momento */}
        <Link
          href="/documenti/biglietto"
          className="group flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-[var(--ink)] p-5 text-white shadow-sm transition hover:border-[var(--gold)]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
            <IdCard className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{bcT('title')}</span>
            <span className="block text-sm text-white/70">{bcT('docsHint')}</span>
          </span>
          <ArrowRight className="h-5 w-5 text-[var(--gold-bright)] transition-transform group-hover:translate-x-0.5" />
        </Link>
        {/* Scheda attività: i dati dell'attività per tutti i servizi */}
        <Link
          href="/scheda-attivita?from=/documenti"
          className="group flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm transition hover:border-[var(--gold)]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)] text-[var(--gold)]">
            <Building2 className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-[var(--ink)]">{bpT('title')}</span>
            <span className="block text-sm text-[var(--muted)]">{bpT('subtitle')}</span>
          </span>
          <ArrowRight className="h-5 w-5 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
        </Link>
        {groups.length === 0 && (
          <p className="flex items-start gap-3 rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-6 text-[var(--muted)]">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" /> {t('personalEmpty')}
          </p>
        )}
        {groups.map(({ kind, items }) => {
          const Icon = KIND_ICONS[kind]
          return (
            <div key={kind} className="rounded-2xl border border-[var(--gold)]/30 bg-white shadow-sm">
              <h2 className="flex items-center gap-2 border-b border-[var(--gold)]/20 px-5 py-3 font-bold text-[var(--ink)]">
                <Icon className="h-5 w-5 text-[var(--gold)]" /> {t(`kind_${kind}`)} <span className="text-sm font-normal text-[var(--muted)]">({items.length})</span>
              </h2>
              <ul className="divide-y divide-[var(--gold)]/10">
                {items.map((d) => (
                  <li key={d.id}>
                    <Link href={d.href} className="group flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-[var(--gold-pale)]/50">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--ink)]">{d.title || t('untitled')}</p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {dateFmt.format(new Date(d.date))}
                          {d.subtitle ? ` · ${d.subtitle}` : ''}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--gold)]">
                        {t('open')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>
    )
  }
}
