// Helper dei PDF senza jsPDF: i componenti li importano subito,
// mentre jsPDF arriva solo con import() al clic.

export type QuotePdfLabels = {
  bigTitle: string
  documentTitle: (n: number) => string
  issueDateLabel: string
  validUntilLabel: string
  attentionLabel: string
  vatLabel: string
  descriptionHeader: string
  quantityHeader: string
  unitPriceHeader: string
  totalHeader: string
  totalLabel: string
  paymentInfoLabel: string
  notesLabel: string
  pecLabel: string
  pageOf: (page: number, pages: number) => string
  dearLabel: string
  subjectLabel: string
  signatureLabel: string
  signatureHint: string
  vatPlus: string
  vatIncluded: string
}

/** Shared between the download button and the share/print flow so the two never drift apart. */
export function buildQuotePdfLabels(t: (key: string, values?: Record<string, string | number>) => string): QuotePdfLabels {
  return {
    bigTitle: t('pdfBigTitle'),
    documentTitle: (n) => t('pdfDocumentTitle', { number: n }),
    issueDateLabel: t('issueDateField'),
    validUntilLabel: t('validUntilField'),
    attentionLabel: t('pdfAttentionLabel'),
    vatLabel: t('clientVatField'),
    descriptionHeader: t('itemDescriptionHeader'),
    quantityHeader: t('itemQuantityHeader'),
    unitPriceHeader: t('itemPriceHeader'),
    totalHeader: t('itemTotalHeader'),
    totalLabel: t('totalLabel'),
    paymentInfoLabel: t('paymentInfoField'),
    notesLabel: t('notesField'),
    pecLabel: t('pecField'),
    pageOf: (page, pages) => t('pdfPageOf', { page, pages }),
    dearLabel: t('pdfDear'),
    subjectLabel: t('subjectField'),
    signatureLabel: t('pdfSignature'),
    signatureHint: t('pdfSignatureHint'),
    vatPlus: t('vatPlus'),
    vatIncluded: t('vatIncluded'),
  }
}

export async function loadInterFontBase64(): Promise<string> {
  const res = await fetch('/fonts/inter/Inter-Regular.ttf')
  const buffer = await res.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
