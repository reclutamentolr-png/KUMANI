import type { Drawing } from '../types'

// Pinguino sul pezzo di ghiaccio in mezzo al mare, con gli iceberg e la neve
// (le pinne salutano come braccia)
const drawing: Drawing = {
  id: 'pinguino',
  category: 'animali',
  level: 1,
  weight: { boy: 1, girl: 1 },
  figure: ['alaSx', 'alaDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'testa', 'muso', 'becco'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<path class="stroke" d="M54 50 L54 70 M45 55 L63 65 M45 65 L63 55 M346 56 L346 76 M337 61 L355 71 M337 71 L355 61 M80 168 L80 184 M73 172 L87 180 M73 180 L87 172 M326 160 L326 176 M319 164 L333 172 M319 172 L333 164 M196 30 L196 44 M190 34 L202 40 M190 40 L202 34"/>
<path class="f" data-r="ghiaccio" d="M14 348 L42 258 L70 288 L98 232 L132 348 Z"/>
<path class="f" data-r="ghiaccio" d="M290 348 L318 284 L342 306 L362 270 L390 348 Z"/>
<path class="f" data-r="mare" d="M2 344 Q51 334 100 344 T200 344 T300 344 T398 344 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="water">
  <path class="stroke" d="M18 372 Q28 364 38 372 Q48 380 58 372 M350 368 Q360 360 370 368 Q380 376 390 368"/>
</g>
<path class="f" data-r="ghiaccio" d="M30 400 Q30 386 50 386 L350 386 Q370 386 370 400 L362 418 Q358 428 346 428 L54 428 Q42 428 38 418 Z"/>
<g data-role="figure" data-o="200 404">
  <g data-role="armL" data-o="138 236"><path class="f" data-r="alaSx" d="M144 226 C112 238 90 280 92 324 C110 318 138 292 154 262 Z"/></g>
  <g data-role="armR" data-o="262 236"><path class="f" data-r="alaDx" d="M256 226 C288 238 310 280 308 324 C290 318 262 292 246 262 Z"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="296" rx="84" ry="100"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="314" rx="58" ry="76"/>
  <ellipse class="f" data-r="piedeSx" cx="166" cy="394" rx="32" ry="14"/>
  <ellipse class="f" data-r="piedeDx" cx="234" cy="394" rx="32" ry="14"/>
  <g data-role="head" data-o="200 226">
    <circle class="f" data-r="testa" cx="200" cy="160" r="70"/>
    <path class="f" data-r="muso" d="M200 132 C188 106 142 108 142 150 C142 194 178 212 200 214 C222 212 258 194 258 150 C258 108 212 106 200 132 Z"/>
    <path class="f" data-r="becco" d="M180 178 Q200 168 220 178 Q212 200 200 202 Q188 200 180 178 Z"/>
    <path class="stroke" d="M186 184 Q200 192 214 184"/>
    <g data-role="eyes" data-o="200 152">
      <circle class="ink" cx="176" cy="152" r="9"/>
      <circle class="ink" cx="224" cy="152" r="9"/>
      <circle class="hl" cx="179" cy="149" r="2.8"/>
      <circle class="hl" cx="227" cy="149" r="2.8"/>
    </g>
  </g>
  <text data-role="zzz" x="262" y="102">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
