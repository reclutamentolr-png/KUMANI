import type { jsPDF } from 'jspdf'
import type { QuoteItem, QuoteLayout, QuoteLogoPosition, QuoteSection, QuoteVatMode } from '@/lib/quotes'

// Parti comuni ai due PDF del preventivo (tabellare e descrittivo): tipi,
// colori, indirizzi e logo nella posizione scelta.

export type QuoteForPdf = {
  quote_number: number
  client_name: string
  client_email: string | null
  client_phone: string | null
  client_address: string | null
  client_city: string | null
  client_postal_code: string | null
  client_pec: string | null
  client_vat: string | null
  issue_date: string
  valid_until: string | null
  items: QuoteItem[]
  payment_info: string | null
  notes: string | null
  total: number
  // Preventivo descrittivo e posizione del logo (facoltativi: i preventivi
  // salvati prima hanno solo la tabella, logo a sinistra)
  layout?: QuoteLayout | null
  logo_position?: QuoteLogoPosition | null
  subject?: string | null
  intro?: string | null
  closing?: string | null
  sections?: QuoteSection[] | null
  show_total?: boolean | null
  vat_mode?: QuoteVatMode | null
  signature?: boolean | null
}

export type IssuerForPdf = {
  company_name: string | null
  vat_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  province: string | null
  pec: string | null
  email: string | null
  phone: string | null
  // Colore della Scheda attività (fascia del logo)
  accent?: string | null
} | null

export type Rgb = [number, number, number]
export const INK: Rgb = [23, 23, 23]
export const GOLD: Rgb = [199, 161, 90]
export const MUTED: Rgb = [110, 110, 110]

export function accentRgb(issuer: IssuerForPdf): Rgb {
  const hex = issuer?.accent?.trim() ?? ''
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return GOLD
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** "Via Roma 1, 12100 Cuneo (CN)" — salta le parti mancanti. */
export function formatIssuerAddressLine(issuer: IssuerForPdf): string | null {
  if (!issuer) return null
  const cityPart = [issuer.postal_code, issuer.city].filter(Boolean).join(' ')
  const provincePart = issuer.province ? `(${issuer.province})` : ''
  return [issuer.address, [cityPart, provincePart].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null
}

/** "Via Roma 1, 12100 Cuneo" — come quello dell'azienda, senza provincia. */
export function formatClientAddressLine(quote: QuoteForPdf): string | null {
  const cityPart = [quote.client_postal_code, quote.client_city].filter(Boolean).join(' ')
  return [quote.client_address, cityPart].filter(Boolean).join(', ') || null
}

/**
 * Logo in cima alla pagina nella posizione scelta: a sinistra, al centro, a
 * destra o su una fascia grigia a tutta larghezza con una riga del colore
 * dell'azienda (il logo al centro su un riquadro scuro). Restituisce la
 * prima riga libera sotto il logo. Senza logo, la fascia resta comunque.
 */
export function drawLogo(doc: jsPDF, logoDataUrl: string | null, position: QuoteLogoPosition, accent: Rgb, margin: number): number {
  const pageWidth = doc.internal.pageSize.getWidth()
  const top = margin - 6
  let props: { width: number; height: number } | null = null
  if (logoDataUrl) {
    try {
      props = doc.getImageProperties(logoDataUrl)
    } catch {
      props = null
    }
  }
  // Dimensioni del logo dentro un riquadro massimo, proporzioni intatte
  const fit = (maxW: number, maxH: number) => {
    if (!props) return { w: 0, h: 0 }
    const ratio = props.width / props.height
    let w = maxW
    let h = w / ratio
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    return { w, h }
  }
  const place = (x: number, y: number, w: number, h: number) => {
    try {
      doc.addImage(logoDataUrl!, x, y, w, h)
    } catch {
      // formato non supportato: si salta il logo
    }
  }

  if (position === 'band') {
    const bandY = top + 6
    const bandH = 30
    doc.setFillColor(150, 150, 150)
    doc.rect(0, bandY, pageWidth, bandH, 'F')
    doc.setFillColor(...accent)
    doc.rect(0, bandY + bandH, pageWidth, 3, 'F')
    const boxW = 170
    const boxH = 66
    const boxX = (pageWidth - boxW) / 2
    doc.setFillColor(20, 20, 20)
    doc.rect(boxX, top, boxW, boxH, 'F')
    if (props) {
      const { w, h } = fit(boxW - 24, boxH - 14)
      place(boxX + (boxW - w) / 2, top + (boxH - h) / 2, w, h)
    }
    return top + boxH + 22
  }
  if (!props) return top + 6
  const { w, h } = fit(position === 'left' ? 90 : 150, 64)
  const x = position === 'left' ? margin : position === 'right' ? pageWidth - margin - w : (pageWidth - w) / 2
  place(x, top + 6, w, h)
  return top + 6 + h + 16
}
