import type { Drawing } from '../types'

// Pesciolino a strisce sotto il mare, con bolle, alghe, conchiglia e stella marina
const drawing: Drawing = {
  id: 'pesciolino',
  category: 'mare',
  level: 1,
  weight: { boy: 1, girl: 1 },
  figure: ['coda', 'pinna', 'corpo', 'strisce', 'pinnaSx'],
  svg: `
<rect class="f" data-r="mare" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="water">
  <circle class="f" data-r="bolla" cx="86" cy="146" r="14"/>
  <circle class="f" data-r="bolla" cx="64" cy="102" r="12"/>
  <circle class="f" data-r="bolla" cx="90" cy="62" r="12"/>
</g>
<g data-role="water">
  <circle class="f" data-r="bolla" cx="318" cy="84" r="13"/>
  <circle class="f" data-r="bolla" cx="346" cy="46" r="12"/>
</g>
<path class="f" data-r="sabbia" d="M2 378 Q100 358 200 372 T398 364 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="52 384">
  <path class="f" data-r="alga" d="M40 386 C26 344 58 322 42 282 C36 264 46 248 54 240 C72 264 62 296 70 326 C78 352 66 372 66 386 Z"/>
</g>
<g data-role="plant" data-o="350 378">
  <path class="f" data-r="alga" d="M338 380 C326 346 352 330 340 298 C334 282 344 268 352 262 C368 284 360 308 366 334 C372 356 362 368 362 380 Z"/>
</g>
<path class="f" data-r="stella" d="M130 382 L135.9 395.9 L150.9 397.2 L139.5 407.1 L142.9 421.8 L130 414 L117.1 421.8 L120.5 407.1 L109.1 397.2 L124.1 395.9 Z"/>
<path class="f" data-r="conchiglia" d="M262 414 Q262 372 290 370 Q318 372 318 414 Q290 422 262 414 Z"/>
<path class="stroke" d="M290 378 L290 412 M276 382 L272 410 M304 382 L308 410"/>
<g data-role="figure" data-o="220 300">
  <g data-role="tail" data-o="300 200">
    <path class="f" data-r="coda" d="M292 200 L352 146 Q376 150 368 176 Q358 200 368 224 Q376 250 352 254 Z"/>
  </g>
  <path class="f" data-r="pinna" d="M164 140 Q196 84 248 96 Q262 116 262 144 Z"/>
  <path class="f" data-r="pinna" d="M196 262 Q226 304 252 296 Q256 276 248 254 Z"/>
  <ellipse class="f" data-r="corpo" cx="210" cy="200" rx="100" ry="72"/>
  <path class="f" data-r="strisce" d="M172 133.4 A100 72 0 0 1 194 128.9 L194 271.1 A100 72 0 0 1 172 266.6 Z"/>
  <path class="f" data-r="strisce" d="M240 131.3 A100 72 0 0 1 266 140.4 L266 259.6 A100 72 0 0 1 240 268.7 Z"/>
  <path class="f" data-r="pinnaSx" d="M206 206 Q236 184 262 212 Q248 244 206 206 Z"/>
  <path class="stroke" d="M122 214 Q134 228 150 218"/>
  <g data-role="eyes" data-o="146 180">
    <circle class="ink" cx="146" cy="180" r="11"/>
    <circle class="hl" cx="150" cy="176" r="3.5"/>
  </g>
  <text data-role="zzz" x="150" y="122">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
