/* eslint-disable @next/next/no-img-element -- pagina per il PDF: immagini locali senza ottimizzazione */
import { notFound } from 'next/navigation'
import Vignette from '@/components/antitruffa/Vignette'
import { getGuideContent } from '@/lib/antitruffa/content'
import type { GuideContent, Scam } from '@/lib/antitruffa/types'
import { CONTACT_INFO } from '@/lib/contactInfo'

// Manuale Antitruffa impaginato in A4 per il PDF da scaricare o stampare.
// Lo legge scripts/manual-pdf.mjs con il browser senza finestra e lo salva
// in private/manuale/manuale-antitruffa-<lingua>.pdf. Testi del manuale da
// src/lib/antitruffa/content; qui solo le poche parole dell'impaginazione.

const LANGS = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const

const PRINT_TEXT: Record<(typeof LANGS)[number], { edition: string; contents: string; chapter: string; backTitle: string; backText: string; tools: string }> = {
  it: { edition: 'Edizione 2026', contents: 'Cosa trovi in questo manuale', chapter: 'Capitolo', backTitle: 'Nel dubbio, fermati e controlla.', backText: 'Su KUMANI puoi controllare siti, email, IBAN, numeri di telefono e QR code prima di fidarti, e avvisare gli altri con la Rete Anti-Truffa.', tools: 'Gli strumenti antitruffa di KUMANI' },
  en: { edition: '2026 edition', contents: 'What you will find in this guide', chapter: 'Chapter', backTitle: 'When in doubt, stop and check.', backText: 'On KUMANI you can check websites, emails, IBANs, phone numbers and QR codes before you trust them, and warn others with the Anti-Scam Network.', tools: 'KUMANI’s anti-scam tools' },
  fr: { edition: 'Édition 2026', contents: 'Ce que vous trouverez dans ce guide', chapter: 'Chapitre', backTitle: 'Dans le doute, arrêtez-vous et vérifiez.', backText: 'Sur KUMANI, vous pouvez vérifier sites, e-mails, IBAN, numéros de téléphone et QR codes avant de leur faire confiance, et prévenir les autres avec le Réseau Anti-Arnaque.', tools: 'Les outils anti-arnaque de KUMANI' },
  es: { edition: 'Edición 2026', contents: 'Qué encontrarás en este manual', chapter: 'Capítulo', backTitle: 'Ante la duda, para y comprueba.', backText: 'En KUMANI puedes comprobar webs, correos, IBAN, números de teléfono y códigos QR antes de fiarte, y avisar a los demás con la Red Antiestafa.', tools: 'Las herramientas antiestafa de KUMANI' },
  pt: { edition: 'Edição 2026', contents: 'O que encontra neste manual', chapter: 'Capítulo', backTitle: 'Na dúvida, pare e verifique.', backText: 'Na KUMANI pode verificar sites, emails, IBAN, números de telefone e códigos QR antes de confiar, e avisar os outros com a Rede Antiburla.', tools: 'As ferramentas antiburla da KUMANI' },
  de: { edition: 'Ausgabe 2026', contents: 'Was du in diesem Handbuch findest', chapter: 'Kapitel', backTitle: 'Im Zweifel: anhalten und prüfen.', backText: 'Bei KUMANI kannst du Websites, E-Mails, IBANs, Telefonnummern und QR-Codes prüfen, bevor du ihnen vertraust, und andere über das Anti-Betrugs-Netz warnen.', tools: 'Die Anti-Betrugs-Werkzeuge von KUMANI' },
  ru: { edition: 'Издание 2026', contents: 'Что вы найдёте в этом руководстве', chapter: 'Глава', backTitle: 'Сомневаетесь — остановитесь и проверьте.', backText: 'В KUMANI можно проверить сайты, письма, IBAN, номера телефонов и QR-коды, прежде чем доверять, и предупредить других через Сеть против мошенников.', tools: 'Инструменты KUMANI против мошенников' },
}

