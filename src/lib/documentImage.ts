import { resizeImageFile } from '@/lib/resizeImage'

// Foto di documenti (libretto, assicurazione, contratti…) prima del
// caricamento: lato lungo al massimo 2480 px (un A4 a circa 210 dpi, il testo
// resta nitido anche stampato) e JPEG all'82%. Una foto del telefono da
// 3–5 MB scende a circa 400–700 KB. Già piccola e leggera resta com'è; se la
// versione nuova pesasse di più si tiene l'originale (vedi resizeImageFile).
// I PDF non si toccano: comprimerli vorrebbe dire trasformarli in immagini.
export const DOCUMENT_MAX_SIDE = 2480
export const DOCUMENT_JPEG_QUALITY = 0.82

export async function prepareDocumentFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  const ready = await resizeImageFile(file, DOCUMENT_MAX_SIDE, DOCUMENT_JPEG_QUALITY, { keepIfUnderBytes: 400 * 1024 }).catch(() => null)
  return ready ?? file
}
