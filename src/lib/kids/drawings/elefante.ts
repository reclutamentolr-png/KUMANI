import type { Drawing } from '../types'

// Elefantino con le orecchie grandi e la proboscide arricciata, seduto nella
// savana con le colline, la palma, lo stagno e il sole
const drawing: Drawing = {
  id: 'elefante',
  category: 'animali',
  level: 2,
  weight: { boy: 1, girl: 1 },
  figure: ['coda', 'braccioSx', 'braccioDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'orecchioSx', 'orecchioDx', 'internoOrecchioSx', 'internoOrecchioDx', 'testa', 'guance', 'proboscide'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<circle class="f" data-r="sole" cx="200" cy="44" r="24"/>
<path class="f" data-r="montagna" d="M2 300 L2 236 Q66 176 136 228 Q200 170 268 226 Q336 180 398 232 L398 300 Z"/>
<path class="f" data-r="prato" d="M2 300 L398 300 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="44 392">
  <path class="f" data-r="tronco" d="M36 392 Q32 320 42 244 L56 246 Q48 320 58 392 Z"/>
  <path class="f" data-r="chioma" d="M48 246 Q18 182 6 206 Q36 220 48 246 Z M48 246 Q78 182 92 206 Q60 220 48 246 Z"/>
  <path class="f" data-r="chioma" d="M48 246 Q12 216 8 266 Q28 242 48 246 Z M48 246 Q84 216 88 266 Q68 242 48 246 Z"/>
</g>
<g data-role="water">
  <ellipse class="f" data-r="acqua" cx="338" cy="412" rx="48" ry="16"/>
</g>
<g data-role="figure" data-o="200 414">
  <g data-role="tail" data-o="276 362">
    <path class="f" data-r="coda" d="M272 354 Q302 350 312 326 Q318 314 330 320 Q332 334 322 344 Q306 366 276 374 Z"/>
  </g>
  <g data-role="armL" data-o="146 268"><ellipse class="f" data-r="braccioSx" cx="130" cy="310" rx="26" ry="46" transform="rotate(20 130 310)"/></g>
  <g data-role="armR" data-o="254 268"><ellipse class="f" data-r="braccioDx" cx="270" cy="310" rx="26" ry="46" transform="rotate(-20 270 310)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="320" rx="78" ry="84"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="340" rx="48" ry="52"/>
  <ellipse class="f" data-r="piedeSx" cx="152" cy="394" rx="40" ry="22"/>
  <ellipse class="f" data-r="piedeDx" cx="248" cy="394" rx="40" ry="22"/>
  <path class="stroke" d="M134 410 Q140 402 146 410 M158 410 Q164 402 170 410 M230 410 Q236 402 242 410 M254 410 Q260 402 266 410"/>
  <g data-role="head" data-o="200 236">
    <g data-role="ears" data-o="200 160">
      <ellipse class="f" data-r="orecchioSx" cx="124" cy="160" rx="52" ry="60"/>
      <ellipse class="f" data-r="orecchioDx" cx="276" cy="160" rx="52" ry="60"/>
      <ellipse class="f" data-r="internoOrecchioSx" cx="116" cy="162" rx="30" ry="40"/>
      <ellipse class="f" data-r="internoOrecchioDx" cx="284" cy="162" rx="30" ry="40"/>
    </g>
    <circle class="f" data-r="testa" cx="200" cy="160" r="70"/>
    <circle class="f" data-r="guance" cx="152" cy="186" r="13"/>
    <circle class="f" data-r="guance" cx="248" cy="186" r="13"/>
    <path class="stroke" d="M166 198 Q172 208 182 206 M234 198 Q228 208 218 206"/>
    <path class="f" data-r="proboscide" d="M180 182 Q200 166 220 182 Q213 200 211 236 Q209 254 220 254 Q234 254 238 240 Q240 229 249 229 Q260 230 258 242 Q250 270 220 274 Q186 276 185 238 Q187 200 180 182 Z"/>
    <path class="stroke" d="M186 206 L212 206 M186 222 L211 222"/>
    <g data-role="eyes" data-o="200 150">
      <circle class="ink" cx="170" cy="150" r="10"/>
      <circle class="ink" cx="230" cy="150" r="10"/>
      <circle class="hl" cx="174" cy="146" r="3.5"/>
      <circle class="hl" cx="234" cy="146" r="3.5"/>
    </g>
  </g>
  <text data-role="zzz" x="298" y="96">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
