'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle, LoaderCircle, XCircle, Plus, Trash2, ImagePlus, Eye, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createCv, updateCv } from '@/app/actions/cv'
import { useFromDashboardSuffix } from '@/lib/useFromDashboard'
import { locales } from '../../i18n'
import {
  CEFR_LEVELS,
  SKILL_LEVELS,
  emptyExperience,
  emptyEducation,
  emptySkill,
  emptyLanguage,
  emptyCertification,
  emptyLink,
  validateCvPhotoFile,
  cvPhotoExtension,
  type CvFormData,
} from '@/lib/cv'
import CvTemplatePicker from '@/components/cv/CvTemplatePicker'
import CvTemplateRenderer from '@/components/cv/CvTemplateRenderer'
import MonthYearPicker from '@/components/cv/MonthYearPicker'

const LOCALE_NAMES: Record<string, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  ru: 'Русский',
}

type Props = {
  mode: 'create' | 'edit'
  cvId?: string
  initialData?: CvFormData
  initialPhotoUrl?: string | null
}

function defaultForm(): CvFormData {
  return {
    title: '',
    template: 'minimal',
    contentLanguage: 'it',
    fullName: '',
    roleTitle: '',
    summary: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    experiences: [emptyExperience()],
    education: [emptyEducation()],
    skills: [emptySkill()],
    languages: [emptyLanguage()],
    certifications: [],
  }
}

const inputClass =
  'w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm bg-white'
const labelClass = 'block text-sm font-medium text-[var(--ink)] mb-1'

