'use client'

import { formatCvDate } from '@/lib/cv'
import { normalizeExternalUrl } from '@/lib/linkUtils'
import type { CvTemplateData } from './cvTemplateTypes'
import { Breakable, CvDateRange, CvDescription, CvName, CvPrivacyNote, cvContext, languageLevel, splitList } from './cvShared'

// Elegante: mestiere in piccolo sopra il nome con le grazie, linee sottili,
// toni grigi. Colonna stretta a sinistra separata da una riga verticale.

const serif = { fontFamily: "'KumaniCvSerif', Georgia, 'Times New Roman', serif" }

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.2em] text-gray-700">{children}</h3>
}

export default function CvTemplateElegante({ cv }: { cv: CvTemplateData }) {
  const { L, experiences, education, personal } = cvContext(cv)
  const digital = splitList(cv.extras?.digitalSkills)
  const interests = splitList(cv.extras?.interests)

  return (
    <div className="@container bg-[#fbfbfa] text-gray-700 p-6 @md:p-10 font-sans">
      <header className="flex items-center justify-between gap-6 pb-6 border-b border-gray-300">
        <div className="@container min-w-0 flex-1">
          {cv.roleTitle && <p className="mb-2 text-[12px] uppercase tracking-[0.3em] text-gray-500">{cv.roleTitle}</p>}
          <CvName name={cv.fullName} maxRem={3} em={0.7} oneLineMax={0} maxLines={3} style={serif} className="uppercase leading-[1.05] tracking-wide text-gray-800" />
        </div>
        {cv.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cv.photoUrl} alt="" className="h-24 w-24 @md:h-28 @md:w-28 shrink-0 rounded-full object-cover object-[50%_22%] grayscale-[15%]" />
        )}
      </header>

      <div className="grid grid-cols-1 @md:grid-cols-[32%_minmax(0,1fr)] text-[13px]">
        <aside className="space-y-7 py-6 @md:pr-6 @md:border-r border-gray-300">
          {(cv.email || cv.phone || cv.location || cv.links.length > 0) && (
            <section>
              <Heading>{L.contact}</Heading>
              <ul className="space-y-1.5">
                {cv.email && <li className="break-words"><Breakable text={cv.email} /></li>}
                {cv.phone && <li>{cv.phone}</li>}
                {cv.location && <li>{cv.location}</li>}
                {cv.links.map((l, i) => (
                  <li key={i}>
                    <a href={normalizeExternalUrl(l.url)} target="_blank" rel="noopener noreferrer" className="break-words underline decoration-gray-300">
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
                    <dt className="text-[11px] text-gray-400">{p.label}</dt>
                    <dd>{p.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {cv.skills.length > 0 && (
            <section>
              <Heading>{L.skills}</Heading>
              <ul className="space-y-1">
                {cv.skills.map((s, i) => (
                  <li key={i} className="pl-3.5 -indent-3.5 before:content-['–'] before:mr-2 before:text-gray-400">{s.name}</li>
                ))}
              </ul>
            </section>
          )}

          {cv.languages.length > 0 && (
            <section>
              <Heading>{L.languagesShort}</Heading>
              <ul className="space-y-1">
                {cv.languages.map((l, i) => (
                  <li key={i}>
                    {l.name} <span className="text-gray-400">| {languageLevel(l, L)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {digital.length > 0 && (
            <section>
              <Heading>{L.digitalSkills}</Heading>
              <ul className="space-y-1">
                {digital.map((d, i) => (
                  <li key={i} className="pl-3.5 -indent-3.5 before:content-['–'] before:mr-2 before:text-gray-400">{d}</li>
                ))}
              </ul>
            </section>
          )}

          {interests.length > 0 && (
            <section>
              <Heading>{L.interests}</Heading>
              <p>{interests.join(', ')}</p>
            </section>
          )}
        </aside>

        <main className="space-y-7 py-6 @md:pl-6 min-w-0">
          {cv.summary && (
            <section className="pb-6 border-b border-gray-300">
              <Heading>{L.profile}</Heading>
              <p className="leading-6 whitespace-pre-wrap">{cv.summary}</p>
            </section>
          )}

          {experiences.length > 0 && (
            <section className="pb-6 border-b border-gray-300">
              <Heading>{L.experience}</Heading>
              <div className="space-y-5">
                {experiences.map((exp, i) => (
                  <div key={i}>
                    <p className="font-bold uppercase tracking-wide text-gray-800">{exp.role}</p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">{[exp.company, exp.location].filter(Boolean).join(', ')}</span>
                      {(exp.company || exp.location) && ' | '}
                      <CvDateRange item={exp} L={L} locale={cv.contentLanguage} />
                    </p>
                    <CvDescription text={exp.description} className="mt-1.5 leading-5 text-gray-600" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {education.length > 0 && (
            <section>
              <Heading>{L.educationShort}</Heading>
              <div className="space-y-3">
                {education.map((ed, i) => (
                  <div key={i}>
                    <p className="font-bold uppercase tracking-wide text-gray-800">{[ed.degree, ed.field].filter(Boolean).join(' – ')}</p>
                    <p className="text-gray-500">
                      <span className="font-semibold text-gray-700">{ed.institution}</span>
                      {ed.institution && ' | '}
                      <CvDateRange item={ed} L={L} locale={cv.contentLanguage} />
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {cv.certifications.length > 0 && (
            <section>
              <Heading>{L.certifications}</Heading>
              <ul className="space-y-1.5">
                {cv.certifications.map((c, i) => (
                  <li key={i}>
                    <span className="font-semibold text-gray-800">{c.name}</span>
                    {(c.issuer || c.date) && <span className="text-gray-500"> | {[c.issuer, formatCvDate(c.date, cv.contentLanguage)].filter(Boolean).join(', ')}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>
      </div>

      <CvPrivacyNote cv={cv} className="pt-4 border-t border-gray-300" />
    </div>
  )
}
