import type { CreaturePart } from './types'

// Code (slot «coda»): gruppo data-role="tail" con perno in (262, 345).
// La base parte da dentro il corpo (x ~245–255) così resta nascosta anche
// quando la coda scodinzola.
const tail = (inner: string) => `
<g data-role="tail" data-o="262 345">${inner}</g>`

// Ventaglio del pavone: piume a smerlo intorno a (258, 342), dall'alto
// (-100°) fino a destra (+5°), con un «occhio» su ogni piuma
const PAVONE = (() => {
  const cx = 258
  const cy = 342
  const R = 110
  const n = 6
  const a0 = -100
  const a1 = 5
  const p = (r: number, deg: number) => {
    const t = (deg * Math.PI) / 180
    return `${Math.round(cx + r * Math.cos(t))} ${Math.round(cy + r * Math.sin(t))}`
  }
  const step = (a1 - a0) / n
  let fan = `M${cx} ${cy} L${p(R, a0)}`
  let lines = ''
  let eyes = ''
  for (let i = 0; i < n; i++) {
    fan += ` A19 19 0 0 1 ${p(R, a0 + step * (i + 1))}`
    const mid = a0 + step * (i + 0.5)
    lines += `M${p(40, mid)} L${p(R - 32, mid)} `
    const [ex, ey] = p(R - 20, mid).split(' ')
    eyes += `<ellipse class="f" data-r="ciuffoCoda" cx="${ex}" cy="${ey}" rx="10" ry="12" transform="rotate(${Math.round(mid + 90)} ${ex} ${ey})"/>`
  }
  fan += ' Z'
  return `<path class="f" data-r="coda" d="${fan}"/><path class="stroke" d="${lines.trim()}"/>${eyes}`
})()

export const TAILS: CreaturePart[] = [
  {
    // Lunga coda di gatto a esse, con la punta da colorare
    id: 'gatto',
    svg: tail(`<path class="f" data-r="coda" d="M246 338 C300 356 340 340 336 300 C333 270 312 258 318 230 C322 214 340 210 346 222 C338 240 350 258 356 284 C368 338 322 382 246 362 Z"/><path class="f" data-r="ciuffoCoda" d="M318 230 C322 214 340 210 346 222 C340 232 342 240 344 246 C334 248 322 244 317 238 Z"/>`),
  },
  {
    // Coda sottile da leone con il ciuffo in fondo
    id: 'leone',
    svg: tail(`<path class="f" data-r="coda" d="M246 340 C296 352 328 338 330 290 L331 262 L345 262 L344 292 C342 352 300 368 246 356 Z"/><path class="f" data-r="ciuffoCoda" d="M338 270 C318 272 306 258 314 244 C304 232 314 214 328 220 C330 206 350 206 352 220 C366 214 374 232 364 244 C372 258 358 274 338 270 Z"/>`),
  },
  {
    // Coda grossa da drago con le punte sul dorso e la punta a picca
    id: 'drago',
    svg: tail(`<path class="f" data-r="punteCoda" d="M268 332 L282 306 L294 330 Z M296 326 L314 300 L320 322 Z M318 312 L340 292 L338 314 Z M332 292 L356 282 L342 302 Z M336 254 L352 214 L368 254 Q352 264 336 254 Z"/><path class="f" data-r="coda" d="M246 326 C290 334 320 324 334 296 C340 284 342 270 344 252 L360 252 C362 278 360 296 350 318 C334 356 296 378 246 372 Z"/>`),
  },
  {
    // Pinna di pesce a due lobi
    id: 'pesce',
    svg: tail(`<path class="f" data-r="coda" d="M246 324 Q280 322 300 330 Q320 290 356 262 Q368 268 362 282 Q344 310 340 336 Q346 360 364 384 Q368 396 354 396 Q322 376 300 346 Q280 356 246 356 Z"/><path class="stroke" d="M310 334 Q330 304 352 278 M314 340 L340 338 M310 344 Q330 368 352 388"/>`),
  },
  {
    // Coda di volpe grande e soffice con la punta chiara
    id: 'volpe',
    svg: tail(`<path class="f" data-r="coda" d="M246 318 C276 312 296 292 300 262 C302 236 318 216 340 218 C362 220 374 246 370 278 C366 322 334 362 246 362 Z"/><path class="f" data-r="ciuffoCoda" d="M302 250 C308 228 322 216 340 218 C362 220 374 246 370 272 L356 262 L346 276 L336 260 L322 270 L316 254 Z"/>`),
  },
  {
    // Ventaglio del pavone, aperto dietro e a destra della creatura
    id: 'pavone',
    svg: tail(PAVONE),
  },
]

