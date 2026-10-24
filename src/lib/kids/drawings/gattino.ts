import type { Drawing } from '../types'

// Gattino col collare e il campanello, seduto sul tappeto di casa, con la
// finestra, il quadro col pesce e il gomitolo
const drawing: Drawing = {
  id: 'gattino',
  category: 'animali',
  level: 2,
  weight: { boy: 1, girl: 1.2 },
  figure: ['coda', 'braccioSx', 'braccioDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'orecchioSx', 'orecchioDx', 'internoOrecchioSx', 'internoOrecchioDx', 'testa', 'muso', 'naso', 'collare', 'campanello'],
  svg: `
<rect class="f" data-r="parete" x="2" y="2" width="396" height="436" rx="18"/>
<rect class="f" data-r="finestra" x="24" y="36" width="96" height="112" rx="10"/>
<path class="stroke" d="M72 36 L72 148 M24 92 L120 92"/>
<path class="f" data-r="pavimento" d="M2 332 L398 332 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<ellipse class="f" data-r="tappeto" cx="200" cy="406" rx="156" ry="26"/>
<rect class="f" data-r="quadro" x="300" y="150" width="76" height="70" rx="8"/>
<path class="f" data-r="pesce" d="M310 185 Q333 160 356 185 Q333 210 310 185 Z M352 185 L370 169 L370 201 Z"/>
<circle class="ink" cx="323" cy="181" r="3.5"/>
<path class="stroke" d="M84 372 Q106 350 128 362 Q138 368 146 360"/>
<circle class="f" data-r="gomitolo" cx="58" cy="380" r="30"/>
<path class="stroke" d="M36 362 Q58 378 54 410 M46 352 Q74 368 76 400 M30 386 Q50 392 66 408"/>
<g data-role="figure" data-o="200 412">
  <g data-role="tail" data-o="252 380">
    <path class="f" data-r="coda" d="M246 398 Q344 404 346 324 Q346 282 312 282 Q292 286 300 306 Q320 306 320 326 Q318 374 246 374 Z"/>
  </g>
  <g data-role="armL" data-o="150 262"><ellipse class="f" data-r="braccioSx" cx="134" cy="302" rx="21" ry="44" transform="rotate(22 134 302)"/></g>
  <g data-role="armR" data-o="250 262"><ellipse class="f" data-r="braccioDx" cx="266" cy="302" rx="21" ry="44" transform="rotate(-22 266 302)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="312" rx="68" ry="90"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="336" rx="40" ry="52"/>
  <ellipse class="f" data-r="piedeSx" cx="158" cy="396" rx="36" ry="19"/>
  <ellipse class="f" data-r="piedeDx" cx="242" cy="396" rx="36" ry="19"/>
  <path class="stroke" d="M150 402 L150 413 M164 402 L164 413 M236 402 L236 413 M250 402 L250 413"/>
  <g data-role="head" data-o="200 246">
    <g data-role="ears" data-o="200 120">
      <path class="f" data-r="orecchioSx" d="M114 150 L120 82 Q122 64 140 72 L196 106 Z"/>
      <path class="f" data-r="orecchioDx" d="M286 150 L280 82 Q278 64 260 72 L204 106 Z"/>
      <path class="f" data-r="internoOrecchioSx" d="M132 126 L135 90 L170 112 Z"/>
      <path class="f" data-r="internoOrecchioDx" d="M268 126 L265 90 L230 112 Z"/>
    </g>
    <ellipse class="f" data-r="testa" cx="200" cy="172" rx="86" ry="72"/>
    <path class="stroke" d="M160 200 L122 192 M160 210 L122 214 M240 200 L278 192 M240 210 L278 214"/>
    <ellipse class="f" data-r="muso" cx="200" cy="206" rx="36" ry="24"/>
    <path class="f" data-r="naso" d="M187 190 Q200 185 213 190 Q208 200 200 203 Q192 200 187 190 Z"/>
    <path class="stroke" d="M200 203 L200 210 M186 213 Q193 222 200 210 Q207 222 214 213"/>
    <g data-role="eyes" data-o="200 164">
      <ellipse class="ink" cx="166" cy="164" rx="10" ry="13"/>
      <ellipse class="ink" cx="234" cy="164" rx="10" ry="13"/>
      <circle class="hl" cx="170" cy="159" r="3.5"/>
      <circle class="hl" cx="238" cy="159" r="3.5"/>
    </g>
  </g>
  <path class="f" data-r="collare" d="M152 240 Q200 262 248 240 L248 256 Q200 280 152 256 Z"/>
  <circle class="f" data-r="campanello" cx="200" cy="280" r="13"/>
  <path class="stroke" d="M194 284 L206 284"/>
  <text data-role="zzz" x="300" y="128">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
