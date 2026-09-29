// File .msg di Outlook (il formato predefinito di "Salva con nome"): li
// trasformiamo in un'email .eml equivalente — intestazioni originali + testo —
// da passare al motore di CheckMail.
import MsgReaderModule from '@kenjiuno/msgreader'

type MsgData = { headers?: string; body?: string; subject?: string; senderName?: string; senderEmail?: string; attachments?: { fileName?: string }[] }

export function msgToEml(bytes: ArrayBuffer): string {
  const MsgReader = ((MsgReaderModule as unknown as { default?: unknown }).default ?? MsgReaderModule) as new (buffer: ArrayBuffer) => { getFileData(): MsgData }
  const data = new MsgReader(bytes).getFileData()
  // Via le intestazioni che descrivono il corpo originale (lo ricostruiamo
  // noi come testo semplice), comprese le righe di continuazione
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
  if (!headerLines.some((l) => /^from:/i.test(l)) && data.senderEmail) headerLines.push(`From: "${data.senderName ?? ''}" <${data.senderEmail}>`)
  if (!headerLines.some((l) => /^subject:/i.test(l)) && data.subject) headerLines.push(`Subject: ${data.subject}`)
  headerLines.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit')
  // Nomi degli allegati (il contenuto non serve): come righe finali nel testo
  const attachmentNote = (data.attachments ?? []).map((a) => a.fileName).filter(Boolean)
  const body = (data.body ?? '') + (attachmentNote.length ? `\n\n[allegati: ${attachmentNote.join(', ')}]` : '')
  return `${headerLines.join('\r\n')}\r\n\r\n${body}`
}
