import { byMostRecent, descriptionLines, formatCvDate, nameLines, type CvExperience, type CvEducation, type CvLanguage } from '@/lib/cv'
import { formatBirthDate, getCvLabels, type CvLabels } from '@/lib/cvLabels'
import type { CvTemplateData } from './cvTemplateTypes'

// Pezzi comuni ai modelli Moderno, Professionale, Elegante e Formato europeo:
// scritte nella lingua del CV, ordine dal più recente, descrizioni a punti.

export function cvContext(cv: CvTemplateData) {
  const L = getCvLabels(cv.contentLanguage)
  const experiences = byMostRecent(cv.experiences)
  const education = byMostRecent(cv.education)
  const native = cv.languages.filter((l) => l.native)
  const foreign = cv.languages.filter((l) => !l.native)
  const personal = [
    cv.extras?.birthDate ? { label: L.birthDate, value: formatBirthDate(cv.extras.birthDate, cv.contentLanguage) } : null,
    cv.extras?.nationality ? { label: L.nationality, value: cv.extras.nationality } : null,
    cv.extras?.drivingLicence ? { label: L.drivingLicence, value: cv.extras.drivingLicence } : null,
  ].filter((x): x is { label: string; value: string } => !!x)
  return { L, experiences, education, native, foreign, personal }
}

export function cvDateRange(item: CvExperience | CvEducation, L: CvLabels, locale: string): string {
  const start = formatCvDate(item.startDate, locale)
  const end = item.current ? L.present : formatCvDate(item.endDate, locale)
  if (start && end) return `${start} – ${end}`
  return start || end
}

export function languageLevel(lang: CvLanguage, L: CvLabels): string {
  return lang.native ? L.motherTongue : lang.level
}

export function CvDescription({ text, className = '' }: { text: string; className?: string }) {
  if (!text?.trim()) return null
  const { bullets, lines } = descriptionLines(text)
  if (bullets) {
    return (
      <ul className={`list-disc pl-4 space-y-0.5 marker:text-current ${className}`}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    )
  }
  return <p className={`whitespace-pre-wrap ${className}`}>{text.trim()}</p>
}

export function CvPrivacyNote({ cv, className = '' }: { cv: CvTemplateData; className?: string }) {
  if (cv.extras?.privacyConsent !== true) return null
  return <p className={`text-[10px] leading-4 text-gray-400 ${className}`}>{getCvLabels(cv.contentLanguage).privacy}</p>
}

// Testo a elenco (competenze digitali, interessi): virgole o righe diventano voci
export function splitList(text: string | undefined): string[] {
  return (text || '')
    .split(/\r?\n|,|;/)
    .map((x) => x.replace(/^[-•*–]\s*/, '').trim())
    .filter(Boolean)
}

// Nome che si adatta allo spazio: righe divise tra le parole e grandezza
// calcolata sulla larghezza del contenitore (unità cqw), così il cognome
// non viene mai spezzato. Il genitore deve avere la classe «@container».
export function CvName({
  name,
  maxRem,
  em,
  oneLineMax = 16,
  maxLines = 2,
  className = '',
  style,
}: {
  name: string
  maxRem: number
  em: number // larghezza media di una lettera in em (con la spaziatura)
  oneLineMax?: number
  maxLines?: number
  className?: string
  style?: React.CSSProperties
}) {
  const lines = nameLines(name || '—', oneLineMax, maxLines)
  const longest = Math.max(4, ...lines.map((l) => l.length))
  return (
    <h1 className={className} style={{ ...style, fontSize: `min(${maxRem}rem, calc(100cqw / ${(longest * em).toFixed(2)}))` }}>
      {lines.map((l, i) => (
        <span key={i} className="block whitespace-nowrap">
          {l}
        </span>
      ))}
    </h1>
  )
}

// Email e link lunghi: possono andare a capo solo dopo @ . / - (mai a metà parola)
export function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[@./_-])/)
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <wbr />}
        </span>
      ))}
    </>
  )
}

// Periodo «inizio – fine» che va a capo solo tra le due date
export function CvDateRange({ item, L, locale }: { item: CvExperience | CvEducation; L: CvLabels; locale: string }) {
  const start = formatCvDate(item.startDate, locale)
  const end = item.current ? L.present : formatCvDate(item.endDate, locale)
  if (!start || !end) return <span className="whitespace-nowrap">{start || end}</span>
  return (
    <>
      <span className="whitespace-nowrap">{start} –</span> <span className="whitespace-nowrap">{end}</span>
    </>
  )
}
