import { getLocale, getTranslations } from 'next-intl/server'
import {
  DoorClosed,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gift,
  ListChecks,
  MailSearch,
  Phone,
  ShieldCheck,
  Siren,
  Sparkles,
  Timer,
} from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import Link from '@/components/LocalizedLink'
import Vignette from '@/components/antitruffa/Vignette'
import PrintGuideButton from '@/components/antitruffa/PrintGuideButton'
import GuideShareButtons from '@/components/antitruffa/GuideShareButtons'
import { guideShareUrl } from '@/lib/antitruffa/shareUrl'
import { createClient } from '@/lib/supabase/server'
import { getGuideContent } from '@/lib/antitruffa/content'
import type { GuideContent, Scam } from '@/lib/antitruffa/types'

// Manuale "Come difendersi dalle truffe online" (Sicurezza e Verifica,
// gratis per tutti i Kumani). Contenuti statici per lingua in
// src/lib/antitruffa/content; la pagina è protetta dal proxy come gli
// altri strumenti. Il pulsante di stampa apre tutte le schede e usa la
// stampa del browser ("Salva come PDF" per scaricarlo).
export default async function AntitruffaPage() {
  const locale = await getLocale()
  const g = await getGuideContent(locale)
  const tm = await getTranslations('marketplace')
  const tc = await getTranslations('common')

  // Il link da condividere porta il codice invito di chi legge
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user
    ? await supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>()
    : { data: null }
  const shareUrl = guideShareUrl(locale, me?.referral_code)

  return (
    <div className="min-h-screen bg-[var(--background)] print:bg-white">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {tm('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 text-right font-semibold tracking-wide">
            <BookOpenCheck className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {tm('antitruffa')}
          </h1>
        </div>
      </header>

      <main data-guide className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 print:max-w-none print:p-0">
        {/* Copertina */}
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] [print-color-adjust:exact] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <ShieldCheck className="h-4 w-4" />
              {g.eyebrow}
            </div>
            <h2 className="mb-5 text-3xl font-bold leading-tight sm:text-4xl">{g.title}</h2>
            <blockquote className="mb-5 border-l-4 border-[var(--gold)] pl-4 text-lg font-semibold italic leading-snug text-[var(--gold-bright)] sm:text-xl">
              “{g.motto}”
            </blockquote>
            <p className="mb-5 text-base leading-7 text-white/75">{g.lead}</p>
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-4 text-sm leading-6 text-white/85">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
              <span>{g.giftNote}</span>
            </div>
            <PrintGuideButton label={g.ui.print} />
          </div>
        </section>

        <div className="mb-8">
          <GuideShareButtons url={shareUrl} title={g.title} />
        </div>

        {/* Numeri */}
        <section className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {g.stats.map(s => (
              <div key={s.label} className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-4 text-center">
                <div className="text-xl font-bold text-[var(--ink)] sm:text-2xl">{s.value}</div>
                <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">{g.statsSource}</p>
        </section>

        {/* Test dei 10 secondi */}
        <section className="mb-8 break-inside-avoid rounded-3xl border-2 border-[var(--gold)] bg-[var(--gold-pale)]/60 p-6 sm:p-7">
          <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <Timer className="h-6 w-6 text-[var(--gold)]" />
            {g.tenSeconds.title}
          </h2>
          <p className="mb-4 text-sm leading-6 text-[var(--ink)]/80">{g.tenSeconds.intro}</p>
          <ol className="space-y-2">
            {g.tenSeconds.items.map((item, i) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--ink)]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)] [print-color-adjust:exact]">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </section>

        {/* Regole d'oro */}
        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <ShieldCheck className="h-6 w-6 text-[var(--gold)]" />
            {g.rules.title}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.rules.items.map(r => (
              <div key={r.title} className="break-inside-avoid rounded-2xl border border-black/5 bg-[var(--paper)] p-4 shadow-sm">
                <h3 className="mb-1 font-semibold text-[var(--ink)]">{r.title}</h3>
                <p className="text-sm leading-6 text-[var(--muted)]">{r.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Indice */}
        <nav className="mb-10 rounded-2xl bg-[var(--ink)] p-5 text-white print:hidden">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--gold-bright)]">
            <ListChecks className="h-4 w-4" />
            {g.ui.toc}
          </h2>
          <ol className="grid gap-1.5 sm:grid-cols-2">
            {g.chapters.map((c, i) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white/85 transition hover:bg-white/10 hover:text-white">
                  <span className="font-bold text-[var(--gold)]">{i + 1}.</span>
                  {c.title}
                  <span className="ml-auto text-xs text-white/40">{c.scams.length}</span>
                </a>
              </li>
            ))}
            <li>
              <a href="#vittima" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--gold-bright)] transition hover:bg-white/10">
                <Siren className="h-4 w-4" />
                {g.victim.title}
              </a>
            </li>
          </ol>
        </nav>

        {/* Capitoli */}
        {g.chapters.map((c, i) => (
          <section key={c.id} id={c.id} className="mb-10 scroll-mt-24">
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-widest text-[var(--gold)]">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h2 className="text-2xl font-bold text-[var(--ink)]">{c.title}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{c.intro}</p>
            </div>
            {/* Lo schema che si ripete in tutto il capitolo */}
            {c.pattern ? (
              <div className="mb-4 break-inside-avoid rounded-2xl border-l-4 border-[var(--gold)] bg-[var(--gold-pale)]/70 p-4 [print-color-adjust:exact]">
                <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                  {c.pattern.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--ink)]">{c.pattern.text}</p>
              </div>
            ) : null}
            <div className="space-y-3">
              {c.scams.map(s => (
                <ScamCard key={s.id} scam={s} ui={g.ui} />
              ))}
            </div>
            {/* Scheda da stampare e attaccare vicino alla porta */}
            {c.poster ? (
              <div className="mt-4 break-inside-avoid rounded-3xl border-2 border-dashed border-[var(--gold)] bg-white p-6 text-center [print-color-adjust:exact]">
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--gold)]">{c.poster.title}</p>
                <ul className="mx-auto mt-4 max-w-md space-y-3">
                  {c.poster.lines.map(line => (
                    <li key={line} className="text-lg font-bold leading-snug text-[var(--ink)] sm:text-xl">
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[var(--muted)] print:hidden">{c.poster.note}</p>
              </div>
            ) : null}
            {i === 0 ? <CheckMailCta ui={g.ui} /> : null}
          </section>
        ))}

        {/* Sei stato truffato? */}
        <section id="vittima" className="mb-8 scroll-mt-24 rounded-3xl bg-[var(--ink)] p-6 text-white [print-color-adjust:exact] sm:p-8">
          <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold">
            <Siren className="h-6 w-6 text-[var(--gold-bright)]" />
            {g.victim.title}
          </h2>
          <p className="mb-5 text-sm leading-6 text-white/70">{g.victim.intro}</p>
          <ol className="space-y-4">
            {g.victim.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 break-inside-avoid">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-sm font-bold text-[var(--ink)]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-[var(--gold-bright)]">{step.title}</h3>
                  <p className="text-sm leading-6 text-white/80">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Contatti */}
        <section className="mb-8">
          <h2 className="mb-1 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <Phone className="h-6 w-6 text-[var(--gold)]" />
            {g.contacts.title}
          </h2>
          <p className="mb-4 text-sm leading-6 text-[var(--muted)]">{g.contacts.intro}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.contacts.items.map(ct => (
              <div key={ct.name} className="flex break-inside-avoid flex-col rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-4">
                <h3 className="font-semibold text-[var(--ink)]">{ct.name}</h3>
                <p className="mb-3 mt-1 text-sm leading-6 text-[var(--muted)]">{ct.detail}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  {ct.phone ? (
                    <a
                      href={`tel:${ct.phone.replace(/[^\d+]/g, '')}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-sm font-bold text-[var(--gold-bright)] [print-color-adjust:exact]"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {ct.phone}
                    </a>
                  ) : null}
                  {ct.url ? (
                    <a
                      href={ct.url}
                      target={ct.url.startsWith('mailto:') ? undefined : '_blank'}
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 break-all rounded-full border border-[var(--gold)]/40 px-3 py-1.5 text-xs font-medium text-[var(--ink)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      {ct.url.replace(/^(https?:\/\/|mailto:)(www\.)?/, '').replace(/\/$/, '')}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {g.contacts.note ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{g.contacts.note}</p> : null}
        </section>

        {/* Perché denunciare */}
        <section className="mb-8 break-inside-avoid rounded-3xl border border-[var(--gold)]/30 bg-[var(--paper)] p-6">
          <h2 className="mb-3 text-xl font-bold text-[var(--ink)]">{g.whyReport.title}</h2>
          <ul className="space-y-2">
            {g.whyReport.items.map(item => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-[var(--ink)]">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <div className="mb-8">
          <GuideShareButtons url={shareUrl} title={g.title} />
        </div>

        <blockquote className="mb-6 text-center text-lg font-semibold italic text-[var(--ink)]">“{g.motto}”</blockquote>

        <footer className="space-y-2 text-center text-xs leading-5 text-[var(--muted)]">
          <p>{g.ui.updated}</p>
          <p>{g.ui.disclaimer}</p>
          <p>{g.ui.copyright}</p>
        </footer>
      </main>
    </div>
  )
}

function ScamCard({ scam, ui }: { scam: Scam; ui: GuideContent['ui'] }) {
  return (
    <details className="group break-inside-avoid overflow-hidden rounded-2xl border border-black/5 bg-[var(--paper)] shadow-sm open:border-[var(--gold)]/40">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--gold)]" />
        <span className="flex-1 font-semibold leading-snug text-[var(--ink)]">{scam.title}</span>
        <ChevronDown className="h-5 w-5 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180 print:hidden" />
      </summary>
      <div className="space-y-4 border-t border-black/5 px-4 pb-5 pt-4">
        {scam.vignette ? (
          <Vignette id={scam.vignette} className="mx-auto block w-full max-w-sm rounded-2xl [print-color-adjust:exact]" />
        ) : null}
        <div>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{ui.howItWorks}</h4>
          <p className="text-sm leading-6 text-[var(--ink)]">{scam.how}</p>
        </div>
        {scam.example ? <Example example={scam.example} label={ui.example} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {ui.flags}
            </h4>
            <ul className="space-y-1.5">
              {scam.flags.map(f => (
                <li key={f} className="flex gap-2 text-sm leading-5 text-[var(--ink)]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {ui.todo}
            </h4>
            <ul className="space-y-1.5">
              {scam.todo.map(t => (
                <li key={t} className="flex gap-2 text-sm leading-5 text-[var(--ink)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {scam.ai ? (
          <div className="flex gap-2 rounded-xl bg-[var(--gold-pale)]/70 p-3 text-sm leading-6 text-[var(--ink)]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
            <span>
              <strong>{ui.ai}: </strong>
              {scam.ai}
            </span>
          </div>
        ) : null}
      </div>
    </details>
  )
}

// Il messaggio d'esempio, disegnato come appare davvero (SMS, email, chiamata...)
function Example({ example, label }: { example: NonNullable<Scam['example']>; label: string }) {
  const { kind, from, text } = example
  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{label}</h4>
      {kind === 'email' ? (
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white text-sm">
          <div className="border-b border-black/10 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <span className="font-semibold">{from}</span>
          </div>
          <p className="px-3 py-3 leading-6 text-gray-800">{text}</p>
        </div>
      ) : kind === 'call' ? (
        <div className="rounded-xl bg-[var(--ink)] p-4 text-sm text-white [print-color-adjust:exact]">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--gold-bright)]">
            <Phone className="h-3.5 w-3.5" />
            {from}
          </div>
          <p className="italic leading-6 text-white/85">“{text}”</p>
        </div>
      ) : kind === 'popup' ? (
        <div className="overflow-hidden rounded-xl border-2 border-red-600 bg-white text-sm">
          <div className="flex items-center gap-2 bg-red-600 px-3 py-1.5 text-xs font-bold text-white [print-color-adjust:exact]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {from}
          </div>
          <p className="px-3 py-3 font-semibold leading-6 text-red-700">{text}</p>
        </div>
      ) : kind === 'notice' ? (
        // Avviso affisso (Comune, Carabinieri)
        <div className="rounded-xl border border-black/15 bg-[#fffdf5] p-4 text-sm shadow-sm [print-color-adjust:exact]">
          <div className="mb-2 border-b border-black/10 pb-2 text-xs font-bold uppercase tracking-wide text-gray-700">{from}</div>
          <p className="leading-6 text-gray-800">{text}</p>
        </div>
      ) : kind === 'door' ? (
        // Conversazione alla porta
        <div className="flex gap-3 rounded-xl bg-[var(--ink)] p-4 text-sm text-white [print-color-adjust:exact]">
          <DoorClosed className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
          <div>
            <div className="mb-1 text-xs text-[var(--gold-bright)]">{from}</div>
            <p className="italic leading-6 text-white/85">“{text}”</p>
          </div>
        </div>
      ) : kind === 'ad' ? (
        <div className="rounded-xl border border-black/10 bg-white p-3 text-sm">
          <div className="mb-1 text-[11px] font-medium text-gray-500">{from}</div>
          <p className="font-semibold leading-6 text-gray-900">{text}</p>
        </div>
      ) : (
        // sms e chat: fumetto
        <div className="max-w-md">
          <div className="mb-1 pl-1 text-xs font-semibold text-[var(--muted)]">{from}</div>
          <p
            className={`rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-6 ${
              kind === 'chat' ? 'bg-[#dcf8c6] text-gray-900' : 'bg-gray-200 text-gray-900'
            } [print-color-adjust:exact]`}
          >
            {text}
          </p>
        </div>
      )}
    </div>
  )
}

function CheckMailCta({ ui }: { ui: GuideContent['ui'] }) {
  return (
    <Link
      href="/marketplace/checkmail"
      className="mt-4 flex items-center gap-4 rounded-2xl bg-[var(--ink)] p-4 text-white transition hover:shadow-lg print:hidden"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold)]/15">
        <MailSearch className="h-6 w-6 text-[var(--gold-bright)]" />
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{ui.checkmailTitle}</span>
        <span className="block text-sm leading-5 text-white/70">{ui.checkmailText}</span>
      </span>
      <span className="hidden items-center gap-1 text-sm font-semibold text-[var(--gold-bright)] sm:flex">
        {ui.checkmailCta}
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  )
}
