// Angolo Bambini: foto di controllo di un disegno (contorno, colorato a caso,
// in posa con le parti mosse e i perni segnati in rosso), per verificare a
// occhio forme, parti e perni prima di pubblicarlo.
//
// Uso: npx tsx scripts/kids-preview.mts <id disegno> <cartella di uscita>
// Crea <cartella>/<id>.png (serve Chrome headless di Playwright).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { KIDS_SVG_CSS } from '../src/lib/kids/moves'
import type { Drawing } from '../src/lib/kids/types'

const [id, outArg] = process.argv.slice(2)
if (!id || !outArg) {
  console.error('Uso: npx tsx scripts/kids-preview.mts <id> <cartella>')
  process.exit(1)
}
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const CHROME = [
  join(process.env.LOCALAPPDATA ?? '', 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
if (!CHROME) throw new Error('Chrome headless non trovato')

const COLORS = ['#E8473B', '#F28C28', '#F7C531', '#5DB14E', '#7CC3EE', '#3A5BC7', '#8E5CC4', '#F49CBB', '#9A6234', '#D9A86C', '#F1D9B5', '#A9ABBE']

const POSE: Record<string, string> = {
  armL: 'rotate(120deg)',
  armR: 'rotate(-120deg)',
  head: 'rotate(12deg)',
  wingL: 'rotate(-28deg)',
  wingR: 'rotate(28deg)',
  tail: 'rotate(14deg)',
  ears: 'rotate(8deg)',
  eyes: 'scaleY(0.12)',
  figure: 'translateY(-24px)',
  wheel: 'rotate(45deg)',
}

const mod = (await import(pathToFileURL(resolve('src/lib/kids/drawings', `${id}.ts`)).href)) as { default: Drawing }
const d = mod.default
const regions = [...new Set([...d.svg.matchAll(/data-r="([^"]+)"/g)].map((m) => m[1]))]
const missing = d.figure.filter((r) => !regions.includes(r))
const html = `<!doctype html><meta charset="utf-8"><style>
${KIDS_SVG_CSS}
body { margin: 0; background: #E9EEF5; font: 14px system-ui; }
.row { display: flex; gap: 12px; padding: 12px; }
.cell { background: #fff; border-radius: 12px; padding: 6px; }
.cell p { margin: 2px 6px 4px; font-weight: 700; color: #2B2D52; }
svg { width: 400px; height: 440px; display: block; }
.kids-svg * { animation: none !important; transition: none !important; }
.pivot { fill: #ff0033; stroke: #fff; stroke-width: 2; }
</style>
<div class="row">
  <div class="cell"><p>1. Contorno (dorme)</p><svg class="kids-svg asleep" viewBox="0 0 400 440">${d.svg}</svg></div>
  <div class="cell"><p>2. Colorato</p><svg class="kids-svg c" viewBox="0 0 400 440">${d.svg}</svg></div>
  <div class="cell"><p>3. In posa + perni</p><svg class="kids-svg c p" viewBox="0 0 400 440">${d.svg}</svg></div>
</div>
<script>
const COLORS = ${JSON.stringify(COLORS)}
const POSE = ${JSON.stringify(POSE)}
document.querySelectorAll('svg.c').forEach((svg) => {
  const map = {}
  let i = 0
  svg.querySelectorAll('[data-r]').forEach((el) => {
    const r = el.dataset.r
    if (!(r in map)) map[r] = COLORS[i++ % COLORS.length]
    el.style.fill = map[r]
  })
})
document.querySelectorAll('svg').forEach((svg) => {
  svg.querySelectorAll('[data-o]').forEach((el) => {
    const [x, y] = el.dataset.o.split(/\\s+/).map(Number)
    el.style.transformOrigin = x + 'px ' + y + 'px'
  })
})
const p = document.querySelector('svg.p')
p.querySelectorAll('[data-role]').forEach((el) => {
  const t = POSE[el.dataset.role]
  if (t) el.style.transform = t
  if (el.dataset.role === 'zzz') el.style.opacity = 1
})
p.querySelectorAll('[data-o]').forEach((el) => {
  const [x, y] = el.dataset.o.split(/\\s+/).map(Number)
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 5); c.setAttribute('class', 'pivot')
  p.appendChild(c)
})
</script>`
const htmlPath = join(out, `${id}.html`)
writeFileSync(htmlPath, html)
const png = join(out, `${id}.png`)
execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', `--screenshot=${png}`, '--window-size=1284,500', '--virtual-time-budget=1500', pathToFileURL(htmlPath).href], { stdio: 'ignore' })
console.log(`${png}\nparti: ${regions.length} (${regions.join(', ')})`)
if (missing.length) console.log(`ATTENZIONE: in "figure" ci sono parti che non esistono nel disegno: ${missing.join(', ')}`)
