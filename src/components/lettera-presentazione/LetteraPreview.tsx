'use client'

import { Mail, MapPin, Phone } from 'lucide-react'
import { getCvLabels } from '@/lib/cvLabels'
import { letterModel, type CoverLetterForm, type LetterModel } from '@/lib/letteraPresentazione'
import { Breakable, CvName } from '@/components/cv/cvShared'

// Anteprima della lettera con l'aspetto del modello scelto (gli stessi colori
// e caratteri dei modelli del KUMANI CV e del PDF). Le parti ancora da
// completare, tra parentesi quadre, sono evidenziate in giallo.

const serif = { fontFamily: "'KumaniCvSerif', Georgia, 'Times New Roman', serif" }
const NAVY = '#0f2a4a'
const EU_BLUE = '#1d4f91'

function Hl({ text }: { text: string }) {
  const parts = text.split(/(\[[^\][\n]{1,40}\])/g)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

function Body({ m, strong, text }: { m: LetterModel; strong: string; text: string }) {
  const { L } = m
  return (
    <div className="text-[13px] leading-[1.6]" style={{ color: text }}>
      {m.recipient.length > 0 && (
        <div className={L.recipientRight ? 'ml-auto w-full @md:w-1/2' : 'w-full @md:w-3/5'}>
          {m.recipient.map((r, i) => (
            <p key={i} className={r.bold ? 'font-bold' : ''} style={r.bold ? { color: strong } : undefined}>
              {r.text}
            </p>
          ))}
        </div>
      )}
      {m.placeDate && <p className={`mt-6 ${L.dateLeft ? '' : 'text-right'}`}>{m.placeDate}</p>}
      {m.subject && (
        <p className="mt-6 font-bold" style={{ color: strong }}>
          {L.subjectPrefix && <>{L.subjectPrefix} </>}
          <Hl text={m.subject} />
        </p>
      )}
      {m.greeting && (
        <p className="mt-5">
          <Hl text={m.greeting} />
        </p>
      )}
      <div className="mt-3 space-y-2.5">
        {m.paragraphs.map((p, i) => (
          <p key={i} className="break-words">
            <Hl text={p} />
          </p>
        ))}
      </div>
      {m.closing && (
        <p className="mt-5">
          <Hl text={m.closing} />
        </p>
      )}
      {m.signature && (
        <p className="mt-10 font-bold" style={{ color: strong }}>
          <Hl text={m.signature} />
        </p>
      )}
      {m.enclosure && <p className="mt-7 text-[11px] text-gray-500">{m.enclosure}</p>}
    </div>
  )
}

function ContactsStack({ m, className = '', iconClass = '' }: { m: LetterModel; className?: string; iconClass?: string }) {
  if (!m.contacts.length) return null
  return (
    <ul className={`space-y-1 text-[12px] ${className}`}>
      {m.email && (
        <li className="flex items-center justify-end gap-1.5 break-words">
          <span><Breakable text={m.email} /></span>
          <Mail className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
        </li>
      )}
      {m.phone && (
        <li className="flex items-center justify-end gap-1.5">
          <span>{m.phone}</span>
          <Phone className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
        </li>
      )}
      {m.city && (
        <li className="flex items-center justify-end gap-1.5">
          <span>{m.city}</span>
          <MapPin className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} />
        </li>
      )}
    </ul>
  )
}

const contactLine = (m: LetterModel, sep = '   ·   ') => m.contacts.join(sep)

