import type { Drawing } from '../types'

// Tartaruga marina che nuota, con bolle, alghe, un sasso e una stella marina
const drawing: Drawing = {
  id: 'tartaruga',
  category: 'mare',
  level: 2,
  weight: { boy: 1, girl: 1 },
  figure: ['pinnaSx', 'pinnaDx', 'coda', 'testa', 'guance', 'guscio', 'macchie', 'pancia'],
  svg: `
<rect class="f" data-r="mare" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="water">
  <circle class="f" data-r="bolla" cx="36" cy="124" r="11"/>
  <circle class="f" data-r="bolla" cx="56" cy="88" r="9"/>
  <circle class="f" data-r="bolla" cx="38" cy="56" r="8"/>
</g>
<g data-role="water">
  <circle class="f" data-r="bolla" cx="352" cy="96" r="12"/>
  <circle class="f" data-r="bolla" cx="322" cy="58" r="9"/>
</g>
<path class="f" data-r="sabbia" d="M2 378 Q100 360 200 372 T398 366 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="360 378">
  <path class="f" data-r="alga" d="M348 380 C336 346 362 330 350 298 C344 282 354 268 362 262 C378 284 370 308 376 334 C382 356 372 368 372 380 Z"/>
</g>
<g data-role="plant" data-o="30 384">
  <path class="f" data-r="alga" d="M18 386 C16 356 34 340 26 314 C40 330 46 356 40 386 Z"/>
</g>
<path class="f" data-r="sasso" d="M246 400 Q252 368 290 366 Q326 368 332 400 Q290 410 246 400 Z"/>
<path class="f" data-r="stella" d="M96 376 L102.5 389.1 L116.9 391.2 L106.5 401.4 L108.9 415.8 L96 409 L83.1 415.8 L85.5 401.4 L75.1 391.2 L89.5 389.1 Z"/>
<g data-role="figure" data-o="224 330">
  <g data-role="tail" data-o="334 240">
    <path class="f" data-r="coda" d="M330 228 Q356 232 372 246 Q354 256 330 254 Z"/>
  </g>
  <path class="f" data-r="testa" d="M92 196 Q100 244 150 248 L146 196 Z"/>
  <path class="f" data-r="pancia" d="M110 236 L340 236 Q330 268 224 268 Q120 268 110 236 Z"/>
  <path class="f" data-r="guscio" d="M110 238 C114 152 168 118 224 118 C280 118 334 152 340 238 Z"/>
  <path class="f" data-r="macchie" d="M200 148 L248 148 L264 182 L248 216 L200 216 L184 182 Z"/>
  <path class="f" data-r="macchie" d="M142 172 L172 158 L184 182 L172 214 L132 216 Z"/>
  <path class="f" data-r="macchie" d="M306 172 L276 158 L264 182 L276 214 L316 216 Z"/>
  <g data-role="armR" data-o="296 256"><ellipse class="f" data-r="pinnaDx" cx="312" cy="290" rx="15" ry="38" transform="rotate(-28 312 290)"/></g>
  <g data-role="armL" data-o="176 256"><ellipse class="f" data-r="pinnaSx" cx="158" cy="298" rx="19" ry="46" transform="rotate(24 158 298)"/></g>
  <g data-role="head" data-o="110 214">
    <ellipse class="f" data-r="testa" cx="72" cy="186" rx="42" ry="38"/>
    <circle class="f" data-r="guance" cx="46" cy="200" r="9"/>
    <circle class="f" data-r="guance" cx="98" cy="200" r="9"/>
    <path class="stroke" d="M59 202 Q72 216 85 202"/>
    <g data-role="eyes" data-o="72 178">
      <circle class="ink" cx="58" cy="178" r="8"/>
      <circle class="ink" cx="86" cy="178" r="8"/>
      <circle class="hl" cx="60.5" cy="175.5" r="2.5"/>
      <circle class="hl" cx="88.5" cy="175.5" r="2.5"/>
    </g>
  </g>
  <text data-role="zzz" x="104" y="140">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
