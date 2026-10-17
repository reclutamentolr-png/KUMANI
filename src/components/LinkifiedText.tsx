import { Fragment } from 'react'

// Testo scritto da un utente con gli indirizzi web resi cliccabili (si aprono
// in una nuova scheda). Solo http/https e «www.…»; la punteggiatura finale
// (punto, virgola, parentesi chiusa…) resta fuori dal link.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi
const TRAILING = /[.,;:!?)\]}'"»]+$/

export default function LinkifiedText({ text, linkClassName = 'underline underline-offset-2 break-all' }: { text: string; linkClassName?: string }) {
  const parts: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    const raw = match[0]
    const trailing = raw.match(TRAILING)?.[0] ?? ''
    const shown = trailing ? raw.slice(0, -trailing.length) : raw
    let href: string | null = null
    try {
      const url = new URL(/^https?:\/\//i.test(shown) ? shown : `https://${shown}`)
      if (url.protocol === 'http:' || url.protocol === 'https:') href = url.href
    } catch {
      href = null
    }
    if (!href) continue
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className={linkClassName}>
        {shown}
      </a>
    )
    if (trailing) parts.push(trailing)
    last = start + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts.map((part, i) => (typeof part === 'string' ? <Fragment key={`t${i}`}>{part}</Fragment> : part))}</>
}
