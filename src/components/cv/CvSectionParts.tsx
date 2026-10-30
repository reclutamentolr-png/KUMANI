'use client'

import { useTranslations } from 'next-intl'
import { formatCvDate } from '@/lib/cv'
import type { CvExperience, CvEducation, CvSkill, CvLanguage, CvCertification, CvLink } from '@/lib/cv'
import { normalizeExternalUrl } from '@/lib/linkUtils'
import { getCvLabels } from '@/lib/cvLabels'
import type { CvTemplateData } from './cvTemplateTypes'
import { CvDescription, CvPrivacyNote, cvContext, splitList } from './cvShared'

// Small presentational building blocks shared by all 3 CV templates, so
// field rendering (dates, skill dots, link styling) lives in one place
// instead of being re-derived in Minimal/Classic/Sidebar separately.

export function CvSectionHeading({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <h3
      className={`text-xs font-bold uppercase tracking-[0.18em] mb-3 ${light ? 'text-white/90' : 'text-[var(--gold)]'}`}
    >
      {children}
    </h3>
  )
}

export function CvExperienceItem({ item, contentLanguage }: { item: CvExperience; contentLanguage: string }) {
  const t = useTranslations('kumaniCv')
  const dateRange = `${formatCvDate(item.startDate, contentLanguage)} — ${item.current ? t('present') : formatCvDate(item.endDate, contentLanguage)}`
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="font-semibold text-[var(--ink)] text-sm">{item.role}</p>
        <p className="text-xs text-gray-400 whitespace-nowrap">{dateRange}</p>
      </div>
      <p className="text-xs text-[var(--gold)] font-medium">{[item.company, item.location].filter(Boolean).join(' · ')}</p>
      <CvDescription text={item.description} className="text-xs text-gray-600 leading-5 mt-1" />
    </div>
  )
}

export function CvEducationItem({ item, contentLanguage }: { item: CvEducation; contentLanguage: string }) {
  const t = useTranslations('kumaniCv')
  const dateRange = `${formatCvDate(item.startDate, contentLanguage)} — ${item.current ? t('present') : formatCvDate(item.endDate, contentLanguage)}`
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="font-semibold text-[var(--ink)] text-sm">{[item.degree, item.field].filter(Boolean).join(' — ')}</p>
        <p className="text-xs text-gray-400 whitespace-nowrap">{dateRange}</p>
      </div>
      <p className="text-xs text-[var(--gold)] font-medium">{item.institution}</p>
    </div>
  )
}

export function CvSkillBar({ item, light }: { item: CvSkill; light?: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className={`text-xs ${light ? 'text-white/90' : 'text-[var(--ink)]'}`}>{item.name}</p>
      <div className="flex gap-1 shrink-0">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-1.5 w-1.5 rounded-full ${
              n <= item.level ? 'bg-[var(--gold)]' : light ? 'bg-white/25' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export function CvLanguageItem({ item, light, contentLanguage = 'it' }: { item: CvLanguage; light?: boolean; contentLanguage?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className={`text-xs ${light ? 'text-white/90' : 'text-[var(--ink)]'}`}>{item.name}</p>
      <span className={`text-[10px] font-bold ${light ? 'text-white/70' : 'text-gray-400'}`}>{item.native ? getCvLabels(contentLanguage).motherTongue : item.level}</span>
    </div>
  )
}

export function CvCertificationItem({ item, contentLanguage, light }: { item: CvCertification; contentLanguage: string; light?: boolean }) {
  return (
    <div className="mb-2">
      <p className={`text-xs font-medium ${light ? 'text-white/90' : 'text-[var(--ink)]'}`}>{item.name}</p>
      <p className={`text-[10px] ${light ? 'text-white/60' : 'text-gray-400'}`}>
        {[item.issuer, item.date ? formatCvDate(item.date, contentLanguage) : null].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}

export function CvLinkItem({ item, light }: { item: CvLink; light?: boolean }) {
  return (
    <a
      href={normalizeExternalUrl(item.url)}
      target="_blank"
      rel="noopener noreferrer"
      className={`block text-xs mb-1.5 truncate hover:underline ${light ? 'text-white/90' : 'text-[var(--gold)]'}`}
    >
      {item.label || item.url}
    </a>
  )
}

// Dati dello standard europeo (nascita, nazionalità, patente, competenze
// digitali, interessi) e frase privacy, per i 3 modelli più vecchi
export function CvExtrasBlock({ cv, light }: { cv: CvTemplateData; light?: boolean }) {
  const { L, personal } = cvContext(cv)
  const digital = splitList(cv.extras?.digitalSkills)
  const interests = splitList(cv.extras?.interests)
  const text = light ? 'text-white/90' : 'text-[var(--ink)]'
  const muted = light ? 'text-white/60' : 'text-gray-400'
  if (!personal.length && !digital.length && !interests.length) return null
  return (
    <div className="space-y-5">
      {personal.length > 0 && (
        <div>
          <CvSectionHeading light={light}>{L.personalShort}</CvSectionHeading>
          {personal.map((p) => (
            <p key={p.label} className={`text-xs mb-1 ${text}`}>
              <span className={muted}>{p.label}: </span>
              {p.value}
            </p>
          ))}
        </div>
      )}
      {digital.length > 0 && (
        <div>
          <CvSectionHeading light={light}>{L.digitalSkills}</CvSectionHeading>
          <p className={`text-xs leading-5 ${text}`}>{digital.join(' · ')}</p>
        </div>
      )}
      {interests.length > 0 && (
        <div>
          <CvSectionHeading light={light}>{L.interests}</CvSectionHeading>
          <p className={`text-xs leading-5 ${text}`}>{interests.join(', ')}</p>
        </div>
      )}
    </div>
  )
}

export { CvPrivacyNote }
