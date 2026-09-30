// Ridimensiona una foto nel browser prima del caricamento: lato lungo al
// massimo `maxSide` px, orientamento corretto (foto del telefono), JPEG
// di buona qualità. Una foto già piccola resta com'è. Con
// `keepTransparency` i PNG/WebP/GIF restano PNG (loghi con trasparenza).
// Se il browser non riesce a leggerla restituisce null.
export async function resizeImageFile(
  file: File,
  maxSide = 1200,
  quality = 0.82,
  options: { keepTransparency?: boolean; keepIfUnderBytes?: number } = {}
): Promise<File | null> {
  if (!file.type.startsWith('image/')) return null
  const bitmap =
    (await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)) ??
    (await createImageBitmap(file).catch(() => null))
  if (!bitmap) return null

  const longSide = Math.max(bitmap.width, bitmap.height)
  const keepIfUnder = options.keepIfUnderBytes ?? 300 * 1024
  // Già piccola e leggera: nessuna ricompressione (niente perdita di qualità)
  if (longSide <= maxSide && file.size <= keepIfUnder) {
    bitmap.close()
    return file
  }

  const scale = Math.min(1, maxSide / longSide)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return null
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const transparent = options.keepTransparency && /^image\/(png|webp|gif)$/.test(file.type)
  const type = transparent ? 'image/png' : 'image/jpeg'
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, type, transparent ? undefined : quality))
  if (!blob) return null
  // Se per caso la versione nuova pesa di più (foto già compressa), si tiene l'originale
  if (blob.size >= file.size && longSide <= maxSide) return file
  return new File([blob], transparent ? 'image.png' : 'photo.jpg', { type })
}
