'use client'

import { useTranslations } from 'next-intl'
import type { CvTemplateData } from './cvTemplateTypes'
import {
  CvSectionHeading,
  CvExperienceItem,
  CvEducationItem,
  CvSkillBar,
  CvLanguageItem,
  CvCertificationItem,
  CvLinkItem,
  CvExtrasBlock,
  CvPrivacyNote,
} from './CvSectionParts'
import { byMostRecent } from '@/lib/cv'

// Institutional, centered header with a serif feel and a horizontal rule.
export default function CvTemplateClassic({ cv }: { cv: CvTemplateData }) {
  const t = useTranslations('kumaniCv')

  return (
    <div className="@container bg-white p-8 @md:p-10 text-[var(--ink)] font-serif">
      <div className="flex flex-col items-center text-center mb-6">
        {cv.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cv.photoUrl} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-[var(--gold)] mb-3" />
        )}
        <h1 className="text-2xl font-bold tracking-wide">{cv.fullName || t('previewPlaceholderName')}</h1>
        {cv.roleTitle && <p className="text-sm text-[var(--gold)] mt-1">{cv.roleTitle}</p>}
        <p className="text-xs text-gray-500 mt-2">{[cv.email, cv.phone, cv.location].filter(Boolean).join('   ·   ')}</p>
        <div className="w-16 h-px bg-[var(--gold)] mt-4" />
      </div>

      {cv.summary && <p className="text-sm text-gray-700 leading-6 mb-6 text-center">{cv.summary}</p>}

      {cv.experiences.length > 0 && (
        <div className="mb-6">
          <CvSectionHeading>{t('experienceSection')}</CvSectionHeading>
          {byMostRecent(cv.experiences).map((exp, i) => (
            <CvExperienceItem key={i} item={exp} contentLanguage={cv.contentLanguage} />
          ))}
        </div>
      )}

      {cv.education.length > 0 && (
        <div className="mb-6">
          <CvSectionHeading>{t('educationSection')}</CvSectionHeading>
          {byMostRecent(cv.education).map((ed, i) => (
            <CvEducationItem key={i} item={ed} contentLanguage={cv.contentLanguage} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 @md:grid-cols-2 gap-6">
        {cv.skills.length > 0 && (
          <div>
            <CvSectionHeading>{t('skillsSection')}</CvSectionHeading>
            {cv.skills.map((s, i) => (
              <CvSkillBar key={i} item={s} />
            ))}
          </div>
        )}
        {cv.languages.length > 0 && (
          <div>
            <CvSectionHeading>{t('languagesSection')}</CvSectionHeading>
            {cv.languages.map((l, i) => (
              <CvLanguageItem key={i} item={l} contentLanguage={cv.contentLanguage} />
            ))}
          </div>
        )}
        {cv.certifications.length > 0 && (
          <div>
            <CvSectionHeading>{t('certificationsSection')}</CvSectionHeading>
            {cv.certifications.map((c, i) => (
              <CvCertificationItem key={i} item={c} contentLanguage={cv.contentLanguage} />
            ))}
          </div>
        )}
        {cv.links.length > 0 && (
          <div>
            <CvSectionHeading>{t('linksSection')}</CvSectionHeading>
            {cv.links.map((l, i) => (
              <CvLinkItem key={i} item={l} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <CvExtrasBlock cv={cv} />
      </div>
      <CvPrivacyNote cv={cv} className="mt-6" />
    </div>
  )
}
