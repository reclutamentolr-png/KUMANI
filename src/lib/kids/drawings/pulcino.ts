import type { Drawing } from '../types'

// Pulcino nell'aia davanti alla staccionata, con il guscio da cui è appena
// uscito, il sole e una nuvola
const drawing: Drawing = {
  id: 'pulcino',
  category: 'animali',
  level: 1,
  weight: { boy: 1, girl: 1.1 },
  figure: ['alaSx', 'alaDx', 'corpo', 'pancia', 'zampaSx', 'zampaDx', 'testa', 'cresta', 'becco', 'guance'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="70 70">
  <path class="f" data-r="raggi" d="M103.5 75.6 L119.9 90.7 L97.7 89.7 Z M89.7 97.7 L90.7 119.9 L75.6 103.5 Z M64.4 103.5 L49.3 119.9 L50.3 97.7 Z M42.3 89.7 L20.1 90.7 L36.5 75.6 Z M36.5 64.4 L20.1 49.3 L42.3 50.3 Z M50.3 42.3 L49.3 20.1 L64.4 36.5 Z M75.6 36.5 L90.7 20.1 L89.7 42.3 Z M97.7 50.3 L119.9 49.3 L103.5 64.4 Z"/>
</g>
<circle class="f" data-r="sole" cx="70" cy="70" r="30"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M282 96 A15 15 0 0 1 290 68 A23 23 0 0 1 332 62 A17 17 0 0 1 358 82 A13 13 0 0 1 354 96 Z"/></g>
<path class="f" data-r="staccionata" d="M2 300 L398 300 L398 320 L2 320 Z M2 342 L398 342 L398 362 L2 362 Z"/>
<path class="f" data-r="staccionata" d="M26 288 L38 272 L50 288 L50 390 L26 390 Z M86 288 L98 272 L110 288 L110 390 L86 390 Z M290 288 L302 272 L314 288 L314 390 L290 390 Z M350 288 L362 272 L374 288 L374 390 L350 390 Z"/>
<path class="f" data-r="prato" d="M2 380 Q100 368 200 380 T398 382 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<path class="f" data-r="guscio" d="M310 418 Q306 370 340 366 Q374 370 370 418 Z"/>
<path class="stroke" d="M308 396 L320 386 L330 398 L342 384 L352 398 L362 386 L372 396"/>
<g data-role="figure" data-o="200 410">
  <g data-role="wingL" data-o="120 296"><ellipse class="f" data-r="alaSx" cx="100" cy="318" rx="20" ry="38" transform="rotate(42 100 318)"/></g>
  <g data-role="wingR" data-o="280 296"><ellipse class="f" data-r="alaDx" cx="300" cy="318" rx="20" ry="38" transform="rotate(-42 300 318)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="310" rx="92" ry="84"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="330" rx="56" ry="50"/>
  <path class="f" data-r="zampaSx" d="M140 412 Q140 388 166 386 Q192 388 192 412 Q182 404 175 412 Q166 402 157 412 Q150 404 140 412 Z"/>
  <path class="f" data-r="zampaDx" d="M260 412 Q260 388 234 386 Q208 388 208 412 Q218 404 225 412 Q234 402 243 412 Q250 404 260 412 Z"/>
  <g data-role="head" data-o="200 240">
    <path class="f" data-r="cresta" d="M186 102 Q170 78 186 66 Q196 82 200 96 Q204 70 222 70 Q226 88 214 102 Z"/>
    <circle class="f" data-r="testa" cx="200" cy="170" r="72"/>
    <circle class="f" data-r="guance" cx="146" cy="194" r="14"/>
    <circle class="f" data-r="guance" cx="254" cy="194" r="14"/>
    <path class="f" data-r="becco" d="M176 192 Q200 176 224 192 Q212 220 200 222 Q188 220 176 192 Z"/>
    <path class="stroke" d="M180 196 Q200 210 220 196"/>
    <g data-role="eyes" data-o="200 162">
      <circle class="ink" cx="170" cy="162" r="10"/>
      <circle class="ink" cx="230" cy="162" r="10"/>
      <circle class="hl" cx="174" cy="158" r="3.2"/>
      <circle class="hl" cx="234" cy="158" r="3.2"/>
    </g>
  </g>
  <text data-role="zzz" x="270" y="118">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
