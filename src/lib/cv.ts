export const CV_TEMPLATES = ['minimal', 'classic', 'sidebar'] as const
export type CvTemplate = (typeof CV_TEMPLATES)[number]

export const SKILL_LEVELS = [1, 2, 3, 4] as const
export type SkillLevel = (typeof SKILL_LEVELS)[number]

// CEFR — the European standard (Europass) self-assessment scale for language proficiency.
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export interface CvLink {
  label: string
  url: string
}

export interface CvExperience {
  company: string
  role: string
  location: string
  startDate: string // ISO date (yyyy-mm) or full date
  endDate: string
  current: boolean
  description: string
}

export interface CvEducation {
  institution: string
  degree: string
  field: string
  startDate: string
  endDate: string
  current: boolean
}

export interface CvSkill {
  name: string
  level: SkillLevel
}

export interface CvLanguage {
  name: string
  level: CefrLevel
}

export interface CvCertification {
  name: string
  issuer: string
  date: string
}

export interface CvFormData {
  title: string
  template: CvTemplate
  contentLanguage: string
  fullName: string
  roleTitle: string
  summary: string
  email: string
  phone: string
  location: string
  links: CvLink[]
  experiences: CvExperience[]
  education: CvEducation[]
  skills: CvSkill[]
  languages: CvLanguage[]
  certifications: CvCertification[]
}

export function emptyExperience(): CvExperience {
  return { company: '', role: '', location: '', startDate: '', endDate: '', current: false, description: '' }
}
export function emptyEducation(): CvEducation {
  return { institution: '', degree: '', field: '', startDate: '', endDate: '', current: false }
}
export function emptySkill(): CvSkill {
  return { name: '', level: 3 }
}
export function emptyLanguage(): CvLanguage {
  return { name: '', level: 'B1' }
}
export function emptyCertification(): CvCertification {
  return { name: '', issuer: '', date: '' }
}
export function emptyLink(): CvLink {
  return { label: '', url: '' }
}

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateCvPhotoFile(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return 'invalidPhotoType'
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return 'photoTooLarge'
  }
  return null
}

export function formatCvDate(iso: string, locale: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}-01`)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d)
  } catch {
    return iso
  }
}

export function cvPhotoExtension(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName.toLowerCase()
  const fromType = file.type.split('/')[1]?.split(/[+;]/)[0]
  return fromType || 'jpg'
}

// Modulo CV vuoto (usato anche dalla pagina «Nuovo CV» sul server, per
// precompilarlo con i dati del profilo: per questo non sta nel componente)
export function emptyCvForm(): CvFormData {
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
