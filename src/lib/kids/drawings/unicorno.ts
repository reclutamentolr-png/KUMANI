import type { Drawing } from '../types'

// Unicorno nel prato con l'arcobaleno, due nuvole, stelline e fiori
const drawing: Drawing = {
  id: 'unicorno',
  category: 'fantasia',
  level: 3,
  weight: { boy: 1, girl: 1.4 },
  figure: ['coda', 'zampaSx', 'zampaDx', 'zoccoli', 'corpo', 'macchie', 'criniera', 'testa', 'muso', 'guance', 'orecchioSx', 'corno'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<path class="f" data-r="arcobaleno" d="M20 262 A180 180 0 0 1 380 262 L358 262 A158 158 0 0 0 42 262 Z"/>
<path class="f" data-r="arcobaleno2" d="M42 262 A158 158 0 0 1 358 262 L336 262 A136 136 0 0 0 64 262 Z"/>
<path class="f" data-r="arcobaleno3" d="M64 262 A136 136 0 0 1 336 262 L314 262 A114 114 0 0 0 86 262 Z"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M12 286 A13 13 0 0 1 20 260 A20 20 0 0 1 56 252 A16 16 0 0 1 84 266 A12 12 0 0 1 82 286 Z"/></g>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M318 286 A13 13 0 0 1 326 260 A20 20 0 0 1 362 252 A16 16 0 0 1 388 266 A12 12 0 0 1 386 286 Z"/></g>
<path class="f" data-r="stella" d="M44 36 L48.1 46.3 L59.2 47.1 L50.7 54.2 L53.4 64.9 L44 59 L34.6 64.9 L37.3 54.2 L28.8 47.1 L39.9 46.3 Z"/>
<path class="f" data-r="stella" d="M356 36 L360.1 46.3 L371.2 47.1 L362.7 54.2 L365.4 64.9 L356 59 L346.6 64.9 L349.3 54.2 L340.8 47.1 L351.9 46.3 Z"/>
<path class="f" data-r="prato" d="M2 384 Q100 368 200 380 T398 374 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="40 436">
  <path class="stroke" d="M40 410 L40 436"/>
  <circle class="f" data-r="fiore" cx="40" cy="386" r="10"/>
  <circle class="f" data-r="fiore" cx="51.4" cy="394.3" r="10"/>
  <circle class="f" data-r="fiore" cx="47.1" cy="407.7" r="10"/>
  <circle class="f" data-r="fiore" cx="32.9" cy="407.7" r="10"/>
  <circle class="f" data-r="fiore" cx="28.6" cy="394.3" r="10"/>
  <circle class="f" data-r="centroFiore" cx="40" cy="398" r="8"/>
</g>
<g data-role="plant" data-o="360 436">
  <path class="stroke" d="M360 414 L360 436"/>
  <circle class="f" data-r="fiore2" cx="360" cy="390" r="10"/>
  <circle class="f" data-r="fiore2" cx="371.4" cy="398.3" r="10"/>
  <circle class="f" data-r="fiore2" cx="367.1" cy="411.7" r="10"/>
  <circle class="f" data-r="fiore2" cx="352.9" cy="411.7" r="10"/>
  <circle class="f" data-r="fiore2" cx="348.6" cy="398.3" r="10"/>
  <circle class="f" data-r="centroFiore2" cx="360" cy="402" r="8"/>
</g>
<g data-role="figure" data-o="236 402">
  <g data-role="tail" data-o="318 262">
    <path class="f" data-r="coda" d="M314 250 C346 232 372 254 364 290 C358 314 362 334 368 350 C338 352 322 326 328 300 C332 284 324 274 310 272 Z"/>
    <path class="stroke" d="M330 258 Q350 262 348 288 M342 316 Q344 332 352 340"/>
  </g>
  <rect class="f" data-r="zampaSx" x="198" y="296" width="26" height="84" rx="10"/>
  <rect class="f" data-r="zampaDx" x="248" y="296" width="26" height="84" rx="10"/>
  <rect class="f" data-r="zoccoli" x="195" y="372" width="32" height="20" rx="6"/>
  <rect class="f" data-r="zoccoli" x="245" y="372" width="32" height="20" rx="6"/>
  <path class="f" data-r="corpo" d="M146 204 Q170 196 204 210 L240 258 L192 290 Q170 252 146 204 Z"/>
  <ellipse class="f" data-r="corpo" cx="236" cy="282" rx="86" ry="54"/>
  <rect class="f" data-r="zampaSx" x="160" y="300" width="30" height="88" rx="12"/>
  <rect class="f" data-r="zampaDx" x="284" y="300" width="30" height="88" rx="12"/>
  <rect class="f" data-r="zoccoli" x="157" y="380" width="36" height="22" rx="7"/>
  <rect class="f" data-r="zoccoli" x="281" y="380" width="36" height="22" rx="7"/>
  <path class="f" data-r="macchie" d="M282 264 L286.7 275.5 L299.1 276.4 L289.6 284.5 L292.6 296.6 L282 290 L271.4 296.6 L274.4 284.5 L264.9 276.4 L277.3 275.5 Z"/>
  <g data-role="head" data-o="186 226">
    <path class="f" data-r="criniera" d="M140 116 C168 92 210 102 214 134 C236 140 240 170 226 186 C246 198 246 228 224 238 C230 254 218 264 204 260 L188 232 C204 222 202 202 188 196 C202 184 198 160 182 156 C186 138 168 126 140 116 Z"/>
    <ellipse class="f" data-r="testa" cx="140" cy="170" rx="62" ry="56"/>
    <ellipse class="f" data-r="muso" cx="102" cy="202" rx="40" ry="28"/>
    <circle class="ink" cx="82" cy="196" r="3.5"/>
    <path class="stroke" d="M90 214 Q104 224 118 214"/>
    <circle class="f" data-r="guance" cx="154" cy="196" r="11"/>
    <path class="f" data-r="orecchioSx" d="M162 126 L180 76 L198 132 Z"/>
    <path class="f" data-r="criniera" d="M100 132 C108 110 132 104 150 112 C140 126 120 136 100 132 Z"/>
    <path class="f" data-r="corno" d="M112 120 L126 62 L142 116 Z"/>
    <path class="stroke" d="M118 104 L134 96 M122 88 L131 84"/>
    <g data-role="eyes" data-o="130 164">
      <ellipse class="ink" cx="130" cy="164" rx="9" ry="12"/>
      <circle class="hl" cx="133" cy="159" r="3.2"/>
      <path class="stroke" d="M121 154 L114 148 M126 151 L122 143"/>
    </g>
  </g>
  <text data-role="zzz" x="212" y="100">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