function Page({ m }: { m: LetterModel }) {
  const name = m.name || m.L.namePlaceholder
  const nameClass = m.name ? '' : 'opacity-40'

  if (m.template === 'moderno') {
    return (
      <div className="bg-white p-6 font-sans @md:p-10">
        <header className="mb-8 flex flex-col gap-4 border-b border-gray-300 pb-5 @md:flex-row @md:items-start @md:justify-between">
          <div className="@container min-w-0 flex-1 border-l-4 border-gray-900 pl-4">
            <CvName name={name} maxRem={1.9} em={0.84} oneLineMax={16} maxLines={2} className={`font-extrabold uppercase leading-[1.1] tracking-[0.12em] text-gray-900 ${nameClass}`} />
            {m.role && <p className="mt-1 text-[13px] uppercase tracking-[0.18em] text-gray-500">{m.role}</p>}
          </div>
          <ContactsStack m={m} className="text-gray-600 @md:max-w-[45%]" iconClass="text-gray-400" />
        </header>
        <Body m={m} strong="#171717" text="#373737" />
      </div>
    )
  }

  if (m.template === 'professionale') {
    return (
      <div className="bg-white font-sans">
        <header className="flex flex-col gap-4 px-6 py-7 text-white @md:flex-row @md:items-center @md:justify-between @md:px-10" style={{ background: NAVY }}>
          <div className="@container min-w-0 flex-1">
            <CvName name={name} maxRem={1.7} em={0.7} oneLineMax={16} maxLines={2} className={`font-extrabold uppercase leading-[1.15] tracking-wide text-white ${nameClass}`} />
            {m.role && <p className="mt-1 text-sky-200">{m.role}</p>}
          </div>
          <ContactsStack m={m} className="text-white/90 @md:max-w-[45%]" iconClass="text-sky-200" />
        </header>
        <div className="p-6 @md:p-10">
          <Body m={m} strong={NAVY} text="#373737" />
        </div>
      </div>
    )
  }

  if (m.template === 'elegante') {
    return (
      <div className="bg-[#fbfbfa] p-6 font-sans @md:p-10">
        <header className="mb-8">
          {m.role && <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-gray-500">{m.role}</p>}
          <div className="@container">
            <CvName name={name} maxRem={2.4} em={0.7} oneLineMax={22} maxLines={2} style={serif} className={`uppercase leading-[1.05] tracking-wide text-gray-800 ${nameClass}`} />
          </div>
          <div className="my-3 h-px bg-gray-300" />
          {m.contacts.length > 0 && <p className="whitespace-pre-wrap break-words text-[12px] text-gray-600">{contactLine(m, '   |   ')}</p>}
        </header>
        <Body m={m} strong="#2d2d2d" text="#4b4b4b" />
      </div>
    )
  }

  if (m.template === 'europeo') {
    return (
      <div className="bg-white p-6 font-sans @md:p-10">
        <header className="mb-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{m.L.docTitle}</p>
          <div className="@container">
            <CvName name={name} maxRem={1.75} em={0.62} oneLineMax={30} className={`mt-1 font-bold leading-tight text-gray-900 ${nameClass}`} />
          </div>
          {m.role && <p className="mt-1 text-base" style={{ color: EU_BLUE }}>{m.role}</p>}
          <div className="mb-2 mt-3 h-0.5" style={{ background: EU_BLUE }} />
          {m.contacts.length > 0 && <p className="whitespace-pre-wrap break-words text-[12px] text-gray-700">{contactLine(m)}</p>}
        </header>
        <Body m={m} strong={EU_BLUE} text="#373737" />
      </div>
    )
  }

  if (m.template === 'sidebar') {
    return (
      <div className="flex min-h-full flex-col bg-white font-sans @md:flex-row">
        <aside className="shrink-0 bg-[var(--ink)] p-6 text-white @md:w-[26%]">
          {m.contacts.length > 0 && (
            <>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--gold)]">{getCvLabels(m.lang).contact}</p>
              <div className="space-y-1.5 text-[12px] text-white/85">
                {[m.email, m.phone, m.city].filter(Boolean).map((c) => (
                  <p key={c} className="break-words">
                    <Breakable text={c} />
                  </p>
                ))}
              </div>
            </>
          )}
        </aside>
        <div className="min-w-0 flex-1 p-6 @md:p-9">
          <header className="mb-8">
            <div className="@container">
              <CvName name={name} maxRem={1.6} em={0.62} oneLineMax={22} className={`font-bold leading-tight text-[var(--ink)] ${nameClass}`} />
            </div>
            {m.role && <p className="mt-1 text-[var(--gold)]">{m.role}</p>}
          </header>
          <Body m={m} strong="#171717" text="#373737" />
        </div>
      </div>
    )
  }

  // Minimal e Classic
  const classic = m.template === 'classic'
  return (
    <div className="bg-white p-6 @md:p-10" style={classic ? serif : undefined}>
      <header className={`mb-8 ${classic ? 'text-center' : ''}`}>
        <div className="@container">
          <CvName name={name} maxRem={1.6} em={0.62} oneLineMax={30} className={`font-bold leading-tight text-[var(--ink)] ${nameClass}`} />
        </div>
        {m.role && <p className="mt-1 text-[var(--gold)]">{m.role}</p>}
        {m.contacts.length > 0 && <p className="mt-1.5 whitespace-pre-wrap break-words text-[12px] text-gray-500">{contactLine(m)}</p>}
        {classic && <div className="mx-auto mt-4 h-px w-16 bg-[var(--gold)]" />}
      </header>
      <Body m={m} strong="#171717" text="#373737" />
    </div>
  )
}

export default function LetteraPreview({ form }: { form: CoverLetterForm }) {
  const m = letterModel(form)
  return (
    <div className="@container">
      {/* Foglio con le proporzioni di un A4 (almeno), che si allunga col testo */}
      <div lang={m.lang} className="min-h-[141cqw] bg-white shadow-sm [&>div]:min-h-[141cqw]">
        <Page m={m} />
      </div>
    </div>
  )
}
