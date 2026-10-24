// «Crea il tuo animale»: foto di controllo dei pezzi. Per lo slot scelto
// mostra ogni pezzo montato con il primo pezzo degli altri slot, colorato
// (riga sopra) e in posa con i perni segnati (riga sotto). Con "mix" mostra
// 10 creature a caso.
//
// Uso: npx tsx scripts/kids-creature-preview.mts <slot|mix> <cartella di uscita>
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { KIDS_SVG_CSS } from '../src/lib/kids/moves'
import { CREATURE_PARTS, assembleCreature, firstSelection, type CreatureSelection } from '../src/lib/kids/creature'
import { PART_IDS, SLOTS, type Slot } from '../src/lib/kids/creature/types'

const [slotArg, outArg] = process.argv.slice(2)
if (!slotArg || !outArg) {
  console.error('Uso: npx tsx scripts/kids-creature-preview.mts <slot|mix> <cartella>')
  process.exit(1)
}
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const CHROME = [
  join(process.env.LOCALAPPDATA ?? '', 'ms-playwright', 'chromium_headless_shell-1243', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((p) => existsSync(p))
if (!CHROME) throw new Error('Chrome headless non trovato')

const combos: { label: string; sel: CreatureSelection }[] = []
if (slotArg === 'mix') {
  for (let i = 0; i < 10; i++) {
    const sel = Object.fromEntries(SLOTS.map((s) => [s, CREATURE_PARTS[s][Math.floor(Math.random() * CREATURE_PARTS[s].length)]?.id ?? null])) as CreatureSelection
    combos.push({ label: SLOTS.map((s) => sel[s]).join(' · '), sel })
  }
} else {
  const slot = slotArg as Slot
  if (!SLOTS.includes(slot)) throw new Error(`Slot sconosciuto: ${slot}`)
  for (const p of CREATURE_PARTS[slot]) {
    const wrong = [...p.svg.matchAll(/data-r="([^"]+)"/g)].map((m) => m[1]).filter((r) => !PART_IDS[slot].includes(r))
    if (wrong.length) console.log(`ATTENZIONE ${slot}/${p.id}: parti non ammesse ${[...new Set(wrong)].join(', ')} (ammesse: ${PART_IDS[slot].join(', ')})`)
    combos.push({ label: `${slot}: ${p.id}`, sel: { ...firstSelection(), [slot]: p.id } })
  }
}

const cell = (label: string, svg: string, pose: boolean) =>
  `<div class="cell"><p>${label}</p><svg class="kids-svg c ${pose ? 'p' : ''}" viewBox="0 0 400 440">${svg}</svg></div>`
const rows = combos.map((c) => assembleCreature(c.sel).svg)
const html = `<!doctype html><meta charset="utf-8"><style>${KIDS_SVG_CSS}
body{margin:0;background:#E9EEF5;font:12px system-ui}.grid{display:grid;grid-template-columns:repeat(${Math.min(combos.length, 6)},210px);gap:6px;padding:6px}
.cell{background:#fff;border-radius:10px;padding:3px}.cell p{margin:2px 4px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}svg{width:204px;height:224px;display:block}
.kids-svg *{animation:none!important;transition:none!important}.pivot{fill:#ff0033;stroke:#fff;stroke-width:2}</style>
<div class="grid">${combos.map((c, i) => cell(c.label, rows[i], false)).join('')}</div>
<div class="grid">${combos.map((c, i) => cell('posa', rows[i], true)).join('')}</div>
<script>
const C=['#E8473B','#F28C28','#F7C531','#5DB14E','#7CC3EE','#3A5BC7','#8E5CC4','#F49CBB','#9A6234','#D9A86C','#F1D9B5','#A9ABBE']
const P={armL:'rotate(120deg)',armR:'rotate(-120deg)',head:'rotate(12deg)',wingL:'rotate(-28deg)',wingR:'rotate(28deg)',tail:'rotate(14deg)',ears:'rotate(8deg)',eyes:'scaleY(0.12)',figure:'translateY(-24px)',wheel:'rotate(45deg)'}
document.querySelectorAll('svg').forEach(s=>{const m={};let i=0;s.querySelectorAll('[data-r]').forEach(e=>{const r=e.dataset.r;if(!(r in m))m[r]=C[i++%C.length];e.style.fill=m[r]})
s.querySelectorAll('[data-o]').forEach(e=>{const [x,y]=e.dataset.o.split(/\\s+/).map(Number);e.style.transformOrigin=x+'px '+y+'px'})
if(s.classList.contains('p')){s.querySelectorAll('[data-role]').forEach(e=>{const t=P[e.dataset.role];if(t)e.style.transform=t})
s.querySelectorAll('[data-o]').forEach(e=>{const [x,y]=e.dataset.o.split(/\\s+/).map(Number);const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',5);c.setAttribute('class','pivot');s.appendChild(c)})}})
</script>`
const htmlPath = join(out, `creature-${slotArg}.html`)
writeFileSync(htmlPath, html)
const png = htmlPath.replace(/\.html$/, '.png')
const cols = Math.min(combos.length, 6)
const gridRows = Math.ceil(combos.length / cols)
execFileSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars', `--screenshot=${png}`, `--window-size=${cols * 216 + 12},${gridRows * 2 * 252 + 24}`, '--virtual-time-budget=1500', pathToFileURL(htmlPath).href], { stdio: 'ignore' })
console.log(png)
