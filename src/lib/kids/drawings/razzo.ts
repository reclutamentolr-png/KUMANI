import type { Drawing } from '../types'

// Razzo sorridente nello spazio, tra stelle, luna e un pianeta con l'anello
// (la faccia sta nell'oblò, la fiamma pulsa sotto l'ugello)
const drawing: Drawing = {
  id: 'razzo',
  category: 'mezzi',
  level: 2,
  weight: { boy: 1.3, girl: 1 },
  figure: ['punta', 'corpo', 'fascia', 'bordoOblo', 'oblo', 'alettoneSx', 'alettoneDx', 'ugello', 'fiamma', 'fiammaInterna'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<path class="f" data-r="luna" d="M69.6 50 A34 34 0 1 0 100.6 98.7 A30 30 0 0 1 69.6 50 Z"/>
<path class="f" data-r="stella" d="M338.0 45.0 L342.8 55.4 L354.2 56.7 L345.8 64.5 L348.0 75.8 L338.0 70.2 L328.0 75.8 L330.2 64.5 L321.8 56.7 L333.2 55.4 Z M352.0 180.0 L356.5 189.8 L367.2 191.1 L359.3 198.4 L361.4 208.9 L352.0 203.7 L342.6 208.9 L344.7 198.4 L336.8 191.1 L347.5 189.8 Z M46.0 216.0 L50.5 225.8 L61.2 227.1 L53.3 234.4 L55.4 244.9 L46.0 239.7 L36.6 244.9 L38.7 234.4 L30.8 227.1 L41.5 225.8 Z M52.0 325.0 L56.2 334.2 L66.3 335.4 L58.8 342.2 L60.8 352.1 L52.0 347.2 L43.2 352.1 L45.2 342.2 L37.7 335.4 L47.8 334.2 Z"/>
<path class="stroke" d="M130 40 L130 52 M124 46 L136 46 M290 120 L290 132 M284 126 L296 126 M90 160 L90 172 M84 166 L96 166 M118 410 L118 422 M112 416 L124 416"/>
<g data-role="water">
  <path class="f" data-r="anello" d="M260 372 A62 22 0 0 1 384 372 L364 372 A42 10 0 0 0 280 372 Z"/>
  <circle class="f" data-r="pianeta" cx="322" cy="372" r="36"/>
  <path class="stroke" d="M300 348 Q312 344 322 352"/>
  <path class="f" data-r="anello" d="M260 372 A62 22 0 0 0 384 372 L364 372 A42 10 0 0 1 280 372 Z"/>
</g>
<g data-role="figure" data-o="200 420">
  <g data-role="flame" data-o="200 346">
    <path class="f" data-r="fiamma" d="M164 346 C156 370 164 388 174 402 C176 392 180 386 184 382 C186 400 192 412 200 424 C208 412 214 400 216 382 C220 386 224 392 226 402 C236 388 244 370 236 346 Z"/>
    <path class="f" data-r="fiammaInterna" d="M182 346 C178 364 186 380 200 398 C214 380 222 364 218 346 Z"/>
  </g>
  <path class="f" data-r="alettoneSx" d="M146 232 C112 254 98 292 100 344 Q122 326 152 318 Z"/>
  <path class="f" data-r="alettoneDx" d="M254 232 C288 254 302 292 300 344 Q278 326 248 318 Z"/>
  <path class="f" data-r="ugello" d="M168 316 L232 316 L242 348 L158 348 Z"/>
  <path class="f" data-r="corpo" d="M148 122 Q200 136 252 122 C258 160 260 200 258 240 L250 322 L150 322 L142 240 C140 200 142 160 148 122 Z"/>
  <path class="f" data-r="fascia" d="M146 282 Q200 296 254 282 L250 322 L150 322 Z"/>
  <path class="f" data-r="punta" d="M148 122 C156 86 176 62 200 50 C224 62 244 86 252 122 Q200 136 148 122 Z"/>
  <circle class="f" data-r="bordoOblo" cx="200" cy="204" r="46"/>
  <circle class="f" data-r="oblo" cx="200" cy="204" r="35"/>
  <path class="stroke" d="M186 220 Q200 232 214 220"/>
  <g data-role="eyes" data-o="200 198">
    <circle class="ink" cx="186" cy="198" r="7"/>
    <circle class="ink" cx="214" cy="198" r="7"/>
    <circle class="hl" cx="188.5" cy="195.5" r="2.2"/>
    <circle class="hl" cx="216.5" cy="195.5" r="2.2"/>
  </g>
  <text data-role="zzz" x="262" y="150">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
