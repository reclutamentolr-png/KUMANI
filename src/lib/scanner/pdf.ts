// SCANNER E PDF: le pagine (foto scansionate e pagine di PDF) diventano un
// PDF nuovo con pdf-lib, nel browser. «Leggero» rimpicciolisce le foto e
// ridisegna come immagine più piccola le pagine dei PDF pesanti (scansioni):
// il file pesa meno, il testo di quelle pagine non si seleziona più. I PDF
// leggeri (solo testo) restano come sono, perché come immagine peserebbero di più.

export const MAX_PAGES = 80
export const PDF_MAX_BYTES = 60 * 1024 * 1024
const A4 = { w: 595.28, h: 841.89 }

export type PdfJsPage = {
  getViewport: (o: { scale: number; rotation?: number }) => { width: number; height: number }
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas: HTMLCanvasElement }) => { promise: Promise<void> }
  rotate: number
}
export type PdfJsDoc = { numPages: number; getPage: (n: number) => Promise<PdfJsPage>; destroy: () => Promise<void> }

// Una pagina del lavoro: foto scansionata (JPEG già pronto) o pagina di un PDF caricato
// origin: foto di partenza e scelte (angoli, filtro), per poter correggere la pagina
export type ImagePage = { id: string; kind: 'image'; jpeg: Blob; w: number; h: number; thumb: string; origin?: { file: Blob; edit: { quad: { x: number; y: number }[]; filter: string; turns: number } } }
export type PdfPage = { id: string; kind: 'pdf'; source: string; index: number; turns: number; thumb: string; w: number; h: number }
export type Page = ImagePage | PdfPage
export type SourcePdf = { id: string; name: string; bytes: ArrayBuffer; js: PdfJsDoc }

export async function openPdfJs(bytes: ArrayBuffer): Promise<PdfJsDoc> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  return (await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise) as unknown as PdfJsDoc
}

// Pagina di PDF disegnata su una tela (lato lungo = longSide px), con la rotazione voluta
export async function renderPdfPage(doc: PdfJsDoc, index: number, turns: number, longSide: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(index + 1)
  const rotation = (page.rotate + turns * 90) % 360
  const base = page.getViewport({ scale: 1, rotation })
  const scale = longSide / Math.max(base.width, base.height)
  const viewport = page.getViewport({ scale, rotation })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

const jpegOf = (c: HTMLCanvasElement, q: number) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', q))

async function shrink(jpeg: Blob, maxSide: number, q: number): Promise<{ bytes: ArrayBuffer; w: number; h: number }> {
  const bitmap = await createImageBitmap(jpeg)
  const k = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bitmap.width * k)
  c.height = Math.round(bitmap.height * k)
  c.getContext('2d')!.drawImage(bitmap, 0, 0, c.width, c.height)
  bitmap.close()
  return { bytes: await (await jpegOf(c, q)).arrayBuffer(), w: c.width, h: c.height }
}

export async function buildPdf(pages: Page[], sources: Map<string, SourcePdf>, opts: { light: boolean; title: string }, onProgress?: (done: number) => void): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib')
  const out = await PDFDocument.create()
  out.setTitle(opts.title)
  out.setProducer('KUMANI Scanner')
  out.setCreator('KUMANI')
  const loaded = new Map<string, Awaited<ReturnType<typeof PDFDocument.load>>>()

  // Foto in una pagina A4 (verticale o orizzontale come la foto), centrata
  const addImage = async (bytes: ArrayBuffer, w: number, h: number) => {
    const img = await out.embedJpg(bytes)
    const landscape = w > h
    const pw = landscape ? A4.h : A4.w
    const ph = landscape ? A4.w : A4.h
    const k = Math.min(pw / w, ph / h)
    const page = out.addPage([pw, ph])
    page.drawImage(img, { x: (pw - w * k) / 2, y: (ph - h * k) / 2, width: w * k, height: h * k })
  }

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]
    if (p.kind === 'image') {
      if (opts.light) {
        const s = await shrink(p.jpeg, 1300, 0.55)
        await addImage(s.bytes, s.w, s.h)
      } else await addImage(await p.jpeg.arrayBuffer(), p.w, p.h)
    } else {
      const src = sources.get(p.source)
      if (!src) continue
      // Pesante = oltre 150 KB a pagina in media (di solito pagine scansionate)
      if (opts.light && src.bytes.byteLength / src.js.numPages > 150 * 1024) {
        // Pagina ridisegnata come immagine leggera, con la sua misura in punti
        const canvas = await renderPdfPage(src.js, p.index, p.turns, 1300)
        const img = await out.embedJpg(await (await jpegOf(canvas, 0.55)).arrayBuffer())
        const pageObj = await src.js.getPage(p.index + 1)
        const vp = pageObj.getViewport({ scale: 1, rotation: (pageObj.rotate + p.turns * 90) % 360 })
        const page = out.addPage([vp.width, vp.height])
        page.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height })
      } else {
        let doc = loaded.get(p.source)
        if (!doc) {
          doc = await PDFDocument.load(src.bytes.slice(0), { ignoreEncryption: false })
          loaded.set(p.source, doc)
        }
        const [copy] = await out.copyPages(doc, [p.index])
        copy.setRotation(degrees((copy.getRotation().angle + p.turns * 90) % 360))
        out.addPage(copy)
      }
    }
    onProgress?.(i + 1)
  }
  return out.save()
}

export const newId = () => Math.random().toString(36).slice(2, 10)
