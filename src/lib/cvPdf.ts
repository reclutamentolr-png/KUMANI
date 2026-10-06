import { jsPDF } from 'jspdf'
import {
  formatCvDate,
  type CvTemplate,
  type CvLink,
  type CvExperience,
  type CvEducation,
  type CvSkill,
  type CvLanguage,
  type CvCertification,
} from '@/lib/cv'

export type CvForPdf = {
  code: string
  title: string
  template: CvTemplate
  content_language: string
  full_name: string
  role_title: string | null
  summary: string | null
  email: string | null
  phone: string | null
  location: string | null
  links: CvLink[]
  experiences: CvExperience[]
  education: CvEducation[]
  skills: CvSkill[]
  languages: CvLanguage[]
  certifications: CvCertification[]
}

// ~10 fixed section labels, translated statically for the 7 site locales —
// these are PDF headings, not next-intl runtime strings, since jsPDF layout
// code has no React/i18n context of its own.
const CV_PDF_LABELS: Record<string, Record<string, string>> = {
  it: {
    experience: 'Esperienza Professionale',
    education: 'Formazione',
    skills: 'Competenze',
    languages: 'Lingue',
    certifications: 'Certificazioni',
    links: 'Link',
    present: 'Presente',
    poweredBy: 'Aggiornato in tempo reale su',
  },
  en: {
    experience: 'Professional Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    certifications: 'Certifications',
    links: 'Links',
    present: 'Present',
    poweredBy: 'Live-updated at',
  },
  de: {
    experience: 'Berufserfahrung',
    education: 'Ausbildung',
    skills: 'Fähigkeiten',
    languages: 'Sprachen',
    certifications: 'Zertifizierungen',
    links: 'Links',
    present: 'Heute',
    poweredBy: 'Live aktualisiert unter',
  },
  es: {
    experience: 'Experiencia Profesional',
    education: 'Formación',
    skills: 'Habilidades',
    languages: 'Idiomas',
    certifications: 'Certificaciones',
    links: 'Enlaces',
    present: 'Actualidad',
    poweredBy: 'Actualizado en vivo en',
  },
  fr: {
    experience: 'Expérience Professionnelle',
    education: 'Formation',
    skills: 'Compétences',
    languages: 'Langues',
    certifications: 'Certifications',
    links: 'Liens',
    present: "Aujourd'hui",
    poweredBy: 'Mis à jour en direct sur',
  },
  pt: {
    experience: 'Experiência Profissional',
    education: 'Formação',
    skills: 'Competências',
    languages: 'Idiomas',
    certifications: 'Certificações',
    links: 'Links',
    present: 'Atual',
    poweredBy: 'Atualizado em tempo real em',
  },
  ru: {
    experience: 'Опыт работы',
    education: 'Образование',
    skills: 'Навыки',
    languages: 'Языки',
    certifications: 'Сертификаты',
    links: 'Ссылки',
    present: 'По настоящее время',
    poweredBy: 'Обновляется в реальном времени на',
  },
}

export function getCvPdfLabels(locale: string) {
  return CV_PDF_LABELS[locale] || CV_PDF_LABELS.it
}

// Helper senza jsPDF ri-esportato per chi lo importava da qui
export { loadInterFontBase64 } from '@/lib/pdfHelpers'

const INK: [number, number, number] = [23, 23, 23]
const GOLD: [number, number, number] = [199, 161, 90]
const MUTED: [number, number, number] = [110, 110, 110]
const WHITE: [number, number, number] = [255, 255, 255]
const LIGHT1: [number, number, number] = [230, 230, 230]
const LIGHT2: [number, number, number] = [220, 220, 220]

function registerFont(doc: jsPDF, fontBase64: string) {
  doc.addFileToVFS('Inter-Regular.ttf', fontBase64)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.setFont('Inter')
}

