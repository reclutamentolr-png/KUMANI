// File .msg di Outlook (il formato predefinito di "Salva con nome"): li
// trasformiamo in un'email .eml equivalente — intestazioni originali, corpo
// (HTML se c'è, altrimenti testo) e allegati (solo il nome, vuoti) — da
// passare al motore di CheckMail.
import MsgReaderModule from '@kenjiuno/msgreader'

type MsgData = {
  headers?: string
  body?: string
  bodyHtml?: string
  html?: Uint8Array
  subject?: string
  senderName?: string
  senderEmail?: string
  attachments?: { fileName?: string; fileNameShort?: string; attachmentHidden?: boolean }[]
}

const BOUNDARY = 'kumani-checkmail-msg'

// Valore di intestazione su una riga, senza caratteri che la rompono
const headerValue = (value: string) => value.replace(/[\r\n"]/g, ' ').trim()

export function msgToEml(bytes: ArrayBuffer): string {
  const MsgReader = ((MsgReaderModule as unknown as { default?: unknown }).default ?? MsgReaderModule) as new (buffer: ArrayBuffer) => { getFileData(): MsgData }
  const data = new MsgReader(bytes).getFileData()

  // Via le intestazioni che descrivono il corpo originale (lo ricostruiamo
  // noi), comprese le righe di continuazione
  const headerLines: string[] = []
  let skipping = false
  for (const line of (data.headers ?? '').split(/\r?\n/)) {
    if (/^\s/.test(line)) {
      if (!skipping) headerLines.push(line)
      continue
    }
    skipping = /^(content-type|content-transfer-encoding|mime-version):/i.test(line)
    if (!skipping && line.trim()) headerLines.push(line)
  }
  // Mittente solo se è un indirizzo vero (non "/O=EXCHANGELABS/..." interno)
  if (!headerLines.some((l) => /^from:/i.test(l)) && data.senderEmail && /^[^\s@]+@[^\s@]+$/.test(data.senderEmail)) {
    headerLines.push(`From: "${headerValue(data.senderName ?? '')}" <${data.senderEmail}>`)
  }
  if (!headerLines.some((l) => /^subject:/i.test(l)) && data.subject) headerLines.push(`Subject: ${headerValue(data.subject)}`)

  const html = data.bodyHtml ?? (data.html ? new TextDecoder('utf-8').decode(data.html) : '')
  const bodyPart = html
    ? ['Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', html]
    : ['Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', data.body ?? '']

  const attachmentNames = (data.attachments ?? [])
    .filter((a) => !a.attachmentHidden)
    .map((a) => headerValue(a.fileName ?? a.fileNameShort ?? ''))
    .filter(Boolean)
    .slice(0, 50)

  headerLines.push('MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${BOUNDARY}"`)
  const parts = [
    `--${BOUNDARY}`,
    ...bodyPart,
    ...attachmentNames.flatMap((name) => [
      `--${BOUNDARY}`,
      `Content-Type: application/octet-stream; name="${name}"`,
      `Content-Disposition: attachment; filename="${name}"`,
      'Content-Transfer-Encoding: base64',
      '',
      '',
    ]),
    `--${BOUNDARY}--`,
  ]
  return `${headerLines.join('\r\n')}\r\n\r\n${parts.join('\r\n')}\r\n`
}
