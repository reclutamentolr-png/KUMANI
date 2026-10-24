import type { Drawing } from '../types'

// Macchinina sorridente sulla strada, con le colline, il sole e una nuvola
// (gli occhi stanno sul parabrezza, il sorriso sul muso davanti)
const drawing: Drawing = {
  id: 'macchinina',
  category: 'mezzi',
  level: 1,
  weight: { boy: 1.4, girl: 1 },
  figure: ['tetto', 'finestrino', 'carrozzeria', 'faro', 'ruotaSx', 'ruotaDx', 'cerchione'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="70 70">
  <path class="stroke" d="M106 70 L120 70 M95.5 95.5 L105.4 105.4 M70 106 L70 120 M44.5 95.5 L34.6 105.4 M34 70 L20 70 M44.5 44.5 L34.6 34.6 M70 34 L70 20 M95.5 44.5 L105.4 34.6"/>
</g>
<circle class="f" data-r="sole" cx="70" cy="70" r="28"/>
<g data-role="cloud"><path class="f" data-r="nuvola" transform="translate(214 8)" d="M52 82 A16 16 0 0 1 60 52 A24 24 0 0 1 104 46 A18 18 0 0 1 132 66 A14 14 0 0 1 128 82 Z"/></g>
<path class="f" data-r="prato" d="M2 300 Q90 262 190 292 T398 282 L398 354 L2 354 Z"/>
<path class="f" data-r="strada" d="M2 352 L398 352 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<path class="stroke" d="M24 404 L64 404 M114 404 L154 404 M204 404 L244 404 M294 404 L334 404"/>
<g data-role="figure" data-o="200 378">
  <path class="f" data-r="tetto" d="M96 236 L116 162 Q124 132 160 130 L242 130 Q272 132 284 162 L314 236 Z"/>
  <path class="f" data-r="finestrino" d="M124 224 L136 172 Q141 152 162 151 L190 151 L190 224 Z"/>
  <path class="f" data-r="finestrino" d="M208 151 L240 151 Q258 152 265 170 L284 224 L208 224 Z"/>
  <path class="f" data-r="carrozzeria" d="M56 330 L56 272 Q56 236 96 232 L310 232 Q346 236 352 276 L352 330 Q352 342 340 342 L68 342 Q56 342 56 330 Z"/>
  <path class="stroke" d="M200 240 L200 300 M212 258 L230 258"/>
  <ellipse class="f" data-r="faro" cx="330" cy="264" rx="13" ry="14"/>
  <path class="stroke" d="M284 292 Q310 318 338 294"/>
  <g data-role="eyes" data-o="239.5 188">
    <circle class="ink" cx="226" cy="188" r="11"/>
    <circle class="ink" cx="253" cy="188" r="11"/>
    <circle class="hl" cx="229.5" cy="184" r="3.2"/>
    <circle class="hl" cx="256.5" cy="184" r="3.2"/>
  </g>
  <g data-role="wheel" data-o="120 342">
    <circle class="f" data-r="ruotaSx" cx="120" cy="342" r="36"/>
    <circle class="f" data-r="cerchione" cx="120" cy="342" r="16"/>
    <circle class="ink" cx="120" cy="334" r="3.5"/>
    <circle class="ink" cx="126.9" cy="346" r="3.5"/>
    <circle class="ink" cx="113.1" cy="346" r="3.5"/>
  </g>
  <g data-role="wheel" data-o="288 342">
    <circle class="f" data-r="ruotaDx" cx="288" cy="342" r="36"/>
    <circle class="f" data-r="cerchione" cx="288" cy="342" r="16"/>
    <circle class="ink" cx="288" cy="334" r="3.5"/>
    <circle class="ink" cx="294.9" cy="346" r="3.5"/>
    <circle class="ink" cx="281.1" cy="346" r="3.5"/>
  </g>
  <text data-role="zzz" x="294" y="138">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
