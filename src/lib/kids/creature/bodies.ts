import type { CreaturePart } from './types'

// Aiuti di disegno. I pezzi a destra sono lo specchio di quelli a sinistra
// (asse x = 200): così restano perfettamente simmetrici.
const r1 = (n: number) => Math.round(n * 10) / 10
const mirror = (svg: string) => `<g transform="matrix(-1 0 0 1 400 0)">${svg.replace(/Sx/g, 'Dx')}</g>`

// Macchia morbida e irregolare (curva chiusa che passa per i punti)
function blob(cx: number, cy: number, r: number, wob: number[], tilt = 0): string {
  const n = wob.length
  const pts = wob.map((k, i) => {
    const a = tilt + (i * 2 * Math.PI) / n
    return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a) * 0.85]
  })
  const p = (i: number) => pts[(i + n) % n]
  let d = `M${r1(p(0)[0])} ${r1(p(0)[1])}`
  for (let i = 0; i < n; i++) {
    const [p0, a, b, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    d += ` C${r1(a[0] + (b[0] - p0[0]) / 6)} ${r1(a[1] + (b[1] - p0[1]) / 6)} ${r1(b[0] - (p3[0] - a[0]) / 6)} ${r1(b[1] - (p3[1] - a[1]) / 6)} ${r1(b[0])} ${r1(b[1])}`
  }
  return `<path class="f" data-r="macchie" d="${d} Z"/>`
}

// Sagoma comune dei corpi morbidi: spalle larghe (coprono l'attacco delle
// braccia in 146,250 e 254,250) e fondo tondo (mezza ellisse 200,300 72×94)
const BODY = `<path class="f" data-r="corpo" d="M168 214 H232 A40 40 0 0 1 272 254 V300 A72 94 0 0 1 200 394 A72 94 0 0 1 128 300 V254 A40 40 0 0 1 168 214 Z"/>`

// Strisce della tigre (lato sinistro): la base segue il bordo del corpo
const STRIPES_L = `
<path class="f" data-r="strisce" d="M128 264 Q156 264 176 275 Q156 288 128 286 Z"/>
<path class="f" data-r="strisce" d="M133.5 336 A72 94 0 0 1 129.1 316 Q156 314 178 326 Q158 336 133.5 336 Z"/>
<path class="f" data-r="strisce" d="M145.9 362 A72 94 0 0 1 137.2 346 Q158 344 174 353 Q160 362 145.9 362 Z"/>`

// Placche del drago: fasce orizzontali dentro l'ellisse 200,318 48×62
const PLATES = [
  'M200 256 A48 62 0 0 1 237.9 280 L162.1 280 A48 62 0 0 1 200 256 Z',
  'M162.1 280 L237.9 280 A48 62 0 0 1 246.8 304 L153.2 304 A48 62 0 0 1 162.1 280 Z',
  'M153.2 304 L246.8 304 A48 62 0 0 1 247.4 328 L152.6 328 A48 62 0 0 1 153.2 304 Z',
  'M152.6 328 L247.4 328 A48 62 0 0 1 240.1 352 L159.9 352 A48 62 0 0 1 152.6 328 Z',
  'M159.9 352 L240.1 352 A48 62 0 0 1 159.9 352 Z',
]

