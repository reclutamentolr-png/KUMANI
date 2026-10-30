import type { CvLink, CvExperience, CvEducation, CvSkill, CvLanguage, CvCertification, CvExtras } from '@/lib/cv'

export type CvTemplateData = {
  fullName: string
  roleTitle: string | null
  summary: string | null
  email: string | null
  phone: string | null
  location: string | null
  photoUrl: string | null
  links: CvLink[]
  experiences: CvExperience[]
  education: CvEducation[]
  skills: CvSkill[]
  languages: CvLanguage[]
  certifications: CvCertification[]
  extras: CvExtras
  contentLanguage: string
}
