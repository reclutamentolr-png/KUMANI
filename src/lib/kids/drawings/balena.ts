import type { Drawing } from '../types'

// Balena simpatica che sbuffa il getto d'acqua, con sole, nuvola e fondale
const drawing: Drawing = {
  id: 'balena',
  category: 'mare',
  level: 2,
  weight: { boy: 1.1, girl: 1 },
  figure: ['acqua', 'coda', 'corpo', 'pancia', 'guance', 'pinna'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="334 58">
  <path class="f" data-r="raggi" d="M362.1 52.4 L378 58 L362.1 63.6 Z M357.9 74.6 L365.1 89.9 L349.8 82.7 Z M339.6 86.1 L334 102 L328.4 86.1 Z M318.2 82.7 L302.9 89.9 L310.1 74.6 Z M305.9 63.6 L290 58 L305.9 52.4 Z M310.1 41.4 L302.9 26.1 L318.2 33.3 Z M328.4 29.9 L334 14 L339.6 29.9 Z M349.8 33.3 L365.1 26.1 L357.9 41.4 Z"/>
</g>
<circle class="f" data-r="sole" cx="334" cy="58" r="24"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M30 66 A13 13 0 0 1 36 42 A20 20 0 0 1 72 37 A15 15 0 0 1 95 53 A12 12 0 0 1 92 66 Z"/></g>
<path class="f" data-r="mare" d="M2 206 Q27 192 52 206 T102 206 T152 206 T202 206 T252 206 T302 206 T352 206 T398 204 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<path class="f" data-r="sabbia" d="M2 386 Q100 366 200 380 T398 372 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="44 390">
  <path class="f" data-r="alga" d="M32 392 C20 360 46 344 36 314 C30 298 40 286 46 280 C62 302 54 326 60 350 C66 372 56 382 56 392 Z"/>
</g>
<path class="f" data-r="conchiglia" d="M300 418 Q300 380 326 378 Q352 380 352 418 Q326 426 300 418 Z"/>
<path class="stroke" d="M326 386 L326 416 M313 390 L310 414 M339 390 L342 414"/>
<g data-role="figure" data-o="200 340">
  <g data-role="water">
    <path class="f" data-r="acqua" d="M142 164 L142 110 Q118 94 100 126 Q94 76 150 82 Q206 76 200 126 Q182 94 158 110 L158 164 Z"/>
    <circle class="f" data-r="acqua" cx="100" cy="144" r="7"/>
    <circle class="f" data-r="acqua" cx="200" cy="144" r="7"/>
  </g>
  <g data-role="tail" data-o="330 232">
    <path class="f" data-r="coda" d="M312 230 Q332 206 334 182 Q312 180 302 158 Q330 154 346 172 Q354 152 368 142 Q374 180 352 196 Q350 226 342 250 Z"/>
  </g>
  <path class="f" data-r="corpo" d="M60 252 C60 186 120 154 186 154 C250 154 296 184 322 214 Q334 228 338 244 Q312 300 250 318 C225 323 200 324 182 324 C108 324 60 302 60 252 Z"/>
  <path class="f" data-r="pancia" d="M64 274 Q170 300 294 284 C264 310 226 324 182 324 C120 324 76 306 64 274 Z"/>
  <path class="stroke" d="M112 300 Q170 314 236 306 M150 316 Q190 320 218 316"/>
  <circle class="f" data-r="guance" cx="140" cy="250" r="13"/>
  <path class="stroke" d="M72 248 Q96 268 126 254"/>
  <g data-role="eyes" data-o="112 218">
    <circle class="ink" cx="112" cy="218" r="10"/>
    <circle class="hl" cx="115" cy="215" r="3"/>
  </g>
  <g data-role="armR" data-o="214 290"><ellipse class="f" data-r="pinna" cx="238" cy="312" rx="16" ry="36" transform="rotate(-48 238 312)"/></g>
  <text data-role="zzz" x="228" y="150">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
