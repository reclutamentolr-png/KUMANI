'use client'

import { Globe, Mail, MapPin, Phone } from 'lucide-react'
import { normalizeExternalUrl } from '@/lib/linkUtils'
import { formatCvDate } from '@/lib/cv'
import type { CvTemplateData } from './cvTemplateTypes'
import { Breakable, CvDateRange, CvDescription, CvName, CvPrivacyNote, cvContext, cvDateRange, languageLevel, splitList } from './cvShared'

// Moderno: nome grande e spaziato, foto rotonda, due colonne con linea del
// tempo per esperienze e studi. Neutro (nero e grigi), adatto a ogni settore.

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-bold uppercase tracking-[0.16em] text-gray-900 border-b border-gray-300 pb-1.5 mb-3">{children}</h3>
  )
}

function Timeline({ children }: { children: React.ReactNode }) {
  return <div className="relative border-l border-gray-300 ml-1 pl-4 space-y-4">{children}</div>
}

function Dot() {
  return <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-gray-900 bg-white" />
}

export default function CvTemplateModerno({ cv }: { cv: CvTemplateData }) {
  const { L, experiences, education, personal } = cvContext(cv)
  const digital = splitList(cv.extras?.digitalSkills)
  const interests = splitList(cv.extras?.interests)

  return (
    <div className="@container bg-white text-gray-800 p-6 @md:p-10 font-sans">
      <header className="flex items-center justify-between gap-6 mb-8">
        <div className="@container min-w-0 flex-1 border-l-4 border-gray-900 pl-4">
          <CvName name={cv.fullName} maxRem={2.25} em={0.84} oneLineMax={14} maxLines={3} className="font-extrabold uppercase tracking-[0.12em] text-gray-900 leading-[1.1]" />
          {cv.roleTitle && <p className="mt-1 text-base @md:text-lg uppercase tracking-[0.2em] text-gray-500">{cv.roleTitle}</p>}
        </div>
        {cv.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cv.photoUrl} alt="" className="h-24 w-24 @md:h-28 @md:w-28 shrink-0 rounded-full object-cover object-[50%_22%] object-[50%_22%] ring-4 ring-gray-100" />
        )}
      </header>

      <div className="grid grid-cols-1 @md:grid-cols-[34%_minmax(0,1fr)] gap-8">
        <aside className="space-y-7 text-[13px]">
          {(cv.phone || cv.email || cv.location || cv.links.length > 0) && (
            <section>
              <Heading>{L.contact}</Heading>
              <ul className="space-y-2">
                {cv.phone && (
                  <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-gray-500" /><span>{cv.phone}</span></li>
                )}
                {cv.email && (
                  <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-gray-500" /><span className="break-words"><Breakable text={cv.email} /></span></li>
                )}
                {cv.location && (
                  <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-gray-500" /><span>{cv.location}</span></li>
                )}
                {cv.links.map((l, i) => (
                  <li key={i} className="flex gap-2">
                    <Globe className="h-4 w-4 shrink-0 text-gray-500" />
                    <a href={normalizeExternalUrl(l.url)} target="_blank" rel="noopener noreferrer" className="break-words hover:underline">
                      <Breakable text={l.label || l.url} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {personal.length > 0 && (
            <section>
              <Heading>{L.personalShort}</Heading>
              <dl className="space-y-1.5">
                {personal.map((p) => (
                  <div key={p.label}>
                    <dt className="text-[11px] uppercase tracking-wide text-gray-500">{p.label}</dt>
                    <dd>{p.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {education.length > 0 && (
            <section>
              <Heading>{L.educationShort}</Heading>
              <Timeline>
                {education.map((ed, i) => (
                  <div key={i} className="relative">
                    <Dot />
                    <p className="font-semibold text-gray-900 uppercase text-[12px] tracking-wide">{[ed.degree, ed.field].filter(Boolean).join(' – ')}</p>
                    <p className="text-gray-500 text-[12px]"><CvDateRange item={ed} L={L} locale={cv.contentLanguage} /></p>
                    {ed.institution && <p>{ed.institution}</p>}
                  </div>
                ))}
              </Timeline>
            </section>
          )}

          {cv.skills.length > 0 && (
            <section>
              <Heading>{L.skills}</Heading>
              <ul className="list-disc pl-4 space-y-1">
                {cv.skills.map((s, i) => (
                  <li key={i}>{s.name}</li>
                ))}
              </ul>
            </section>
          )}

          {cv.languages.length > 0 && (
            <section>
              <Heading>{L.languagesShort}</Heading>
              <ul className="space-y-1">
                {cv.languages.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{l.name}</span>
                    <span className="text-gray-500">{languageLevel(l, L)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {interests.length > 0 && (
            <section>
              <Heading>{L.interests}</Heading>
              <p>{interests.join(' · ')}</p>
            </section>
          )}
        </aside>

        <main className="space-y-7 text-[13px] min-w-0">
          {cv.summary && (
            <section>
              <Heading>{L.profile}</Heading>
              <p className="leading-6 whitespace-pre-wrap">{cv.summary}</p>
            </section>
          )}

          {experiences.length > 0 && (
            <section>
              <Heading>{L.experience}</Heading>
              <Timeline>
                {experiences.map((exp, i) => (
                  <div key={i} className="relative">
                    <Dot />
                    <p className="font-bold text-gray-900 uppercase tracking-wide">
                      {[exp.role, exp.company].filter(Boolean).join(' – ')}
                    </p>
                    <p className="text-gray-500 text-[12px]">{[cvDateRange(exp, L, cv.contentLanguage), exp.location].filter(Boolean).join(' · ')}</p>
                    <CvDescription text={exp.description} className="mt-1 leading-5" />
                  </div>
                ))}
              </Timeline>
            </section>
          )}

          {cv.certifications.length > 0 && (
            <section>
              <Heading>{L.certifications}</Heading>
              <ul className="space-y-1.5">
                {cv.certifications.map((c, i) => (
                  <li key={i}>
                    <span className="font-semibold text-gray-900">{c.name}</span>
                    {(c.issuer || c.date) && <span className="text-gray-500"> · {[c.issuer, formatCvDate(c.date, cv.contentLanguage)].filter(Boolean).join(' · ')}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {digital.length > 0 && (
            <section>
              <Heading>{L.digitalSkills}</Heading>
              <ul className="list-disc pl-4 space-y-1">
                {digital.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>

      <CvPrivacyNote cv={cv} className="mt-8" />
    </div>
  )
}
