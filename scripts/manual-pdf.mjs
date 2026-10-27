// Crea i PDF del Manuale Antitruffa (uno per lingua) da /manuale-stampa/<lingua>
// con il browser senza finestra di Playwright, e li salva in
// private/manuale/manuale-antitruffa-<lingua>.pdf (scaricati da
// /api/antitruffa/manuale, che conta i download).
//
// Uso, con `npm run dev` acceso:  node scripts/manual-pdf.mjs [it en ...]
// Da rifare ogni volta che cambiano i testi in src/lib/antitruffa/content.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.MANUAL_BASE_URL || 'http://localhost:3000'
const LANGS = process.argv.slice(2).length ? process.argv.slice(2) : ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']
const OUT = path.join(process.cwd(), 'private', 'manuale')
const CHROME =
  process.env.CHROME_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')

if (!fs.existsSync(CHROME)) {
  console.error(`Browser non trovato: ${CHROME}\nImposta CHROME_PATH con il percorso di chrome-headless-shell.`)
  process.exit(1)
}
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const port = 9400 + Math.floor(Math.random() * 400)
const browser = spawn(CHROME, ['--headless', '--disable-gpu', `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' })

let targets = []
for (let i = 0; i < 50 && !targets.length; i++) {
  try {
    targets = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === 'page')
  } catch {}
  if (!targets.length) await sleep(200)
}
const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r))
let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const i = ++id
    pending.set(i, resolve)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable')
await send('Runtime.enable')

try {
  for (const lang of LANGS) {
    await send('Page.navigate', { url: `${BASE}/manuale-stampa/${lang}` })
    // Pagina pronta: titolo presente, caratteri e immagini caricati
    let ready = false
    for (let i = 0; i < 180 && !ready; i++) {
      await sleep(1000)
      ready = await evaluate(
        "!!document.querySelector('h1') && document.fonts.status === 'loaded' && [...document.images].every((img) => img.complete)"
      )
    }
    if (!ready) throw new Error(`/manuale-stampa/${lang} non risponde`)
    await sleep(800)
    const res = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false, generateTaggedPDF: true })
    if (!res.result?.data) throw new Error(`PDF non creato (${lang}): ${JSON.stringify(res.error ?? res)}`)
    const file = path.join(OUT, `manuale-antitruffa-${lang}.pdf`)
    fs.writeFileSync(file, Buffer.from(res.result.data, 'base64'))
    console.log(`${lang}: ${file} (${Math.round(fs.statSync(file).size / 1024)} KB)`)
  }
} finally {
  ws.close()
  browser.kill()
}
process.exit(0)
