import { jsPDF } from 'jspdf'
import type { Catalog } from '@/lib/catalog-server'

// Catalogo dei servizi in PDF (A4), creato nel browser nella lingua della
// pagina: copertina, indice per categorie e una scheda per servizio (a cosa
// serve, cosa puoi fare, come si usa). Testi già tradotti dal chiamante.

export type CatalogPdfLabels = {
  title: string
  subtitle: string
  intro: string
  updated: string
  plansLine: string
  indexTitle: string
  purposeLabel: string
  pointsLabel: string
  stepsLabel: string
  planFree: string
  planBase: string
  planPro: string
  passFrom: (price: string) => string
  footer: string
  site: string
}

const INK: [number, number, number] = [23, 23, 23]
const GOLD: [number, number, number] = [199, 154, 59]
const MUTED: [number, number, number] = [105, 100, 92]
const LINE: [number, number, number] = [228, 220, 200]

// Immagini della copertina come data URL (null = copertina solo testo)
export type CatalogPdfImages = { cover: string | null; logo: string | null }

export function generateCatalogPdf(catalog: Catalog, labels: CatalogPdfLabels, fontBase64: string, images: CatalogPdfImages = { cover: null, logo: null }): Blob {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.addFileToVFS('Inter-Regular.ttf', fontBase64)
  doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
  doc.setFont('Inter')

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const CW = W - M * 2
  const BOTTOM = H - 56
  let y = M

  const color = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2])
  const lines = (text: string, size: number, width = CW) => {
    doc.setFontSize(size)
    return doc.splitTextToSize(text, width) as string[]
  }
  const write = (text: string, size: number, c: [number, number, number], opts: { x?: number; width?: number; gap?: number } = {}) => {
    const x = opts.x ?? M
    const ls = lines(text, size, opts.width ?? CW - (x - M))
    color(c)
    doc.setFontSize(size)
    for (const line of ls) {
      doc.text(line, x, y)
      y += size * 1.38
    }
    y += opts.gap ?? 0
  }
  const newPage = () => {
    doc.addPage()
    y = M
  }

  // Copertina: mosaico di foto KUMANI in alto (sfuma nel nero), testi in
  // basso su fondo scuro pieno, così restano sempre leggibili
  doc.setFillColor(...INK)
  doc.rect(0, 0, W, H, 'F')
  const photoH = images.cover ? W * (1000 / 1240) : 0
  if (images.cover) doc.addImage(images.cover, 'JPEG', 0, 0, W, photoH)
  y = Math.max(photoH + 6, H * 0.36)
  if (images.logo) {
    doc.addImage(images.logo, 'PNG', M, y - 6, 54, 54)
    color(GOLD)
    doc.setFontSize(13)
    doc.text('K U M A N I', M + 66, y + 26)
    y += 78
  } else {
    color(GOLD)
    doc.setFontSize(14)
    doc.text('K U M A N I', M, y)
    y += 40
  }
  write(labels.title, 30, [255, 255, 255], { gap: 4 })
  write(labels.subtitle, 14, GOLD, { gap: 12 })
  write(labels.intro, 10.5, [225, 220, 210], { width: CW * 0.9, gap: 12 })
  write(labels.plansLine, 10.5, [255, 255, 255], { gap: 4 })
  write(labels.updated, 9, [170, 165, 155])
  color(GOLD)
  doc.setFontSize(11)
  doc.text(labels.site, W - M, H - 36, { align: 'right' })

  // Indice
  newPage()
  write(labels.indexTitle, 22, INK, { gap: 10 })
  for (const group of catalog.groups) {
    if (y > BOTTOM - 40) newPage()
    write(group.label, 13, GOLD, { gap: 2 })
    write(group.items.map((item) => item.title).join(' · '), 9.5, MUTED, { gap: 10 })
  }

  // Schede
  const planText = (plan: string) => (plan === 'free' ? labels.planFree : plan === 'pro' ? labels.planPro : labels.planBase)
  for (const group of catalog.groups) {
    newPage()
    doc.setFillColor(...INK)
    doc.roundedRect(M, y - 6, CW, 40, 8, 8, 'F')
    color(GOLD)
    doc.setFontSize(17)
    doc.text(group.label, M + 16, y + 19)
    y += 56

    for (const item of group.items) {
      // Altezza stimata della scheda: se non ci sta, pagina nuova
      const purpose = lines(`${labels.purposeLabel} ${item.purpose}`, 10.5)
      const pointLines = item.points.reduce((n, p) => n + lines(`${p.title}${p.text ? ` — ${p.text}` : ''}`, 9.5, CW - 14).length, 0)
      const stepLines = item.steps.reduce((n, s) => n + lines(`${s.title}${s.text ? `: ${s.text}` : ''}`, 9.5, CW - 18).length, 0)
      const estimate = 34 + purpose.length * 14.5 + (pointLines + stepLines) * 13.2 + 46
      if (y + Math.min(estimate, BOTTOM - M) > BOTTOM) newPage()

      write(item.title, 15, INK, { gap: 0 })
      const badge = item.passPrice ? `${planText(item.plan)} · ${labels.passFrom(item.passPrice)}` : planText(item.plan)
      write(badge, 9, GOLD, { gap: 6 })
      write(`${labels.purposeLabel} ${item.purpose}`, 10.5, INK, { gap: 6 })

      if (item.points.length) {
        write(labels.pointsLabel.toUpperCase(), 8, MUTED, { gap: 1 })
        for (const point of item.points) {
          if (y > BOTTOM) newPage()
          color(GOLD)
          doc.setFontSize(9.5)
          doc.text('•', M + 2, y)
          write(`${point.title}${point.text ? ` — ${point.text}` : ''}`, 9.5, INK, { x: M + 14 })
        }
        y += 4
      }
      if (item.steps.length) {
        write(labels.stepsLabel.toUpperCase(), 8, MUTED, { gap: 1 })
        item.steps.forEach((step, i) => {
          if (y > BOTTOM) newPage()
          color(GOLD)
          doc.setFontSize(9.5)
          doc.text(`${i + 1}.`, M, y)
          write(`${step.title}${step.text ? `: ${step.text}` : ''}`, 9.5, INK, { x: M + 18 })
        })
      }
      // Linea di separazione tra le schede
      y += 8
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.6)
      if (y < BOTTOM) doc.line(M, y, W - M, y)
      y += 22
    }
  }

  // Piè di pagina (tranne la copertina)
  const pages = doc.getNumberOfPages()
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    color(MUTED)
    doc.text(`${labels.footer} · ${labels.site}`, M, H - 28)
    doc.text(String(p), W - M, H - 28, { align: 'right' })
  }

  return doc.output('blob')
}
