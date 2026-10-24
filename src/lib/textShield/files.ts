// Testo Protetto: testo dai file, letto nel browser (il file non viene caricato
// da nessuna parte). PDF con pdf.js, Word (.docx) aprendo il suo XML, testo semplice.

export type ReadResult = { text: string } | { error: 'unsupported' | 'unreadable' | 'empty' | 'tooBig' }

const MAX_BYTES = 15 * 1024 * 1024

async function pdfText(file: File) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let line = ''
    const lines: string[] = []
    for (const item of content.items) {
      if (!('str' in item)) continue
      line += item.str
      if (item.hasEOL) {
        lines.push(line)
        line = ''
      }
    }
    if (line) lines.push(line)
    pages.push(lines.join('\n'))
  }
  return pages.join('\n\n')
}

async function docxText(file: File) {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) return ''
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const paragraphs = [...doc.getElementsByTagNameNS(W, 'p')].map((p) => {
    let s = ''
    p.querySelectorAll('*').forEach((el) => {
      if (el.namespaceURI !== W) return
      if (el.localName === 't') s += el.textContent ?? ''
      else if (el.localName === 'tab') s += '\t'
      else if (el.localName === 'br') s += '\n'
    })
    return s
  })
  return paragraphs.join('\n')
}

export async function readTextFile(file: File): Promise<ReadResult> {
  if (file.size > MAX_BYTES) return { error: 'tooBig' }
  const name = file.name.toLowerCase()
  try {
    let text = ''
    if (name.endsWith('.pdf') || file.type === 'application/pdf') text = await pdfText(file)
    else if (name.endsWith('.docx')) text = await docxText(file)
    else if (/\.(txt|md|csv|rtf|html?)$/.test(name) || file.type.startsWith('text/')) text = await file.text()
    else return { error: 'unsupported' }
    text = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    return text ? { text } : { error: 'empty' }
  } catch {
    return { error: 'unreadable' }
  }
}
