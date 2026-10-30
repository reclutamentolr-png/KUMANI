export const CV_TEMPLATES = ['moderno', 'professionale', 'elegante', 'europeo', 'minimal', 'classic', 'sidebar'] as const
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

// Livelli Europass per abilità (Ascolto, Lettura, Interazione, Produzione
// orale, Scrittura): facoltativi, se mancano vale «level» per tutte
export const CEFR_SKILLS = ['listening', 'reading', 'interaction', 'production', 'writing'] as const
export type CefrSkill = (typeof CEFR_SKILLS)[number]

export interface CvLanguage {
  name: string
  level: CefrLevel
  native?: boolean
  detail?: Partial<Record<CefrSkill, CefrLevel>>
}

// Dati in più dello standard europeo, tutti facoltativi
export interface CvExtras {
  birthDate?: string // yyyy-mm-dd
  nationality?: string
  drivingLicence?: string
  digitalSkills?: string
  interests?: string
  privacyConsent?: boolean
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
  extras: CvExtras
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
    template: 'moderno',
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
    extras: { privacyConsent: true },
  }
}

// Esperienze e studi dal più recente, come chiede lo standard europeo:
// prima quelli in corso, poi per data di fine (o di inizio) decrescente
export function byMostRecent<T extends { startDate: string; endDate: string; current: boolean }>(items: T[]): T[] {
  const key = (x: T) => (x.current ? '9999' : x.endDate || x.startDate || '')
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => key(b.item).localeCompare(key(a.item)) || b.item.startDate.localeCompare(a.item.startDate) || a.index - b.index)
    .map((x) => x.item)
}

// Descrizione divisa in punti: righe che iniziano con -, • o * diventano un elenco
export function descriptionLines(text: string): { bullets: boolean; lines: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const bullets = lines.length > 1 && lines.every((l) => /^[-•*–]\s*/.test(l))
  return { bullets, lines: bullets ? lines.map((l) => l.replace(/^[-•*–]\s*/, '')) : lines }
}

// Livello di una lingua per una singola abilità
export function cefrFor(lang: CvLanguage, skill: CefrSkill): CefrLevel {
  return lang.detail?.[skill] || lang.level
}

export function cleanExtras(value: unknown): CvExtras {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const str = (x: unknown, max: number) => String(x ?? '').trim().slice(0, max)
  return {
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(String(v.birthDate ?? '')) ? String(v.birthDate) : '',
    nationality: str(v.nationality, 80),
    drivingLicence: str(v.drivingLicence, 60),
    digitalSkills: str(v.digitalSkills, 1500),
    interests: str(v.interests, 600),
    privacyConsent: v.privacyConsent !== false,
  }
}

// Nome su una o più righe, divise tra le parole (mai a metà del cognome):
// fino a «oneLineMax» lettere resta su una riga, altrimenti righe bilanciate
// (al massimo «maxLines») con la riga più lunga il più corta possibile
export function nameLines(name: string, oneLineMax = 16, maxLines = 2): string[] {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const whole = words.join(' ')
  if (words.length < 2 || whole.length <= oneLineMax) return [whole]
  let best: string[] = [whole]
  let bestMax = whole.length
  const consider = (parts: string[]) => {
    const longest = Math.max(...parts.map((p) => p.length))
    if (longest < bestMax) {
      bestMax = longest
      best = parts
    }
  }
  for (let i = 1; i < words.length; i++) consider([words.slice(0, i).join(' '), words.slice(i).join(' ')])
  if (maxLines >= 3)
    for (let i = 1; i < words.length - 1; i++)
      for (let j = i + 1; j < words.length; j++)
        consider([words.slice(0, i).join(' '), words.slice(i, j).join(' '), words.slice(j).join(' ')])
  return best
}
