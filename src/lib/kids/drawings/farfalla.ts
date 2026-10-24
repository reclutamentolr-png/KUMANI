import type { Drawing } from '../types'

// Farfalla sorridente tra i fiori del prato, con il sole
const drawing: Drawing = {
  id: 'farfalla',
  category: 'natura',
  level: 1,
  weight: { boy: 1, girl: 1.3 },
  figure: ['alaSx', 'alaDx', 'macchie', 'corpo', 'testa'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<circle class="f" data-r="sole" cx="350" cy="52" r="28"/>
<path class="f" data-r="prato" d="M2 384 Q100 356 200 376 T398 368 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="58 438">
  <path class="stroke" d="M58 392 L58 438"/>
  <circle class="f" data-r="fiore" cx="58" cy="358" r="13"/>
  <circle class="f" data-r="fiore" cx="73.2" cy="369.1" r="13"/>
  <circle class="f" data-r="fiore" cx="67.4" cy="386.9" r="13"/>
  <circle class="f" data-r="fiore" cx="48.6" cy="386.9" r="13"/>
  <circle class="f" data-r="fiore" cx="42.8" cy="369.1" r="13"/>
  <circle class="f" data-r="centroFiore" cx="58" cy="374" r="12"/>
</g>
<g data-role="plant" data-o="342 438">
  <path class="stroke" d="M342 392 L342 438"/>
  <circle class="f" data-r="fiore2" cx="342" cy="358" r="13"/>
  <circle class="f" data-r="fiore2" cx="357.2" cy="369.1" r="13"/>
  <circle class="f" data-r="fiore2" cx="351.4" cy="386.9" r="13"/>
  <circle class="f" data-r="fiore2" cx="332.6" cy="386.9" r="13"/>
  <circle class="f" data-r="fiore2" cx="326.8" cy="369.1" r="13"/>
  <circle class="f" data-r="centroFiore2" cx="342" cy="374" r="12"/>
</g>
<g data-role="figure" data-o="200 336">
  <g data-role="wingL" data-o="192 240">
    <path class="f" data-r="alaSx" d="M194 232 C170 150 110 92 70 104 C38 114 44 176 76 206 C102 230 150 238 194 240 C150 246 100 266 96 302 C92 336 130 348 160 326 C182 310 192 280 196 252 Z"/>
    <circle class="f" data-r="macchie" cx="104" cy="160" r="22"/>
    <circle class="f" data-r="macchie" cx="134" cy="298" r="16"/>
  </g>
  <g data-role="wingR" data-o="208 240">
    <path class="f" data-r="alaDx" d="M206 232 C230 150 290 92 330 104 C362 114 356 176 324 206 C298 230 250 238 206 240 C250 246 300 266 304 302 C308 336 270 348 240 326 C218 310 208 280 204 252 Z"/>
    <circle class="f" data-r="macchie" cx="296" cy="160" r="22"/>
    <circle class="f" data-r="macchie" cx="266" cy="298" r="16"/>
  </g>
  <ellipse class="f" data-r="corpo" cx="200" cy="264" rx="20" ry="72"/>
  <path class="stroke" d="M184 246 Q200 254 216 246 M182 274 Q200 282 218 274 M186 302 Q200 310 214 302"/>
  <g data-role="head" data-o="200 194">
    <path class="stroke" d="M188 132 Q176 100 160 88 M212 132 Q224 100 240 88"/>
    <circle class="ink" cx="160" cy="88" r="7"/>
    <circle class="ink" cx="240" cy="88" r="7"/>
    <circle class="f" data-r="testa" cx="200" cy="162" r="36"/>
    <path class="stroke" d="M186 174 Q200 188 214 174"/>
    <g data-role="eyes" data-o="200 154">
      <circle class="ink" cx="186" cy="154" r="7"/>
      <circle class="ink" cx="214" cy="154" r="7"/>
      <circle class="hl" cx="188.5" cy="151.5" r="2.2"/>
      <circle class="hl" cx="216.5" cy="151.5" r="2.2"/>
    </g>
  </g>
  <text data-role="zzz" x="244" y="146">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