// Ali (slot «ali»): wingL con perno (168, 258), wingR con perno (232, 258).
// Si disegna solo l'ala sinistra; la destra è la stessa specchiata
// (x' = 400 − x), così le due sono identiche.
const wings = (left: string) => {
  const right = left.replace(/data-r="alaSx"/g, 'data-r="alaDx"')
  return `
<g data-role="wingL" data-o="168 258">${left}</g>
<g data-role="wingR" data-o="232 258"><g transform="matrix(-1 0 0 1 400 0)">${right}</g></g>`
}

export const WINGS: CreaturePart[] = [
  {
    // Ala d'uccello con le penne a smerlo
    id: 'uccello',
    svg: wings(`<path class="f" data-r="alaSx" d="M180 244 C150 200 92 166 40 170 Q34 204 64 218 Q56 248 90 252 Q86 280 118 278 Q118 304 148 298 Q154 316 180 300 Z"/><path class="stroke" d="M66 216 Q104 220 128 240 M92 250 Q122 252 142 262 M120 276 Q140 278 156 282"/>`),
  },
  {
    // Ala di farfalla: lobo grande in alto, lobo piccolo in basso, con le macchie
    id: 'farfalla',
    svg: wings(`<path class="f" data-r="alaSx" d="M178 270 C176 304 140 340 100 338 C64 336 60 302 82 288 C106 274 140 268 178 262 Z M178 258 C150 260 96 262 62 238 C36 220 34 180 56 164 C84 146 140 188 178 244 Z"/><circle class="f" data-r="macchieAli" cx="76" cy="196" r="17"/><circle class="f" data-r="macchieAli" cx="118" cy="226" r="11"/><circle class="f" data-r="macchieAli" cx="102" cy="310" r="13"/>`),
  },
  {
    // Ala da drago (pipistrello) con le dita disegnate
    id: 'drago',
    svg: wings(`<path class="f" data-r="alaSx" d="M180 246 Q144 190 100 162 Q66 166 34 198 Q58 224 58 262 Q86 266 100 296 Q128 290 148 314 Q160 302 180 298 Z"/><path class="stroke" d="M100 162 L58 262 M100 162 Q92 230 100 296 M100 162 Q126 236 148 314"/><path class="f" data-r="alaSx" d="M100 162 L92 146 L110 156 Z"/>`),
  },
  {
    // Ali da fata/ape: due ovali per lato
    id: 'fata',
    svg: wings(`<ellipse class="f" data-r="alaSx" cx="116" cy="294" rx="60" ry="26" transform="rotate(-24 116 294)"/><ellipse class="f" data-r="alaSx" cx="114" cy="208" rx="70" ry="34" transform="rotate(38 114 208)"/><path class="stroke" d="M154 240 Q110 214 72 182 M150 286 Q116 300 80 312"/>`),
  },
  {
    // Alette d'angelo tonde con le piume
    id: 'angelo',
    svg: wings(`<path class="f" data-r="alaSx" d="M180 246 C152 206 104 198 74 220 C56 234 60 256 78 260 C62 272 70 294 92 290 C86 308 106 320 124 308 C134 322 162 318 180 298 Z"/><path class="stroke" d="M84 258 Q120 258 152 266 M98 288 Q130 286 156 282 M124 306 Q144 302 160 294"/>`),
  },
]
