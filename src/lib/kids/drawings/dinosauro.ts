import type { Drawing } from '../types'

// Dinosauro simpatico in piedi, con le placche sulla testa e sulla coda,
// tra un vulcano che fuma, una palma, un sasso e un uovo
const drawing: Drawing = {
  id: 'dinosauro',
  category: 'fantasia',
  level: 3,
  weight: { boy: 1.3, girl: 1 },
  figure: ['coda', 'placche', 'macchie', 'braccioSx', 'braccioDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'testa', 'muso', 'guance'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="58 58">
  <path class="stroke" d="M90 58 L102 58 M80.6 80.6 L89.1 89.1 M58 90 L58 102 M35.4 80.6 L26.9 89.1 M26 58 L14 58 M35.4 35.4 L26.9 26.9 M58 26 L58 14 M80.6 35.4 L89.1 26.9"/>
</g>
<circle class="f" data-r="sole" cx="58" cy="58" r="24"/>
<g data-role="cloud">
  <circle class="f" data-r="fumo" cx="318" cy="144" r="15"/>
  <circle class="f" data-r="fumo" cx="340" cy="112" r="19"/>
</g>
<path class="f" data-r="vulcano" d="M232 372 L300 178 Q306 166 318 170 Q330 162 342 172 L398 316 L398 372 Z"/>
<path class="f" data-r="lava" d="M300 178 Q306 166 318 170 Q330 162 342 172 L350 194 Q344 208 336 196 Q330 220 320 200 Q312 214 306 198 Q300 206 293 198 Z"/>
<path class="f" data-r="tronco" d="M52 392 Q54 300 70 210 L88 212 Q76 300 76 392 Z"/>
<path class="stroke" d="M57 360 L75 362 M60 320 L78 324 M64 280 L81 284 M68 244 L85 248"/>
<g data-role="plant" data-o="78 208">
  <path class="f" data-r="palma" d="M78 208 Q40 156 8 200 Q48 192 78 208 Z"/>
  <path class="f" data-r="palma" d="M78 208 Q116 156 146 198 Q108 192 78 208 Z"/>
  <path class="f" data-r="palma" d="M78 208 Q58 136 18 140 Q54 172 78 208 Z"/>
  <path class="f" data-r="palma" d="M78 208 Q98 136 136 138 Q104 172 78 208 Z"/>
</g>
<path class="f" data-r="prato" d="M2 372 Q100 356 200 368 T398 364 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<path class="f" data-r="sasso" d="M318 420 Q314 396 340 392 Q368 390 372 414 Q372 424 360 424 L328 424 Q318 424 318 420 Z"/>
<ellipse class="f" data-r="uovo" cx="56" cy="406" rx="18" ry="22"/>
<path class="stroke" d="M39 404 L47 398 L54 406 L61 398 L68 406 L73 401"/>
<g data-role="figure" data-o="200 410">
  <g data-role="tail" data-o="262 350">
    <path class="f" data-r="placche" d="M298 327 L310 302 L322 321 Z M322 314 L328 288 L344 303 Z"/>
    <path class="f" data-r="coda" d="M250 324 C296 334 330 322 350 286 C362 300 360 334 340 356 C318 378 280 382 254 376 Z"/>
    <circle class="f" data-r="macchie" cx="298" cy="352" r="10"/>
    <circle class="f" data-r="macchie" cx="330" cy="334" r="8"/>
  </g>
  <g data-role="armL" data-o="146 262"><ellipse class="f" data-r="braccioSx" cx="112" cy="292" rx="14" ry="28" transform="rotate(40 112 292)"/></g>
  <g data-role="armR" data-o="254 262"><ellipse class="f" data-r="braccioDx" cx="288" cy="292" rx="14" ry="28" transform="rotate(-40 288 292)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="302" rx="80" ry="88"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="318" rx="50" ry="62"/>
  <circle class="f" data-r="macchie" cx="138" cy="328" r="9"/>
  <circle class="f" data-r="macchie" cx="262" cy="328" r="9"/>
  <path class="stroke" d="M162 290 Q200 300 238 290 M152 320 Q200 332 248 320 M160 350 Q200 360 240 350"/>
  <ellipse class="f" data-r="piedeSx" cx="154" cy="390" rx="38" ry="20"/>
  <ellipse class="f" data-r="piedeDx" cx="246" cy="390" rx="38" ry="20"/>
  <path class="stroke" d="M136 400 L136 408 M154 402 L154 410 M172 400 L172 408 M228 400 L228 408 M246 402 L246 410 M264 400 L264 408"/>
  <g data-role="head" data-o="200 228">
    <path class="f" data-r="placche" d="M158 112 L172 76 L188 98 L200 62 L212 98 L228 76 L242 112 Z"/>
    <ellipse class="f" data-r="testa" cx="200" cy="162" rx="74" ry="68"/>
    <path class="f" data-r="muso" d="M129 180 Q200 164 271 180 A74 68 0 0 1 129 180 Z"/>
    <circle class="f" data-r="guance" cx="150" cy="162" r="10"/>
    <circle class="f" data-r="guance" cx="250" cy="162" r="10"/>
    <circle class="ink" cx="188" cy="190" r="3.5"/>
    <circle class="ink" cx="212" cy="190" r="3.5"/>
    <path class="stroke" d="M168 204 Q200 226 232 204"/>
    <g data-role="eyes" data-o="200 138">
      <circle class="ink" cx="174" cy="138" r="9.5"/>
      <circle class="ink" cx="226" cy="138" r="9.5"/>
      <circle class="hl" cx="177" cy="135" r="3"/>
      <circle class="hl" cx="229" cy="135" r="3"/>
    </g>
  </g>
  <text data-role="zzz" x="270" y="104">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
