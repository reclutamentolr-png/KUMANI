'use client'

import { Award, Briefcase, GraduationCap, Heart, Languages, Mail, MapPin, Monitor, Phone, Globe, Sparkles, User, UserRound } from 'lucide-react'
import { formatCvDate } from '@/lib/cv'
import { normalizeExternalUrl } from '@/lib/linkUtils'
import type { CvTemplateData } from './cvTemplateTypes'
import { Breakable, CvDateRange, CvDescription, CvName, CvPrivacyNote, cvContext, languageLevel, splitList } from './cvShared'

// Professionale: colonna blu notte con contatti, studi, competenze e lingue;
// a destra profilo ed esperienze su una linea del tempo. Titoli con icona.

type Icon = typeof Briefcase

function SideHeading({ icon: I, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-sky-200 leading-tight">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
        <I className="h-3.5 w-3.5 text-white" />
      </span>
      {children}
    </h3>
  )
}

function MainHeading({ icon: I, children }: { icon: Icon; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 mb-4 text-[15px] font-bold uppercase tracking-[0.08em] text-[#0f2a4a]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100">
        <I className="h-4 w-4 text-[#0f2a4a]" />
      </span>
      <span className="shrink-0">{children}</span>
      <span className="h-px flex-1 bg-sky-200" />
    </h3>
  )
}

export default function CvTemplateProfessionale({ cv }: { cv: CvTemplateData }) {
  const { L, experiences, education, personal } = cvContext(cv)
  const digital = splitList(cv.extras?.digitalSkills)
  const interests = splitList(cv.extras?.interests)

  return (
    <div className="@container"><div className="bg-white text-gray-800 flex flex-col @md:flex-row min-h-full font-sans">
      <aside className="@md:w-[38%] shrink-0 bg-[#0f2a4a] text-white/90 p-6 @md:p-7 space-y-7 text-[13px]">
        <div>
          {cv.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cv.photoUrl} alt="" className="mb-4 h-28 w-28 rounded-full object-cover object-[50%_22%] ring-4 ring-white/15" />
          )}
          <div className="@container">
            <CvName name={cv.fullName} maxRem={1.6} em={0.7} oneLineMax={0} maxLines={3} className="font-extrabold uppercase leading-[1.15] tracking-wide text-white" />
          </div>
          {cv.roleTitle && <p className="mt-1 text-sky-200">{cv.roleTitle}</p>}
          <div className="mt-4 h-px bg-white/20" />
          <ul className="mt-4 space-y-2">
            {cv.location && (
              <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-sky-200" />{cv.location}</li>
            )}
            {cv.phone && (
              <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-sky-200" />{cv.phone}</li>
            )}
            {cv.email && (
              <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-sky-200" /><span className="break-words"><Breakable text={cv.email} /></span></li>
            )}
            {cv.links.map((l, i) => (
              <li key={i} className="flex gap-2">
                <Globe className="h-4 w-4 shrink-0 text-sky-200" />
                <a href={normalizeExternalUrl(l.url)} target="_blank" rel="noopener noreferrer" className="break-words hover:underline">
                  <Breakable text={l.label || l.url} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {personal.length > 0 && (
          <section>
            <SideHeading icon={UserRound}>{L.personalShort}</SideHeading>
            <dl className="space-y-1.5">
              {personal.map((p) => (
                <div key={p.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-sky-200/80">{p.label}</dt>
                  <dd className="text-white">{p.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {education.length > 0 && (
          <section>
            <SideHeading icon={GraduationCap}>{L.educationShort}</SideHeading>
            <div className="space-y-3">
              {education.map((ed, i) => (
                <div key={i}>
                  <p className="text-[12px] text-sky-200"><CvDateRange item={ed} L={L} locale={cv.contentLanguage} /></p>
                  <p className="font-bold text-white">{[ed.degree, ed.field].filter(Boolean).join(' – ')}</p>
                  {ed.institution && <p>{ed.institution}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {cv.skills.length > 0 && (
          <section>
            <SideHeading icon={Sparkles}>{L.skills}</SideHeading>
            <ul className="space-y-2">
              {cv.skills.map((s, i) => (
                <li key={i}>
                  <p>{s.name}</p>
                  <div className="mt-1 h-1 rounded-full bg-white/15">
                    <div className="h-1 rounded-full bg-sky-300" style={{ width: `${s.level * 25}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cv.languages.length > 0 && (
          <section>
            <SideHeading icon={Languages}>{L.languagesShort}</SideHeading>
            <ul className="space-y-1">
              {cv.languages.map((l, i) => (
                <li key={i}>
                  <span className="font-bold text-white">{l.name}</span> – {languageLevel(l, L)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>

      <main className="flex-1 min-w-0 p-6 @md:p-8 space-y-7 text-[13px]">
        {cv.summary && (
          <section>
            <MainHeading icon={User}>{L.profile}</MainHeading>
            <p className="leading-6 whitespace-pre-wrap">{cv.summary}</p>
          </section>
        )}

        {experiences.length > 0 && (
          <section>
            <MainHeading icon={Briefcase}>{L.experience}</MainHeading>
            <div className="relative ml-1 border-l-2 border-sky-200 pl-5 space-y-5">
              {experiences.map((exp, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-[#2f6fb3] ring-4 ring-white" />
                  <p className="font-bold uppercase tracking-wide text-[#0f2a4a]">
                    {exp.role}
                    {exp.company && <span> – {exp.company}</span>}
                    {exp.location && <span className="font-semibold"> ({exp.location})</span>}
                  </p>
                  <p className="text-[12px] text-gray-500"><CvDateRange item={exp} L={L} locale={cv.contentLanguage} /></p>
                  <CvDescription text={exp.description} className="mt-1 leading-5" />
                </div>
              ))}
            </div>
          </section>
        )}

        {cv.certifications.length > 0 && (
          <section>
            <MainHeading icon={Award}>{L.certifications}</MainHeading>
            <ul className="space-y-1.5">
              {cv.certifications.map((c, i) => (
                <li key={i}>
                  <span className="font-semibold text-[#0f2a4a]">{c.name}</span>
                  {(c.issuer || c.date) && (
                    <span className="text-gray-500"> · {[c.issuer, formatCvDate(c.date, cv.contentLanguage)].filter(Boolean).join(' · ')}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {digital.length > 0 && (
          <section>
            <MainHeading icon={Monitor}>{L.digitalSkills}</MainHeading>
            <ul className="list-disc pl-4 space-y-1">
              {digital.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>
        )}

        {interests.length > 0 && (
          <section>
            <MainHeading icon={Heart}>{L.interests}</MainHeading>
            <p>{interests.join(' · ')}</p>
          </section>
        )}

        <CvPrivacyNote cv={cv} className="pt-2" />
      </main>
    </div>
    </div>
  )
}