// Corpi (slot «corpo»): centro 200,300, dentro x 122–278, y 212–394
export const BODIES: CreaturePart[] = [
  {
    id: 'tondo',
    svg: `${BODY}
<ellipse class="f" data-r="pancia" cx="200" cy="318" rx="50" ry="58"/>`,
  },
  {
    id: 'macchie',
    svg: `${BODY}
${blob(157, 292, 18, [1, 1.15, 0.9, 1.1, 0.85, 1.05])}
${blob(240, 270, 15, [1.1, 0.9, 1.05, 0.85, 1.15, 0.95], 0.5)}
${blob(236, 340, 18, [0.95, 1.1, 0.85, 1.15, 0.9, 1.05], 0.3)}
${blob(172, 352, 13, [1.1, 0.9, 1.1, 0.95, 1.05, 0.85], 0.8)}
${blob(204, 306, 14, [0.9, 1.1, 1, 0.85, 1.15, 1], 0.2)}
${blob(196, 254, 12, [1.05, 0.9, 1.1, 0.95, 1, 0.9], 1)}`,
  },
  {
    id: 'strisce',
    svg: `${BODY}${STRIPES_L}${mirror(STRIPES_L)}`,
  },
  {
    id: 'piume',
    svg: `${BODY}
<path class="f" data-r="piume" d="M152 302 C152 268 174 252 200 252 C226 252 248 268 248 302 L246 338 A1 1 0 0 1 223 357 A1 1 0 0 1 200 364 A1 1 0 0 1 177 357 A1 1 0 0 1 154 338 Z"/>
<path class="stroke" d="M164 316 A1 1 0 0 0 182 316 A1 1 0 0 0 200 316 A1 1 0 0 0 218 316 A1 1 0 0 0 236 316 M173 288 A1 1 0 0 0 191 288 A1 1 0 0 0 209 288 A1 1 0 0 0 227 288"/>`,
  },
  {
    id: 'robot',
    svg: `
<rect class="f" data-r="corpo" x="124" y="216" width="152" height="176" rx="34"/>
<rect class="f" data-r="pancia" x="156" y="258" width="88" height="66" rx="14"/>
<path class="stroke" d="M168 292 H182 L188 278 L196 306 L204 284 L210 292 H232"/>
<circle class="f" data-r="bottoni" cx="174" cy="352" r="10"/>
<circle class="f" data-r="bottoni" cx="200" cy="352" r="10"/>
<circle class="f" data-r="bottoni" cx="226" cy="352" r="10"/>
<path class="stroke" d="M140 240 h0 M260 240 h0 M140 372 h0 M260 372 h0"/>`,
  },
  {
    id: 'drago',
    svg: `${BODY}
${PLATES.map((d) => `<path class="f" data-r="placche" d="${d}"/>`).join('\n')}
<path class="stroke" d="M138 298 q7 7 14 0 M142 322 q7 7 14 0 M248 298 q7 7 14 0 M244 322 q7 7 14 0"/>`,
  },
]

// Braccia (slot «braccia»): ogni braccio è disegnato dritto in giù dal perno
// (146,250), poi inclinato verso l'esterno; il destro è lo specchio.
// Entro ~20px dal perno tutto resta nascosto sotto ogni corpo.
function arms(id: string, left: string, tilt: number): CreaturePart {
  const l = `<g transform="rotate(${tilt} 146 250)">${left}</g>`
  return {
    id,
    svg: `
<g data-role="armL" data-o="146 250">${l}</g>
<g data-role="armR" data-o="254 250">${mirror(l)}</g>`,
  }
}

