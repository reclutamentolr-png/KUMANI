export const RECEIPT_TEMPLATES = [
  'delivery',
  'loan',
  'return',
  'declared_payment',
  'deposit',
  'private_sale',
  'keys',
  'documents',
  'company_equipment',
] as const
export type ReceiptTemplate = (typeof RECEIPT_TEMPLATES)[number]

export interface DigitalReceiptFormData {
  template: ReceiptTemplate
  objectName: string
  serialNumber: string
  recipientName: string
  deliveryDate: string // ISO date
  reason: string
  notes: string
  quantity: number | null
  declaredValue: number | null
  // Come leggere il valore: «+ IVA», «IVA inclusa» o nessuna indicazione
  vatMode: ReceiptVatMode
  // Intestazione con logo e dati della Scheda attività
  showIssuer: boolean
  expectedReturnDate: string // ISO date, only meaningful for 'loan'
  addLifeCalendarReminder: boolean
}

export const RECEIPT_VAT_MODES = ['none', 'plus', 'included'] as const
export type ReceiptVatMode = (typeof RECEIPT_VAT_MODES)[number]

// Valore con la valuta e l'indicazione dell'IVA (es. «7.300,00 € + IVA»)
export function formatReceiptValue(value: number, vatMode: string | null | undefined, locale: string, labels: { plus: string; included: string }): string {
  const money = Number(value).toLocaleString(locale, { style: 'currency', currency: 'EUR' })
  return vatMode === 'plus' ? `${money} ${labels.plus}` : vatMode === 'included' ? `${money} ${labels.included}` : money
}

export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

export function validatePhotoFile(file: File): string | null {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return 'invalidPhotoType'
  }
  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return 'photoTooLarge'
  }
  return null
}

export function photoExtension(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && fromName.length <= 5) return fromName.toLowerCase()
  const fromType = file.type.split('/')[1]
  return fromType || 'jpg'
}
