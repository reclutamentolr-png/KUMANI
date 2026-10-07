'use client'

import { useEffect, useState } from 'react'

// Diagnosi temporanea: con ?debugfocus=1 nell'indirizzo mostra in basso chi
// riceve il clic, chi prende il cursore e chi glielo toglie (per capire
// perché un campo non accetta testo). Si spegne con ?debugfocus=0.
const KEY = 'kumani:debugfocus'

const describe = (node: EventTarget | null) => {
  if (!node || !(node instanceof Element)) return String(node)
  const el = node as HTMLElement
  const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join('.') : ''
  return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`
}

export default function FocusDebug() {
  const [on, setOn] = useState(false)
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    try {
      const param = new URLSearchParams(window.location.search).get('debugfocus')
      if (param === '1') sessionStorage.setItem(KEY, '1')
      if (param === '0') sessionStorage.removeItem(KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOn(sessionStorage.getItem(KEY) === '1')
    } catch {
      // niente diagnosi senza memoria del browser
    }
  }, [])

  useEffect(() => {
    if (!on) return
    const add = (text: string) => setLines((prev) => [`${new Date().toLocaleTimeString()} ${text}`, ...prev].slice(0, 14))
    const onDown = (e: PointerEvent) => {
      const top = document.elementFromPoint(e.clientX, e.clientY)
      add(`DOWN su ${describe(e.target)} | sopra: ${describe(top)} | bloccato: ${e.defaultPrevented}`)
      setTimeout(() => add(`dopo il clic, cursore su: ${describe(document.activeElement)}`), 50)
    }
    const onFocusIn = (e: FocusEvent) => add(`FOCUS → ${describe(e.target)}`)
    const onFocusOut = (e: FocusEvent) => add(`perde focus ${describe(e.target)} → va a ${describe(e.relatedTarget)}`)
    const onKey = (e: KeyboardEvent) => add(`TASTO "${e.key.length === 1 ? '•' : e.key}" su ${describe(e.target)} | bloccato: ${e.defaultPrevented}`)
    const onKeyAfter = (e: KeyboardEvent) => {
      if (e.defaultPrevented) add(`TASTO bloccato da qualcuno della pagina`)
    }
    window.addEventListener('pointerdown', onDown, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keydown', onKeyAfter)
    add(`diagnosi attiva · ${navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d.]+/)?.[0] ?? ''}`)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keydown', onKeyAfter)
    }
  }, [on])

  if (!on) return null
  return (
    <div className="pointer-events-none fixed bottom-2 left-2 z-[9999] max-w-[95vw] rounded-lg bg-black/85 p-2 font-mono text-[10px] leading-4 text-green-300 sm:max-w-xl">
      {lines.map((line, i) => (
        <div key={i} className="truncate">
          {line}
        </div>
      ))}
    </div>
  )
}
