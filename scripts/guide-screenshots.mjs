// Screenshot delle guide KUMANI (Centro guide /guida), in formato telefono,
// con l'elemento spiegato evidenziato da un riquadro dorato.
//
// Uso: node scripts/guide-screenshots.mjs <chrome-headless-shell> <locale> <loginLink|-> <shots.json> <outDir>
//   loginLink "-" = senza accesso (pagine pubbliche). shots.json: elenco di
//   { name, path, key?, sel?, closest?, start? } — key è una chiave dei testi
//   (messages/<locale>.json), così lo stesso elenco vale in ogni lingua.
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'

const [exe, locale, link, shotsFile, outDir] = process.argv.slice(2)
const shots = JSON.parse(readFileSync(shotsFile, 'utf8'))
const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'))
const base = `http://localhost:3000${locale === 'it' ? '' : `/${locale}`}`
mkdirSync(outDir, { recursive: true })

// Testo di una chiave, senza i segnaposto ICU
const textOf = (key) => {
  const value = key.split('.').reduce((o, k) => (o ? o[k] : undefined), messages)
  if (typeof value !== 'string') throw new Error(`Chiave mancante: ${key}`)
  return value.split('{')[0].trim()
}

const port = 9400 + Math.floor(Math.random() * 400)
const prof = `${outDir}/.prof-${port}`
const chrome = spawn(exe, ['--headless', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, 'about:blank'])
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(2500)
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result ?? m.error)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((r) => {
    const i = ++id
    pending.set(i, r)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: Number(process.env.SHOT_WIDTH || 390), height: 844, deviceScaleFactor: process.env.SHOT_WIDTH ? 1 : 2, mobile: !process.env.SHOT_WIDTH })
await send('Emulation.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
if (link !== '-') {
  await send('Page.navigate', { url: link })
  await sleep(14000)
}
// Niente invito "Installa Kumani" sulle schermate delle guide
await send('Page.navigate', { url: base + '/privacy' })
await sleep(4000)
await evaluate("localStorage.setItem('install_prompt_dismissed', 'true'); localStorage.setItem('kumani_tour_seen', '1')")

for (const shot of shots) {
  await send('Page.navigate', { url: base + shot.path })
  await sleep(shot.wait ?? 9000)
  // Azioni prima della foto: scrivere in un campo, toccare un pulsante,
  // caricare un file. I testi possono essere per lingua ({ it, en }).
  const local = (v) => (v && typeof v === 'object' ? v[locale] ?? v.en : v)
  for (const step of shot.do ?? []) {
    if (step.fill) {
      await evaluate(`(() => {
        const el = document.querySelector(${JSON.stringify(step.fill)})
        if (!el) return
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(local(step.value))})
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
      })()`)
    } else if (step.fillLabel) {
      // Campo trovato dal testo della sua etichetta (moduli senza id)
      await evaluate(`(() => {
        const wanted = ${JSON.stringify(local(step.fillLabel))}.toLowerCase()
        const label = [...document.querySelectorAll('label')].find((l) => (l.querySelector('span')?.textContent || l.textContent || '').trim().toLowerCase() === wanted)
        const el = label?.querySelector('input, textarea, select') || (label?.htmlFor && document.getElementById(label.htmlFor))
        if (!el) return
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(local(step.value))})
        el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
      })()`)
    } else if (step.js) {
      await evaluate(step.js)
    } else if (step.click) {
      await evaluate(`document.querySelector(${JSON.stringify(step.click)})?.click()`)
    } else if (step.clickText) {
      await evaluate(`(() => {
        const needle = ${JSON.stringify(local(step.clickText))}.toLowerCase()
        const all = [...document.querySelectorAll('button, a, label, [role=tab], [role=button]')].filter((n) => (n.textContent || '').toLowerCase().includes(needle))
        all.sort((x, y) => x.textContent.length - y.textContent.length)[0]?.click()
      })()`)
    } else if (step.file) {
      const { root } = await send('DOM.getDocument', { depth: -1 })
      const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: step.file })
      if (nodeId) await send('DOM.setFileInputFiles', { nodeId, files: [step.path] })
    }
    await sleep(step.wait ?? 1500)
  }
  const needle = shot.key ? textOf(shot.key) : shot.text ? local(shot.text) : null
  const result = await evaluate(`(() => {
    const style = document.createElement('style')
    style.textContent = 'nextjs-portal,a.fixed[href*="/guida/"]{display:none!important}'
    document.head.appendChild(style)
    if (${link !== '-'} && location.pathname.replace(/[/]$/, '').endsWith('/login')) return 'login'
    // Nei link mostrati (codice invito, QR…) il dominio vero (kumani.io), non localhost
    const local = /https?:[/][/]localhost:3000/g
    document.querySelectorAll('input').forEach((i) => { if (i.value.includes('localhost:3000')) i.value = i.value.replace(local, 'https://kumani.io') })
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const n = walker.currentNode
      if (n.nodeValue.includes('localhost:3000')) n.nodeValue = n.nodeValue.replace(local, 'https://kumani.io')
    }
    let el = null
    ${shot.sel ? `el = document.querySelector(${JSON.stringify(shot.sel)})` : ''}
    ${needle ? `
    const needle = ${JSON.stringify(needle)}.toLowerCase()
    const all = [...document.querySelectorAll('body *')].filter((n) => n.children.length < 40 && (n.textContent || '').toLowerCase().includes(needle))
    el = all.sort((a, b) => a.textContent.length - b.textContent.length)[0] || null` : ''}
    if (!el) return 'missing ' + location.pathname + ' ' + document.title
    ${shot.closest ? `el = el.closest(${JSON.stringify(shot.closest)}) || el` : ''}
    el.style.outline = '3px solid #c79a3b'
    el.style.outlineOffset = '4px'
    el.style.boxShadow = '0 0 0 9px rgba(199,154,59,0.28)'
    el.style.borderRadius = el.style.borderRadius || '12px'
    const tall = el.getBoundingClientRect().height > 640
    el.scrollIntoView({ block: ${shot.start ? "'start'" : 'tall ? "start" : "center"'} })
    if (${shot.start ? 'true' : 'tall'}) window.scrollBy(0, -70)
    return 'ok'
  })()`)
  await sleep(1200)
  if (result !== 'ok') {
    console.log(`${locale} ${shot.name}: ${result === 'login' ? 'NON COLLEGATO' : 'elemento non trovato (' + result + ')'}`)
    continue
  }
  // full: tutta la pagina (per studiare un servizio), non solo lo schermo
  const fullHeight = shot.full ? await evaluate('Math.min(document.documentElement.scrollHeight, 9000)') : 0
  const png = await send('Page.captureScreenshot', fullHeight
    ? { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Number(process.env.SHOT_WIDTH || 390), height: fullHeight, scale: 1 } }
    : { format: 'png' })
  writeFileSync(`${outDir}/${shot.name}.png`, Buffer.from(png.data, 'base64'))
  console.log(`${locale} ${shot.name}: ok`)
}
ws.close()
chrome.kill()
await sleep(800)
try {
  rmSync(prof, { recursive: true, force: true })
} catch {
  // profilo temporaneo
}
