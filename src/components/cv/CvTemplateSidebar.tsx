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

// Two-column: dark colored sidebar (photo/contact/skills/languages), main
// content (summary/experience/education) on the right.
export default function CvTemplateSidebar({ cv }: { cv: CvTemplateData }) {
  const t = useTranslations('kumaniCv')

  return (
    <div className="@container bg-white text-[var(--ink)] flex flex-col @md:flex-row min-h-full">
      <aside className="@md:w-[220px] shrink-0 bg-[var(--ink)] text-white p-6">
        {cv.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cv.photoUrl} alt="" className="w-20 h-20 rounded-xl object-cover mb-4" />
        )}
        <div className="mb-6 space-y-1">
          {cv.email && <p className="text-xs text-white/80 break-all">{cv.email}</p>}
          {cv.phone && <p className="text-xs text-white/80">{cv.phone}</p>}
          {cv.location && <p className="text-xs text-white/80">{cv.location}</p>}
        </div>

        {cv.skills.length > 0 && (
          <div className="mb-6">
            <CvSectionHeading light>{t('skillsSection')}</CvSectionHeading>
            {cv.skills.map((s, i) => (
              <CvSkillBar key={i} item={s} light />
            ))}
          </div>
        )}
        {cv.languages.length > 0 && (
          <div className="mb-6">
            <CvSectionHeading light>{t('languagesSection')}</CvSectionHeading>
            {cv.languages.map((l, i) => (
              <CvLanguageItem key={i} item={l} light contentLanguage={cv.contentLanguage} />
            ))}
          </div>
        )}
        {cv.certifications.length > 0 && (
          <div className="mb-6">
            <CvSectionHeading light>{t('certificationsSection')}</CvSectionHeading>
            {cv.certifications.map((c, i) => (
              <CvCertificationItem key={i} item={c} contentLanguage={cv.contentLanguage} light />
            ))}
          </div>
        )}
        {cv.links.length > 0 && (
          <div>
            <CvSectionHeading light>{t('linksSection')}</CvSectionHeading>
            {cv.links.map((l, i) => (
              <CvLinkItem key={i} item={l} light />
            ))}
          </div>
        )}
        <div className="mt-6">
          <CvExtrasBlock cv={cv} light />
        </div>
      </aside>

      <div className="flex-1 min-w-0 p-6 @md:p-8">
        <h1 className="text-2xl font-bold break-words">{cv.fullName || t('previewPlaceholderName')}</h1>
        {cv.roleTitle && <p className="text-sm font-medium text-[var(--gold)] mt-1">{cv.roleTitle}</p>}
        {cv.summary && <p className="text-sm text-gray-700 leading-6 mt-4 mb-6">{cv.summary}</p>}

        {cv.experiences.length > 0 && (
          <div className="mb-6">
            <CvSectionHeading>{t('experienceSection')}</CvSectionHeading>
            {byMostRecent(cv.experiences).map((exp, i) => (
              <CvExperienceItem key={i} item={exp} contentLanguage={cv.contentLanguage} />
            ))}
          </div>
        )}

        {cv.education.length > 0 && (
          <div>
            <CvSectionHeading>{t('educationSection')}</CvSectionHeading>
            {byMostRecent(cv.education).map((ed, i) => (
              <CvEducationItem key={i} item={ed} contentLanguage={cv.contentLanguage} />
            ))}
          </div>
        )}
        <CvPrivacyNote cv={cv} className="mt-6" />
      </div>
    </div>
  )
}
