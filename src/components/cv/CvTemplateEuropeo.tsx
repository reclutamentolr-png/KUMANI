'use client'

import { CEFR_SKILLS, cefrFor, formatCvDate } from '@/lib/cv'
import { normalizeExternalUrl } from '@/lib/linkUtils'
import type { CvTemplateData } from './cvTemplateTypes'
import { Breakable, CvDateRange, CvDescription, CvName, CvPrivacyNote, cvContext, splitList } from './cvShared'

// Formato europeo: la struttura del CV Europass. Etichette e date in una
// colonna a sinistra, contenuto a destra, tabella delle lingue con i livelli
// del Quadro comune europeo per ascolto, lettura, interazione, produzione
// orale e scrittura. Non è il documento ufficiale Europass e non ne usa il logo.

const BLUE = '#1d4f91'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="shrink-0 text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: BLUE }}>{title}</h3>
        <span className="h-px flex-1" style={{ background: BLUE, opacity: 0.35 }} />
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 @md:grid-cols-[30%_minmax(0,1fr)] gap-x-5 gap-y-0.5">
      <div className="text-[12px] text-gray-500 @md:text-right">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export default function CvTemplateEuropeo({ cv }: { cv: CvTemplateData }) {
  const { L, experiences, education, native, foreign, personal } = cvContext(cv)
  const digital = splitList(cv.extras?.digitalSkills)
  const interests = splitList(cv.extras?.interests)
  const licence = cv.extras?.drivingLicence
  const personalNoLicence = personal.filter((p) => p.label !== L.drivingLicence)

  return (
    <div className="@container bg-white text-gray-800 p-6 @md:p-10 font-sans text-[13px]">
      <header className="flex items-start justify-between gap-6 border-b-2 pb-5" style={{ borderColor: BLUE }}>
        <div className="@container min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{L.europeanFormat}</p>
          <CvName name={cv.fullName} maxRem={1.875} em={0.62} oneLineMax={26} className="mt-1 font-bold text-gray-900 leading-tight" />
          {cv.roleTitle && <p className="mt-1 text-base" style={{ color: BLUE }}>{cv.roleTitle}</p>}
        </div>
        {cv.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cv.photoUrl} alt="" className="h-28 w-24 shrink-0 object-cover object-[50%_20%] rounded-sm" />
        )}
      </header>

      <Section title={L.personal}>
        {cv.location && <Row label={L.address}>{cv.location}</Row>}
        {cv.phone && <Row label={L.phone}>{cv.phone}</Row>}
        {cv.email && <Row label={L.email}><Breakable text={cv.email} /></Row>}
        {cv.links.map((l, i) => (
          <Row key={i} label={l.label || L.website}>
            <a href={normalizeExternalUrl(l.url)} target="_blank" rel="noopener noreferrer" className="break-words underline" style={{ color: BLUE }}>
              <Breakable text={l.url} />
            </a>
          </Row>
        ))}
        {personalNoLicence.map((p) => (
          <Row key={p.label} label={p.label}>{p.value}</Row>
        ))}
      </Section>

      {cv.summary && (
        <Section title={L.profile}>
          <Row label="">
            <p className="leading-6 whitespace-pre-wrap">{cv.summary}</p>
          </Row>
        </Section>
      )}

      {experiences.length > 0 && (
        <Section title={L.experience}>
          {experiences.map((exp, i) => (
            <Row key={i} label={<CvDateRange item={exp} L={L} locale={cv.contentLanguage} />}>
              <p className="font-bold text-gray-900">{exp.role}</p>
              <p className="text-gray-600">{[exp.company, exp.location].filter(Boolean).join(' – ')}</p>
              <CvDescription text={exp.description} className="mt-1 leading-5" />
            </Row>
          ))}
        </Section>
      )}

      {education.length > 0 && (
        <Section title={L.education}>
          {education.map((ed, i) => (
            <Row key={i} label={<CvDateRange item={ed} L={L} locale={cv.contentLanguage} />}>
              <p className="font-bold text-gray-900">{[ed.degree, ed.field].filter(Boolean).join(' – ')}</p>
              {ed.institution && <p className="text-gray-600">{ed.institution}</p>}
            </Row>
          ))}
        </Section>
      )}

      {cv.languages.length > 0 && (
        <Section title={L.languages}>
          {native.length > 0 && (
            <Row label={L.motherTongue}>
              <p className="font-semibold">{native.map((l) => l.name).join(', ')}</p>
            </Row>
          )}
          {foreign.length > 0 && (
            <Row label={L.otherLanguages}>
              <div>
                <table lang={cv.contentLanguage} className="w-full table-fixed border-collapse text-center text-[11px] leading-tight hyphens-auto">
                  <colgroup>
                    <col className="w-[24%]" />
                    <col span={5} />
                  </colgroup>
                  <thead>
                    <tr className="text-white" style={{ background: BLUE }}>
                      <th className="p-1.5" />
                      <th className="p-1.5 font-semibold" colSpan={2}>{L.understanding}</th>
                      <th className="p-1.5 font-semibold" colSpan={2}>{L.speaking}</th>
                      <th className="p-1.5 font-semibold">{L.writingGroup}</th>
                    </tr>
                    <tr className="bg-blue-50 text-gray-600">
                      <th className="p-1.5" />
                      {CEFR_SKILLS.map((k) => (
                        <th key={k} className="px-0.5 py-1.5 align-top text-[10px] font-medium [overflow-wrap:normal]">{L[k]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {foreign.map((l, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="p-1.5 text-left font-semibold">{l.name}</td>
                        {CEFR_SKILLS.map((k) => (
                          <td key={k} className="p-1.5">{cefrFor(l, k)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[10px] leading-4 text-gray-500">{L.cefrNote}</p>
            </Row>
          )}
        </Section>
      )}

      {digital.length > 0 && (
        <Section title={L.digitalSkills}>
          <Row label="">
            <p>{digital.join(' · ')}</p>
          </Row>
        </Section>
      )}

      {cv.skills.length > 0 && (
        <Section title={L.skills}>
          <Row label="">
            <ul className="list-disc pl-4 space-y-0.5">
              {cv.skills.map((s, i) => (
                <li key={i}>{s.name}</li>
              ))}
            </ul>
          </Row>
        </Section>
      )}

      {licence && (
        <Section title={L.drivingLicence}>
          <Row label="">{licence}</Row>
        </Section>
      )}

      {cv.certifications.length > 0 && (
        <Section title={L.certifications}>
          {cv.certifications.map((c, i) => (
            <Row key={i} label={formatCvDate(c.date, cv.contentLanguage)}>
              <p className="font-semibold">{c.name}</p>
              {c.issuer && <p className="text-gray-600">{c.issuer}</p>}
            </Row>
          ))}
        </Section>
      )}

      {interests.length > 0 && (
        <Section title={L.interests}>
          <Row label="">
            <p>{interests.join(', ')}</p>
          </Row>
        </Section>
      )}

      <CvPrivacyNote cv={cv} className="mt-8 pt-3 border-t border-gray-200" />
    </div>
  )
}