/** Shared between the download button and the share/print flow. */
export function generateCvPdfBlob(params: {
  cv: CvForPdf
  photoDataUrl: string | null
  fontBase64: string
  publicUrl: string
  qrDataUrl: string | null
}): Blob {
  const { cv, photoDataUrl, fontBase64, publicUrl, qrDataUrl } = params
  const labels = getCvPdfLabels(cv.content_language)
  const fmtDate = (iso: string) => formatCvDate(iso, cv.content_language)

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  registerFont(doc, fontBase64)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 44

  const heading = (text: string, x: number, y: number, size = 12) => {
    doc.setFont('Inter')
    doc.setFontSize(size)
    doc.setTextColor(...GOLD)
    doc.text(text.toUpperCase(), x, y, { charSpace: 0.6 })
    return y
  }

  const paragraph = (text: string, x: number, y: number, maxWidth: number, size = 9.5, color: [number, number, number] = INK): number => {
    doc.setFont('Inter')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text || '', maxWidth)
    doc.text(lines, x, y)
    return y + lines.length * (size * 1.35)
  }

  const drawExperiences = (x: number, yStart: number, width: number): number => {
    let y = yStart
    cv.experiences.forEach((exp) => {
      doc.setFont('Inter')
      doc.setFontSize(10.5)
      doc.setTextColor(...INK)
      doc.text(exp.role || '', x, y)
      const dateRange = `${fmtDate(exp.startDate)} — ${exp.current ? labels.present : fmtDate(exp.endDate)}`
      const dateW = doc.getTextWidth(dateRange)
      doc.setFont('Inter')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      doc.text(dateRange, x + width - dateW, y)
      y += 13
      const companyLine = [exp.company, exp.location].filter(Boolean).join(' · ')
      doc.setFontSize(9)
      doc.setTextColor(...GOLD)
      doc.text(companyLine, x, y)
      y += 13
      if (exp.description) y = paragraph(exp.description, x, y, width) + 6
      else y += 6
    })
    return y
  }

  const drawEducation = (x: number, yStart: number, width: number): number => {
    let y = yStart
    cv.education.forEach((ed) => {
      doc.setFont('Inter')
      doc.setFontSize(10.5)
      doc.setTextColor(...INK)
      doc.text([ed.degree, ed.field].filter(Boolean).join(' — '), x, y)
      const dateRange = `${fmtDate(ed.startDate)} — ${ed.current ? labels.present : fmtDate(ed.endDate)}`
      const dateW = doc.getTextWidth(dateRange)
      doc.setFont('Inter')
      doc.setFontSize(8.5)
      doc.setTextColor(...MUTED)
      doc.text(dateRange, x + width - dateW, y)
      y += 13
      doc.setFontSize(9)
      doc.setTextColor(...GOLD)
      doc.text(ed.institution || '', x, y)
      y += 18
    })
    return y
  }

  const drawSkillsCompact = (x: number, yStart: number, width: number, light: boolean): number => {
    let y = yStart
    cv.skills.forEach((skill) => {
      doc.setFont('Inter')
      doc.setFontSize(9)
      doc.setTextColor(...(light ? WHITE : INK))
      doc.text(skill.name, x, y)
      const barW = 60
      const barX = x + width - barW
      doc.setDrawColor(...(light ? WHITE : MUTED))
      doc.setFillColor(...GOLD)
      for (let i = 0; i < 4; i++) {
        const dotX = barX + i * 15
        doc.circle(dotX, y - 3, 3, i < skill.level ? 'F' : 'S')
      }
      y += 16
    })
    return y
  }

  const drawLanguagesCompact = (x: number, yStart: number, width: number, light: boolean): number => {
    let y = yStart
    cv.languages.forEach((lang) => {
      doc.setFont('Inter')
      doc.setFontSize(9)
      doc.setTextColor(...(light ? WHITE : INK))
      doc.text(lang.name, x, y)
      doc.setFontSize(8.5)
      doc.setTextColor(...(light ? LIGHT1 : MUTED))
      const lw = doc.getTextWidth(lang.level)
      doc.text(lang.level, x + width - lw, y)
      y += 15
    })
    return y
  }

  const drawCertifications = (x: number, yStart: number, width: number, light: boolean): number => {
    let y = yStart
    cv.certifications.forEach((cert) => {
      doc.setFont('Inter')
      doc.setFontSize(9)
      doc.setTextColor(...(light ? WHITE : INK))
      const dateStr = cert.date ? fmtDate(cert.date) : ''
      doc.text(cert.name, x, y)
      y += 12
      doc.setFontSize(8)
      doc.setTextColor(...(light ? LIGHT2 : MUTED))
      doc.text([cert.issuer, dateStr].filter(Boolean).join(' · '), x, y)
      y += 15
    })
    return y
  }

  const drawLinks = (x: number, yStart: number, width: number, light: boolean): number => {
    let y = yStart
    cv.links.forEach((link) => {
      doc.setFont('Inter')
      doc.setFontSize(8.5)
      doc.setTextColor(...(light ? WHITE : GOLD))
      doc.textWithLink(link.label || link.url, x, y, { url: link.url })
      y += 13
    })
    return y
  }

  if (cv.template === 'sidebar') {
    // Two-column: colored left sidebar (contact/photo/skills/languages), main content on the right.
    const sidebarW = 170
    doc.setFillColor(...INK)
    doc.rect(0, 0, sidebarW, pageHeight, 'F')

    let sy = 50
    const sx = 28
    const sw = sidebarW - sx * 2 + 20

    if (photoDataUrl) {
      try {
        const size = 90
        doc.addImage(photoDataUrl, sx, sy, size, size)
        sy += size + 18
      } catch {
        // Skip embedding if the format isn't supported by jsPDF
      }
    }

    doc.setFont('Inter')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    ;[cv.email, cv.phone, cv.location].filter(Boolean).forEach((line) => {
      const wrapped = doc.splitTextToSize(line as string, sw)
      doc.text(wrapped, sx, sy)
      sy += wrapped.length * 12 + 4
    })
    sy += 10

    if (cv.skills.length) {
      heading(labels.skills, sx, sy, 10)
      sy += 18
      sy = drawSkillsCompact(sx, sy, sw, true)
      sy += 10
    }
    if (cv.languages.length) {
      heading(labels.languages, sx, sy, 10)
      sy += 18
      sy = drawLanguagesCompact(sx, sy, sw, true)
      sy += 10
    }
    if (cv.certifications.length) {
      heading(labels.certifications, sx, sy, 10)
      sy += 18
      sy = drawCertifications(sx, sy, sw, true)
      sy += 10
    }
    if (cv.links.length) {
      heading(labels.links, sx, sy, 10)
      sy += 18
      drawLinks(sx, sy, sw, true)
    }

    // Main column
    const mx = sidebarW + margin
    const mw = pageWidth - mx - margin
    let my = 56

    doc.setFont('Inter')
    doc.setFontSize(22)
    doc.setTextColor(...INK)
    doc.text(cv.full_name, mx, my)
    my += 22
    if (cv.role_title) {
      doc.setFontSize(12)
      doc.setTextColor(...GOLD)
      doc.text(cv.role_title, mx, my)
      my += 20
    }
    if (cv.summary) my = paragraph(cv.summary, mx, my, mw, 9.5) + 16

    if (cv.experiences.length) {
      my = heading(labels.experience, mx, my) + 16
      my = drawExperiences(mx, my, mw) + 6
    }
    if (cv.education.length) {
      my = heading(labels.education, mx, my) + 16
      my = drawEducation(mx, my, mw)
    }
  } else {
    // Single column — 'minimal' (left-aligned, ATS-clean) and 'classic'
    // (centered header + rule) share the same body layout.
    let y = 56
    const contentW = pageWidth - margin * 2

    if (cv.template === 'classic') {
      const nameW = doc.getTextWidth(cv.full_name)
      doc.setFont('Inter')
      doc.setFontSize(24)
      doc.setTextColor(...INK)
      doc.text(cv.full_name, pageWidth / 2 - nameW / 2, y)
      y += 22
      if (cv.role_title) {
        doc.setFontSize(12)
        doc.setTextColor(...GOLD)
        const roleW = doc.getTextWidth(cv.role_title)
        doc.text(cv.role_title, pageWidth / 2 - roleW / 2, y)
        y += 18
      }
      const contactLine = [cv.email, cv.phone, cv.location].filter(Boolean).join('   ·   ')
      if (contactLine) {
        doc.setFontSize(8.5)
        doc.setTextColor(...MUTED)
        const cw = doc.getTextWidth(contactLine)
        doc.text(contactLine, pageWidth / 2 - cw / 2, y)
        y += 16
      }
      doc.setDrawColor(...GOLD)
      doc.line(margin, y, pageWidth - margin, y)
      y += 24
    } else {
      doc.setFont('Inter')
      doc.setFontSize(22)
      doc.setTextColor(...INK)
      doc.text(cv.full_name, margin, y)
      y += 20
      if (cv.role_title) {
        doc.setFontSize(11.5)
        doc.setTextColor(...GOLD)
        doc.text(cv.role_title, margin, y)
        y += 16
      }
      const contactLine = [cv.email, cv.phone, cv.location].filter(Boolean).join('   ·   ')
      if (contactLine) {
        doc.setFontSize(8.5)
        doc.setTextColor(...MUTED)
        doc.text(contactLine, margin, y)
        y += 20
      }
    }

    if (photoDataUrl && cv.template === 'classic') {
      try {
        const size = 64
        doc.addImage(photoDataUrl, pageWidth - margin - size, 40, size, size)
      } catch {
        // Skip embedding if the format isn't supported by jsPDF
      }
    }

    if (cv.summary) y = paragraph(cv.summary, margin, y, contentW) + 16

    if (cv.experiences.length) {
      y = heading(labels.experience, margin, y) + 16
      y = drawExperiences(margin, y, contentW) + 6
    }
    if (cv.education.length) {
      y = heading(labels.education, margin, y) + 16
      y = drawEducation(margin, y, contentW) + 6
    }

    const colW = (contentW - 24) / 2
    let leftY = y
    let rightY = y
    if (cv.skills.length) {
      leftY = heading(labels.skills, margin, leftY) + 16
      leftY = drawSkillsCompact(margin, leftY, colW, false) + 6
    }
    if (cv.certifications.length) {
      leftY = heading(labels.certifications, margin, leftY) + 16
      drawCertifications(margin, leftY, colW, false)
    }
    const rightX = margin + colW + 24
    if (cv.languages.length) {
      rightY = heading(labels.languages, rightX, rightY) + 16
      rightY = drawLanguagesCompact(rightX, rightY, colW, false) + 6
    }
    if (cv.links.length) {
      rightY = heading(labels.links, rightX, rightY) + 16
      drawLinks(rightX, rightY, colW, false)
    }
  }

  // Footer — the "living CV" hook: QR + link, present on every template.
  const footerY = pageHeight - 46
  doc.setDrawColor(230, 230, 230)
  doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14)
  if (qrDataUrl) {
    try {
      doc.addImage(qrDataUrl, pageWidth - margin - 40, footerY - 6, 40, 40)
    } catch {
      // Skip embedding if the format isn't supported by jsPDF
    }
  }
  doc.setFont('Inter')
  doc.setFontSize(8)
  doc.setTextColor(...MUTED)
  doc.text(labels.poweredBy, margin, footerY + 4)
  doc.setTextColor(...GOLD)
  doc.textWithLink(publicUrl, margin, footerY + 16, { url: publicUrl })

  return doc.output('blob')
}