export default function CvForm({ mode, cvId, initialData, initialPhotoUrl }: Props) {
  const t = useTranslations('kumaniCv')
  const router = useRouter()
  const supabase = createClient()
  const fromDashboardSuffix = useFromDashboardSuffix()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<CvFormData>(initialData || defaultForm())
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl || null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = form.title.trim().length > 0 && form.fullName.trim().length > 0

  const handlePhotoSelect = async (file: File) => {
    const validationError = validateCvPhotoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setUploadingPhoto(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUploadingPhoto(false)
      return
    }
    const path = `${user.id}/${cvId || 'new'}-${Date.now()}.${cvPhotoExtension(file)}`
    const { error: uploadError } = await supabase.storage.from('cv-photos').upload(path, file, { upsert: true })
    setUploadingPhoto(false)
    if (uploadError) {
      console.error('[Cv] photo upload failed:', uploadError)
      setError('photoUploadError')
      return
    }
    setPhotoPath(path)
    setPhotoUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const cleaned: CvFormData = {
        ...form,
        experiences: form.experiences.filter((e) => e.company.trim() || e.role.trim()),
        education: form.education.filter((e) => e.institution.trim() || e.degree.trim()),
        skills: form.skills.filter((s) => s.name.trim()),
        languages: form.languages.filter((l) => l.name.trim()),
        certifications: form.certifications.filter((c) => c.name.trim()),
        links: form.links.filter((l) => l.url.trim()),
      }
      if (mode === 'create') {
        const result = await createCv(cleaned, photoPath)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push(`/marketplace/kumani-cv/${result.data.id}${fromDashboardSuffix}`)
      } else {
        const result = await updateCv(cvId!, cleaned, photoPath)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push(`/marketplace/kumani-cv/${cvId}${fromDashboardSuffix}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const previewData = {
    fullName: form.fullName,
    roleTitle: form.roleTitle,
    summary: form.summary,
    email: form.email,
    phone: form.phone,
    location: form.location,
    photoUrl,
    links: form.links,
    experiences: form.experiences,
    education: form.education,
    skills: form.skills,
    languages: form.languages,
    certifications: form.certifications,
    contentLanguage: form.contentLanguage,
  }

  const editorPane = (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 space-y-8">
      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>{t('cvTitleField')}</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder={t('cvTitlePlaceholder')}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>{t('contentLanguageField')}</label>
          <select
            value={form.contentLanguage}
            onChange={(e) => setForm((p) => ({ ...p, contentLanguage: e.target.value }))}
            className={inputClass}
          >
            {locales.map((loc) => (
              <option key={loc} value={loc}>
                {LOCALE_NAMES[loc] || loc}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>{t('templateField')}</label>
        <CvTemplatePicker value={form.template} onChange={(template) => setForm((p) => ({ ...p, template }))} />
      </div>

      {/* Photo */}
      <div className="flex items-center gap-4">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--gold)]/40 flex items-center justify-center cursor-pointer hover:border-[var(--gold)] transition-all overflow-hidden bg-[var(--paper)] shrink-0"
        >
          {uploadingPhoto ? (
            <LoaderCircle className="w-5 h-5 text-[var(--gold)] animate-spin" />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImagePlus className="w-6 h-6 text-[var(--gold)]" />
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handlePhotoSelect(file)
              e.target.value = ''
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-[var(--gold)] hover:underline">
            {photoUrl ? t('changePhoto') : t('addPhoto')}
          </button>
          <p className="text-xs text-[var(--muted)] mt-1">{t('photoFormatHint')}</p>
        </div>
      </div>

      {/* Personal / role / summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>{t('fullNameField')}</label>
          <input type="text" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('roleTitleField')}</label>
          <input type="text" value={form.roleTitle} onChange={(e) => setForm((p) => ({ ...p, roleTitle: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('emailField')}</label>
          <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{t('phoneField')}</label>
          <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>{t('locationField')}</label>
          <input type="text" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>{t('summaryField')}</label>
          <textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} rows={3} className={inputClass} />
        </div>
      </div>

      {/* Experiences */}
      <div className="border-t border-[var(--gold)]/15 pt-6">
        <h3 className="font-bold text-[var(--ink)] mb-4">{t('experienceSection')}</h3>
        <div className="space-y-5">
          {form.experiences.map((exp, i) => (
            <div key={i} className="p-4 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => setForm((p) => ({ ...p, experiences: p.experiences.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder={t('roleField')} value={exp.role} onChange={(e) => setForm((p) => ({ ...p, experiences: p.experiences.map((x, idx) => (idx === i ? { ...x, role: e.target.value } : x)) }))} className={inputClass} />
                <input placeholder={t('companyField')} value={exp.company} onChange={(e) => setForm((p) => ({ ...p, experiences: p.experiences.map((x, idx) => (idx === i ? { ...x, company: e.target.value } : x)) }))} className={inputClass} />
                <input placeholder={t('locationField')} value={exp.location} onChange={(e) => setForm((p) => ({ ...p, experiences: p.experiences.map((x, idx) => (idx === i ? { ...x, location: e.target.value } : x)) }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">{t('startDateField')}</p>
                  <MonthYearPicker value={exp.startDate} onChange={(v) => setForm((p) => ({ ...p, experiences: p.experiences.map((x, idx) => (idx === i ? { ...x, startDate: v } : x)) }))} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">{t('endDateField')}</p>
                  <MonthYearPicker
                    value={exp.endDate}
                    disabled={exp.current}
                    onChange={(v) => setForm((p) => ({ ...p, experiences: p.experiences.map((x, idx) => (idx === i ? { ...x, endDate: v } : x)) }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={exp.current} onChange={(e) => setForm((p) => ({ ...p, experiences: p.experiences.map((x, idx) => (idx === i ? { ...x, current: e.target.checked } : x)) }))} className="rounded text-[var(--gold)] accent-[var(--gold)]" />
                {t('currentField')}
              </label>
              <textarea placeholder={t('descriptionField')} value={exp.description} onChange={(e) => setForm((p) => ({ ...p, experiences: p.experiences.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)) }))} rows={2} className={inputClass} />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setForm((p) => ({ ...p, experiences: [...p.experiences, emptyExperience()] }))} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
          <Plus className="w-4 h-4" /> {t('addExperienceAction')}
        </button>
      </div>

      {/* Education */}
      <div className="border-t border-[var(--gold)]/15 pt-6">
        <h3 className="font-bold text-[var(--ink)] mb-4">{t('educationSection')}</h3>
        <div className="space-y-5">
          {form.education.map((ed, i) => (
            <div key={i} className="p-4 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => setForm((p) => ({ ...p, education: p.education.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder={t('degreeField')} value={ed.degree} onChange={(e) => setForm((p) => ({ ...p, education: p.education.map((x, idx) => (idx === i ? { ...x, degree: e.target.value } : x)) }))} className={inputClass} />
                <input placeholder={t('fieldOfStudyField')} value={ed.field} onChange={(e) => setForm((p) => ({ ...p, education: p.education.map((x, idx) => (idx === i ? { ...x, field: e.target.value } : x)) }))} className={inputClass} />
                <input placeholder={t('institutionField')} value={ed.institution} onChange={(e) => setForm((p) => ({ ...p, education: p.education.map((x, idx) => (idx === i ? { ...x, institution: e.target.value } : x)) }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">{t('startDateField')}</p>
                  <MonthYearPicker value={ed.startDate} onChange={(v) => setForm((p) => ({ ...p, education: p.education.map((x, idx) => (idx === i ? { ...x, startDate: v } : x)) }))} />
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--muted)] mb-1">{t('endDateField')}</p>
                  <MonthYearPicker
                    value={ed.endDate}
                    disabled={ed.current}
                    onChange={(v) => setForm((p) => ({ ...p, education: p.education.map((x, idx) => (idx === i ? { ...x, endDate: v } : x)) }))}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <input type="checkbox" checked={ed.current} onChange={(e) => setForm((p) => ({ ...p, education: p.education.map((x, idx) => (idx === i ? { ...x, current: e.target.checked } : x)) }))} className="rounded text-[var(--gold)] accent-[var(--gold)]" />
                {t('currentField')}
              </label>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setForm((p) => ({ ...p, education: [...p.education, emptyEducation()] }))} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
          <Plus className="w-4 h-4" /> {t('addEducationAction')}
        </button>
      </div>

      {/* Skills */}
      <div className="border-t border-[var(--gold)]/15 pt-6">
        <h3 className="font-bold text-[var(--ink)] mb-4">{t('skillsSection')}</h3>
        <div className="space-y-3">
          {form.skills.map((s, i) => (
            <div key={i} className="p-4 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => setForm((p) => ({ ...p, skills: p.skills.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder={t('skillNamePlaceholder')} value={s.name} onChange={(e) => setForm((p) => ({ ...p, skills: p.skills.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)) }))} className={inputClass} />
                <select value={s.level} onChange={(e) => setForm((p) => ({ ...p, skills: p.skills.map((x, idx) => (idx === i ? { ...x, level: Number(e.target.value) as typeof x.level } : x)) }))} className={inputClass}>
                  {SKILL_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{t(`skillLevel_${lvl}`)}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setForm((p) => ({ ...p, skills: [...p.skills, emptySkill()] }))} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
          <Plus className="w-4 h-4" /> {t('addSkillAction')}
        </button>
      </div>

      {/* Languages */}
      <div className="border-t border-[var(--gold)]/15 pt-6">
        <h3 className="font-bold text-[var(--ink)] mb-4">{t('languagesSection')}</h3>
        <div className="space-y-3">
          {form.languages.map((l, i) => (
            <div key={i} className="p-4 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => setForm((p) => ({ ...p, languages: p.languages.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder={t('languageNamePlaceholder')} value={l.name} onChange={(e) => setForm((p) => ({ ...p, languages: p.languages.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)) }))} className={inputClass} />
                <select value={l.level} onChange={(e) => setForm((p) => ({ ...p, languages: p.languages.map((x, idx) => (idx === i ? { ...x, level: e.target.value as typeof x.level } : x)) }))} className={inputClass}>
                  {CEFR_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setForm((p) => ({ ...p, languages: [...p.languages, emptyLanguage()] }))} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
          <Plus className="w-4 h-4" /> {t('addLanguageAction')}
        </button>
      </div>

      {/* Certifications */}
      <div className="border-t border-[var(--gold)]/15 pt-6">
        <h3 className="font-bold text-[var(--ink)] mb-4">{t('certificationsSection')}</h3>
        <div className="space-y-3">
          {form.certifications.map((c, i) => (
            <div key={i} className="p-4 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => setForm((p) => ({ ...p, certifications: p.certifications.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder={t('certificationNamePlaceholder')} value={c.name} onChange={(e) => setForm((p) => ({ ...p, certifications: p.certifications.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)) }))} className={inputClass} />
                <input placeholder={t('issuerPlaceholder')} value={c.issuer} onChange={(e) => setForm((p) => ({ ...p, certifications: p.certifications.map((x, idx) => (idx === i ? { ...x, issuer: e.target.value } : x)) }))} className={inputClass} />
              </div>
              <div className="sm:w-1/2">
                <p className="text-xs font-medium text-[var(--muted)] mb-1">{t('certificationDateField')}</p>
                <MonthYearPicker value={c.date} onChange={(v) => setForm((p) => ({ ...p, certifications: p.certifications.map((x, idx) => (idx === i ? { ...x, date: v } : x)) }))} />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setForm((p) => ({ ...p, certifications: [...p.certifications, emptyCertification()] }))} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
          <Plus className="w-4 h-4" /> {t('addCertificationAction')}
        </button>
      </div>

      {/* Links */}
      <div className="border-t border-[var(--gold)]/15 pt-6">
        <h3 className="font-bold text-[var(--ink)] mb-4">{t('linksSection')}</h3>
        <div className="space-y-3">
          {form.links.map((l, i) => (
            <div key={i} className="p-4 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={() => setForm((p) => ({ ...p, links: p.links.filter((_, idx) => idx !== i) }))} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder={t('linkLabelPlaceholder')} value={l.label} onChange={(e) => setForm((p) => ({ ...p, links: p.links.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)) }))} className={inputClass} />
                <input placeholder="https://" value={l.url} onChange={(e) => setForm((p) => ({ ...p, links: p.links.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)) }))} className={inputClass} />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setForm((p) => ({ ...p, links: [...p.links, emptyLink()] }))} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[var(--gold)] hover:underline">
          <Plus className="w-4 h-4" /> {t('addLinkAction')}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          {t(error)}
        </div>
      )}

      <div className="flex gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        className="px-6 py-3 rounded-xl font-semibold text-sm border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all"
      >
        {t('cancelAction')}
      </button>
      <button
        onClick={handleSubmit}
        disabled={!isValid || saving}
        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
      >
        {saving ? (
          <>
            <LoaderCircle className="w-5 h-5 animate-spin" /> {t('saving')}
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" /> {mode === 'create' ? t('createCvAction') : t('saveChangesAction')}
          </>
        )}
      </button>
      </div>
    </div>
  )

  const previewPane = (
    <div className="bg-[var(--paper)] rounded-2xl border border-[var(--gold)]/25 shadow-sm overflow-hidden lg:sticky lg:top-24">
      <div className="max-h-[calc(100vh-6rem)] overflow-y-auto">
        <CvTemplateRenderer template={form.template} cv={previewData} />
      </div>
    </div>
  )

  return (
    <div>
      {/* Mobile toggle */}
      <div className="flex lg:hidden mb-4 rounded-xl border border-[var(--gold)]/30 overflow-hidden">
        <button type="button" onClick={() => setMobileView('edit')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${mobileView === 'edit' ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-white text-[var(--muted)]'}`}>
          <Pencil className="w-4 h-4" /> {t('editTab')}
        </button>
        <button type="button" onClick={() => setMobileView('preview')} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium ${mobileView === 'preview' ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-white text-[var(--muted)]'}`}>
          <Eye className="w-4 h-4" /> {t('previewTab')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={mobileView === 'edit' ? 'block' : 'hidden lg:block'}>{editorPane}</div>
        <div className={mobileView === 'preview' ? 'block' : 'hidden lg:block'}>{previewPane}</div>
      </div>
    </div>
  )
}