export const ARMS: CreaturePart[] = [
  arms(
    'zampeOrso',
    `<ellipse class="f" data-r="braccioSx" cx="146" cy="292" rx="24" ry="50"/>
<path class="stroke" d="M138 335 v6 M146 336 v6 M154 335 v6"/>`,
    38,
  ),
  arms(
    'artigli',
    `<path class="f" data-r="braccioSx" d="M131 248 C129 280 130 310 131 322 A15 15 0 0 0 161 322 C162 310 163 280 161 248 A15 15 0 0 0 131 248 Z"/>
<path class="stroke" d="M137 333 L132 346 M146 337 L146 350 M155 333 L160 346 M139 290 q7 6 14 0 M139 304 q7 6 14 0"/>`,
    38,
  ),
  arms(
    'alette',
    `<path class="f" data-r="braccioSx" d="M134 252 C120 282 124 318 142 336 Q150 343 155 333 C166 312 166 282 158 252 A12 12 0 0 0 134 252 Z"/>`,
    42,
  ),
  arms(
    'tentacoli',
    `<path class="f" data-r="braccioSx" d="M159 250 C164 274 150 290 154 310 C158 326 168 332 164 342 A8 8 0 0 1 148 340 C150 330 136 322 132 306 C128 288 140 272 133 250 A13 13 0 0 1 159 250 Z"/>
<circle class="stroke" cx="148" cy="298" r="3"/><circle class="stroke" cx="150" cy="314" r="3"/><circle class="stroke" cx="156" cy="328" r="2.5"/>`,
    34,
  ),
  arms(
    'robot',
    `<rect class="f" data-r="braccioSx" x="136" y="244" width="20" height="82" rx="10"/>
<path class="stroke" d="M136 286 h20 M136 296 h20"/>
<path class="f" data-r="maniSx" d="M127 326 A19 19 0 0 1 165 326 L163 348 Q159 353 155 348 L153 334 Q146 327 139 334 L137 348 Q133 353 129 348 Z"/>`,
    32,
  ),
  arms(
    'scimmia',
    `<rect class="f" data-r="braccioSx" x="136" y="244" width="20" height="100" rx="10"/>
<ellipse class="f" data-r="maniSx" cx="161" cy="342" rx="7" ry="10" transform="rotate(-30 161 342)"/>
<ellipse class="f" data-r="maniSx" cx="146" cy="350" rx="16" ry="14"/>`,
    28,
  ),
]

// Piedi (slot «piedi»): centrati su 155,392 e 245,392, dentro y 368–414
const feet = (id: string, left: string): CreaturePart => ({ id, svg: `\n${left}\n${mirror(left)}` })

const wheel = (cx: number) => `
<g data-role="wheel" data-o="${cx} 392">
<circle class="f" data-r="ruote" cx="${cx}" cy="392" r="22"/>
<circle class="stroke" cx="${cx}" cy="392" r="14"/>
<path class="stroke" d="M${cx} 378 V406 M${cx - 14} 392 H${cx + 14} M${cx - 10} 382 L${cx + 10} 402 M${cx + 10} 382 L${cx - 10} 402"/>
<circle class="f" data-r="ruote" cx="${cx}" cy="392" r="6"/>
</g>`

export const FEET: CreaturePart[] = [
  feet(
    'zampeOrso',
    `<ellipse class="f" data-r="piedeSx" cx="155" cy="392" rx="36" ry="21"/>
<path class="stroke" d="M144 411 V403 M166 411 V403"/>`,
  ),
  feet(
    'zoccoli',
    `<path class="f" data-r="piedeSx" d="M131 410 L136 378 Q155 368 174 378 L179 410 Q155 416 131 410 Z"/>
<path class="stroke" d="M155 397 V412 M135 396 Q155 390 175 396"/>`,
  ),
  feet(
    'uccello',
    `<path class="f" data-r="piedeSx" d="M147 368 L147 390 C138 394 126 398 122 404 C120 410 126 413 132 410 L146 404 C146 410 150 414 155 414 C160 414 164 410 164 404 L178 410 C184 413 190 410 188 404 C184 398 172 394 163 390 L163 368 Z"/>`,
  ),
  feet(
    'stivali',
    `<path class="f" data-r="piedeSx" d="M139 368 H173 V402 H124 Q124 386 139 384 Z"/>
<path class="stroke" d="M139 377 H173"/>
<rect class="f" data-r="suole" x="121" y="400" width="55" height="13" rx="6.5"/>`,
  ),
  { id: 'ruote', svg: `${wheel(155)}${wheel(245)}` },
  feet(
    'pinne',
    `<path class="f" data-r="piedeSx" d="M149 368 H161 V382 L186 398 A1 1 0 0 1 165.3 402 A1 1 0 0 1 144.7 402 A1 1 0 0 1 124 398 L149 382 Z"/>
<path class="stroke" d="M155 386 L163 398 M155 386 L147 398"/>`,
  ),
]