// Impaginazione: A4, margini, numero di pagina in basso (non in copertina)
const css = (title: string) => `
:root { --background: #fff; --gold: #c79a3b; --gold-bright: #e7c56a; --gold-pale: #f5e8bd; --ink: #171717; --muted: #6b655a; --paper: #fffdf7; }
@page { size: A4; margin: 16mm 15mm 18mm 15mm;
  @bottom-left { content: "KUMANI · ${title.replace(/"/g, '\\"')}"; font: 500 7.5pt var(--font-geist-sans), sans-serif; color: #9a917f; }
  @bottom-right { content: counter(page); font: 700 8pt var(--font-geist-sans), sans-serif; color: #c79a3b; }
}
@page full { margin: 0; @bottom-left { content: none } @bottom-right { content: none } }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 10pt; }
html, body { margin: 0; background: #fff !important; }
.full { page: full; break-after: page; width: 210mm; height: 297mm; box-sizing: border-box; position: relative; overflow: hidden; }
.chapter { break-before: page; }
.keep { break-inside: avoid; }
h1, h2, h3, h4 { break-after: avoid; }
`

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }))
}

export default async function ManualPrintPage({ params }: { params: Promise<{ lang: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { lang } = await params
  if (!LANGS.includes(lang as (typeof LANGS)[number])) notFound()
  const p = PRINT_TEXT[lang as (typeof LANGS)[number]]
  const g = await getGuideContent(lang)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css(g.title) }} />

      {/* Copertina a tutta pagina: logo grande al centro, titolo e motto */}
      <section className="full flex flex-col items-center bg-[var(--ink)] px-[20mm] pb-[16mm] pt-[30mm] text-center text-white">
        <div className="pointer-events-none absolute -right-[45mm] -top-[45mm] h-[150mm] w-[150mm] rounded-full border-[1.2mm] border-[var(--gold)]/20" />
        <div className="pointer-events-none absolute -bottom-[70mm] -left-[55mm] h-[160mm] w-[160mm] rounded-full bg-[var(--gold)]/[0.07]" />
        <img src="/brand/logo-scuro-print.png" alt="KUMANI" className="relative h-[62mm] w-[62mm]" />
        <p className="relative mt-[7mm] text-[11pt] font-semibold uppercase tracking-[0.35em] text-[var(--gold-bright)]">{g.eyebrow}</p>
        <div className="relative my-[9mm] h-[0.8mm] w-[30mm] rounded-full bg-[var(--gold)]" />
        <h1 className="relative max-w-[165mm] text-[34pt] font-extrabold leading-[1.1] tracking-tight">{g.title}</h1>
        <p className="relative mt-[9mm] max-w-[150mm] text-[15pt] font-semibold italic leading-snug text-[var(--gold-bright)]">“{g.motto}”</p>
        <p className="relative mt-[7mm] max-w-[155mm] text-[10.5pt] leading-relaxed text-white/70">{g.lead}</p>
        <div className="relative mt-auto flex w-full items-end justify-between border-t border-white/15 pt-[5mm] text-left text-[8.5pt] text-white/55">
          <span className="max-w-[130mm]">{g.giftNote}</span>
          <span className="ml-[8mm] shrink-0 text-right">
            <span className="block text-[12pt] font-bold tracking-wide text-[var(--gold-bright)]">kumani.io</span>
            <span className="block uppercase tracking-[0.2em]">{p.edition}</span>
          </span>
        </div>
      </section>

      {/* Indice, numeri e test dei 10 secondi */}
      <section>
        <PageTitle kicker="KUMANI" title={p.contents} />
        <ol className="grid grid-cols-2 gap-x-[8mm] gap-y-[2.5mm]">
          {g.chapters.map((c, i) => (
            <li key={c.id} className="flex items-baseline gap-[3mm] border-b border-black/10 pb-[2mm]">
              <span className="text-[13pt] font-extrabold text-[var(--gold)]">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 text-[10.5pt] font-semibold">{c.title}</span>
              <span className="text-[8.5pt] text-[var(--muted)]">{c.scams.length}</span>
            </li>
          ))}
          <li className="flex items-baseline gap-[3mm] border-b border-black/10 pb-[2mm]">
            <span className="text-[13pt] font-extrabold text-red-600">!</span>
            <span className="flex-1 text-[10.5pt] font-semibold">{g.victim.title}</span>
          </li>
        </ol>

        <div className="keep mt-[9mm] grid grid-cols-4 gap-[3mm]">
          {g.stats.map((s) => (
            <div key={s.label} className="rounded-[3mm] bg-[var(--ink)] p-[4mm] text-center text-white">
              <div className="text-[15pt] font-extrabold text-[var(--gold-bright)]">{s.value}</div>
              <div className="mt-[1.5mm] text-[7.5pt] leading-snug text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-[2mm] text-[7pt] text-[var(--muted)]">{g.statsSource}</p>

        <div className="keep mt-[8mm] rounded-[4mm] border-[0.6mm] border-[var(--gold)] bg-[var(--gold-pale)]/50 p-[6mm]">
          <h2 className="text-[16pt] font-extrabold">{g.tenSeconds.title}</h2>
          <p className="mt-[1.5mm] text-[9.5pt] leading-relaxed text-[var(--ink)]/80">{g.tenSeconds.intro}</p>
          <ol className="mt-[4mm] grid grid-cols-2 gap-x-[6mm] gap-y-[2.5mm]">
            {g.tenSeconds.items.map((item, i) => (
              <li key={item} className="flex gap-[2.5mm] text-[9.5pt] leading-snug">
                <span className="flex h-[6mm] w-[6mm] shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[8pt] font-bold text-[var(--gold-bright)]">{i + 1}</span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Regole d'oro */}
      <section className="chapter">
        <PageTitle kicker="KUMANI" title={g.rules.title} />
        <div className="grid grid-cols-2 gap-[4mm]">
          {g.rules.items.map((r, i) => (
            <div key={r.title} className="keep rounded-[4mm] border border-black/10 bg-[var(--paper)] p-[5mm]">
              <div className="flex items-center gap-[3mm]">
                <span className="flex h-[8mm] w-[8mm] shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-[10pt] font-extrabold text-[var(--ink)]">{i + 1}</span>
                <h3 className="text-[11.5pt] font-bold leading-tight">{r.title}</h3>
              </div>
              <p className="mt-[2.5mm] text-[9.5pt] leading-relaxed text-[var(--muted)]">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capitoli */}
      {g.chapters.map((c, i) => (
        <section key={c.id} className="chapter">
          <div className="mb-[6mm] flex items-end gap-[5mm] border-b-[0.6mm] border-[var(--gold)] pb-[4mm]">
            <span className="text-[40pt] font-extrabold leading-none text-[var(--gold)]">{String(i + 1).padStart(2, '0')}</span>
            <div className="pb-[1mm]">
              <p className="text-[8pt] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">{p.chapter} {i + 1}</p>
              <h2 className="text-[20pt] font-extrabold leading-tight">{c.title}</h2>
            </div>
          </div>
          <p className="mb-[5mm] text-[10.5pt] leading-relaxed text-[var(--ink)]/80">{c.intro}</p>
          {c.pattern ? (
            <div className="keep mb-[5mm] rounded-[3mm] border-l-[1.2mm] border-[var(--gold)] bg-[var(--gold-pale)]/60 p-[4mm]">
              <p className="text-[10.5pt] font-bold">{c.pattern.title}</p>
              <p className="mt-[1mm] text-[9.5pt] leading-relaxed">{c.pattern.text}</p>
            </div>
          ) : null}
          <div className="space-y-[5mm]">
            {c.scams.map((s) => (
              <ScamBlock key={s.id} scam={s} ui={g.ui} />
            ))}
          </div>
          {c.poster ? (
            <div className="keep mt-[6mm] rounded-[5mm] border-[0.6mm] border-dashed border-[var(--gold)] p-[7mm] text-center">
              <p className="text-[9pt] font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{c.poster.title}</p>
              <ul className="mx-auto mt-[4mm] max-w-[130mm] space-y-[3mm]">
                {c.poster.lines.map((line) => (
                  <li key={line} className="text-[14pt] font-extrabold leading-snug">{line}</li>
                ))}
              </ul>
              <p className="mx-auto mt-[4mm] max-w-[130mm] text-[8.5pt] text-[var(--muted)]">{c.poster.note}</p>
            </div>
          ) : null}
        </section>
      ))}

      {/* Sei stato truffato? */}
      <section className="chapter">
        <div className="rounded-[5mm] bg-[var(--ink)] p-[8mm] text-white">
          <p className="text-[9pt] font-bold uppercase tracking-[0.2em] text-red-400">SOS</p>
          <h2 className="mt-[1mm] text-[22pt] font-extrabold">{g.victim.title}</h2>
          <p className="mt-[2mm] text-[10pt] leading-relaxed text-white/70">{g.victim.intro}</p>
          <ol className="mt-[6mm] space-y-[4.5mm]">
            {g.victim.steps.map((step, i) => (
              <li key={step.title} className="keep flex gap-[4mm]">
                <span className="flex h-[9mm] w-[9mm] shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-[11pt] font-extrabold text-[var(--ink)]">{i + 1}</span>
                <div>
                  <h3 className="text-[11pt] font-bold text-[var(--gold-bright)]">{step.title}</h3>
                  <p className="mt-[0.5mm] text-[9.5pt] leading-relaxed text-white/80">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Contatti utili e perché denunciare */}
      <section className="chapter">
        <PageTitle kicker="KUMANI" title={g.contacts.title} />
        <p className="-mt-[3mm] mb-[5mm] text-[10pt] leading-relaxed text-[var(--muted)]">{g.contacts.intro}</p>
        <div className="grid grid-cols-2 gap-[3.5mm]">
          {g.contacts.items.map((ct) => (
            <div key={ct.name} className="keep rounded-[3mm] border border-black/10 bg-[var(--paper)] p-[4mm]">
              <h3 className="text-[10.5pt] font-bold">{ct.name}</h3>
              <p className="mt-[1mm] text-[8.5pt] leading-relaxed text-[var(--muted)]">{ct.detail}</p>
              <p className="mt-[2mm] flex flex-wrap gap-x-[3mm] text-[9pt] font-bold">
                {ct.phone ? <span className="text-[var(--ink)]">☎ {ct.phone}</span> : null}
                {ct.url ? <span className="break-all font-semibold text-[#9a7425]">{ct.url.replace(/^(https?:\/\/|mailto:)(www\.)?/, '').replace(/\/$/, '')}</span> : null}
              </p>
            </div>
          ))}
        </div>
        {g.contacts.note ? <p className="mt-[3mm] text-[8.5pt] text-[var(--muted)]">{g.contacts.note}</p> : null}

        <div className="keep mt-[7mm] rounded-[4mm] border border-[var(--gold)]/40 bg-[var(--gold-pale)]/40 p-[6mm]">
          <h2 className="text-[14pt] font-extrabold">{g.whyReport.title}</h2>
          <ul className="mt-[3mm] space-y-[2mm]">
            {g.whyReport.items.map((item) => (
              <li key={item} className="flex gap-[2.5mm] text-[9.5pt] leading-relaxed">
                <span className="mt-[1.6mm] h-[1.8mm] w-[1.8mm] shrink-0 rounded-full bg-[var(--gold)]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Retro di copertina */}
      <section className="full flex flex-col items-center justify-center bg-[var(--ink)] px-[25mm] text-center text-white">
        <img src="/brand/logo-scuro-print.png" alt="KUMANI" className="h-[38mm] w-[38mm]" />
        <p className="mt-[10mm] text-[24pt] font-extrabold leading-tight">{p.backTitle}</p>
        <p className="mt-[5mm] max-w-[140mm] text-[11pt] leading-relaxed text-white/75">{p.backText}</p>
        <p className="mt-[9mm] rounded-full bg-[var(--gold)] px-[8mm] py-[3mm] text-[16pt] font-extrabold tracking-wide text-[var(--ink)]">kumani.io</p>
        <p className="mt-[10mm] max-w-[140mm] text-[13pt] font-semibold italic text-[var(--gold-bright)]">“{g.motto}”</p>
        <div className="absolute bottom-[14mm] left-[25mm] right-[25mm] space-y-[1.5mm] text-[7pt] leading-relaxed text-white/45">
          <p>{g.ui.updated}</p>
          <p>{g.ui.disclaimer}</p>
          <p>
            {g.ui.copyright} · {CONTACT_INFO.company.name}
            {CONTACT_INFO.company.vatNumber ? ` · P.IVA ${CONTACT_INFO.company.vatNumber}` : ''}
          </p>
        </div>
      </section>
    </>
  )
}

function PageTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-[7mm] flex items-center gap-[4mm]">
      <img src="/brand/logo-scuro-print.png" alt="" className="h-[11mm] w-[11mm]" />
      <div>
        <p className="text-[8pt] font-bold uppercase tracking-[0.25em] text-[var(--gold)]">{kicker}</p>
        <h2 className="text-[20pt] font-extrabold leading-tight">{title}</h2>
      </div>
    </div>
  )
}

// Una truffa: titolo, disegno a fianco, come funziona, esempio, segnali e cosa fare
function ScamBlock({ scam, ui }: { scam: Scam; ui: GuideContent['ui'] }) {
  return (
    <article className="overflow-hidden rounded-[4mm] border border-black/10 bg-[var(--paper)] [box-decoration-break:clone]">
      <div className="flex items-center gap-[3mm] bg-[var(--ink)] px-[5mm] py-[3mm] [break-after:avoid]">
        <span className="text-[12pt] text-[var(--gold-bright)]">⚠</span>
        <h3 className="text-[12pt] font-bold leading-snug text-white">{scam.title}</h3>
      </div>
      <div className="p-[5mm]">
        <div className="keep flex gap-[5mm]">
          <div className="flex-1">
            <h4 className="text-[7.5pt] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{ui.howItWorks}</h4>
            <p className="mt-[1mm] text-[9.5pt] leading-relaxed">{scam.how}</p>
            {scam.example ? (
              <div className="mt-[3.5mm]">
                <h4 className="text-[7.5pt] font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{ui.example}</h4>
                <div className="mt-[1.5mm] rounded-[2.5mm] border border-black/10 bg-white p-[3mm]">
                  <p className="text-[7.5pt] font-semibold text-[var(--muted)]">{scam.example.from}</p>
                  <p className="mt-[1mm] text-[9pt] italic leading-relaxed">“{scam.example.text}”</p>
                </div>
              </div>
            ) : null}
          </div>
          {scam.vignette ? (
            <div className="w-[52mm] shrink-0">
              <Vignette id={scam.vignette} className="block w-full rounded-[3mm]" />
            </div>
          ) : null}
        </div>
        <div className="keep mt-[4mm] grid grid-cols-2 gap-[4mm]">
          <div className="rounded-[2.5mm] bg-red-50 p-[3.5mm]">
            <h4 className="text-[7.5pt] font-bold uppercase tracking-[0.18em] text-red-700">{ui.flags}</h4>
            <ul className="mt-[1.5mm] space-y-[1.2mm]">
              {scam.flags.map((f) => (
                <li key={f} className="flex gap-[2mm] text-[9pt] leading-snug">
                  <span className="mt-[1.4mm] h-[1.6mm] w-[1.6mm] shrink-0 rounded-full bg-red-600" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[2.5mm] bg-emerald-50 p-[3.5mm]">
            <h4 className="text-[7.5pt] font-bold uppercase tracking-[0.18em] text-emerald-700">{ui.todo}</h4>
            <ul className="mt-[1.5mm] space-y-[1.2mm]">
              {scam.todo.map((t) => (
                <li key={t} className="flex gap-[2mm] text-[9pt] leading-snug">
                  <span className="shrink-0 font-bold text-emerald-600">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        {scam.ai ? (
          <p className="keep mt-[3mm] rounded-[2.5mm] bg-[var(--gold-pale)]/60 px-[3.5mm] py-[2.5mm] text-[8.5pt] leading-relaxed">
            <strong>{ui.ai}: </strong>
            {scam.ai}
          </p>
        ) : null}
      </div>
    </article>
  )
}
