import type { Drawing } from '../types'

// Leoncino con la criniera a due colori e il farfallino, seduto nella
// savana con l'acacia, il sasso, l'erba alta e il sole
const drawing: Drawing = {
  id: 'leone',
  category: 'animali',
  level: 3,
  weight: { boy: 1.2, girl: 1 },
  figure: ['coda', 'ciuffoCoda', 'braccioSx', 'braccioDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'criniera', 'criniera2', 'orecchioSx', 'orecchioDx', 'internoOrecchioSx', 'internoOrecchioDx', 'testa', 'ciuffo', 'guance', 'muso', 'naso', 'fiocco'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="64 64">
  <path class="f" data-r="raggi" d="M95.2 56.8 L114.0 64.0 L95.2 71.2 Z M91.1 81.0 L99.4 99.4 L81.0 91.1 Z M71.2 95.2 L64.0 114.0 L56.8 95.2 Z M47.0 91.1 L28.6 99.4 L36.9 81.0 Z M32.8 71.2 L14.0 64.0 L32.8 56.8 Z M36.9 47.0 L28.6 28.6 L47.0 36.9 Z M56.8 32.8 L64.0 14.0 L71.2 32.8 Z M81.0 36.9 L99.4 28.6 L91.1 47.0 Z"/>
</g>
<circle class="f" data-r="sole" cx="64" cy="64" r="28"/>
<path class="f" data-r="montagna" d="M2 330 L2 286 Q50 250 104 276 Q150 244 204 270 Q262 240 318 268 Q360 250 398 274 L398 330 Z"/>
<path class="f" data-r="prato" d="M2 318 Q100 306 200 316 T398 314 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="344 392">
  <path class="f" data-r="tronco" d="M336 392 L338 300 Q330 262 300 236 L312 230 Q338 252 346 280 Q352 252 376 232 L386 240 Q360 264 354 300 L356 392 Z"/>
  <path class="f" data-r="chioma" d="M284 232 Q280 204 314 200 Q330 180 360 188 Q392 184 392 210 Q398 236 368 238 L304 240 Q284 242 284 232 Z"/>
</g>
<path class="f" data-r="sasso" d="M282 424 Q280 398 304 392 Q330 388 334 410 Q336 424 324 424 Z"/>
<g data-role="plant" data-o="36 428">
  <path class="f" data-r="erba" d="M14 428 L18 392 L30 414 L38 382 L46 414 L58 394 L60 428 Z"/>
</g>
<g data-role="figure" data-o="200 414">
  <g data-role="tail" data-o="138 386">
    <path class="f" data-r="coda" d="M142 406 Q56 410 52 320 L68 318 Q72 386 142 386 Z"/>
    <path class="f" data-r="ciuffoCoda" d="M60 332 Q34 306 60 276 Q86 306 60 332 Z"/>
  </g>
  <g data-role="armL" data-o="148 282"><ellipse class="f" data-r="braccioSx" cx="132" cy="321" rx="21" ry="42" transform="rotate(22 132 321)"/></g>
  <g data-role="armR" data-o="252 282"><ellipse class="f" data-r="braccioDx" cx="268" cy="321" rx="21" ry="42" transform="rotate(-22 268 321)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="328" rx="70" ry="80"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="346" rx="42" ry="50"/>
  <ellipse class="f" data-r="piedeSx" cx="160" cy="398" rx="36" ry="18"/>
  <ellipse class="f" data-r="piedeDx" cx="240" cy="398" rx="36" ry="18"/>
  <path class="stroke" d="M152 404 L152 414 M166 404 L166 414 M234 404 L234 414 M248 404 L248 414"/>
  <g data-role="head" data-o="200 262">
    <path class="f" data-r="criniera" d="M200.0 84.0 Q225.0 66.3 239.9 93.1 Q270.1 88.1 271.9 118.6 Q301.3 127.2 289.7 155.5 Q312.5 176.0 289.7 196.5 Q301.3 224.8 271.9 233.4 Q270.1 263.9 239.9 258.9 Q225.0 285.7 200.0 268.0 Q175.0 285.7 160.1 258.9 Q129.9 263.9 128.1 233.4 Q98.7 224.8 110.3 196.5 Q87.5 176.0 110.3 155.5 Q98.7 127.2 128.1 118.6 Q129.9 88.1 160.1 93.1 Q175.0 66.3 200.0 84.0 Z"/>
    <path class="f" data-r="criniera2" d="M218.6 106.5 Q243.5 100.7 250.9 125.1 Q275.3 132.5 269.5 157.4 Q286.9 176.0 269.5 194.6 Q275.3 219.5 250.9 226.9 Q243.5 251.3 218.6 245.5 Q200.0 262.9 181.4 245.5 Q156.5 251.3 149.1 226.9 Q124.7 219.5 130.5 194.6 Q113.1 176.0 130.5 157.4 Q124.7 132.5 149.1 125.1 Q156.5 100.7 181.4 106.5 Q200.0 89.1 218.6 106.5 Z"/>
    <g data-role="ears" data-o="200 140">
      <circle class="f" data-r="orecchioSx" cx="154" cy="132" r="19"/>
      <circle class="f" data-r="orecchioDx" cx="246" cy="132" r="19"/>
      <circle class="f" data-r="internoOrecchioSx" cx="152" cy="130" r="9"/>
      <circle class="f" data-r="internoOrecchioDx" cx="248" cy="130" r="9"/>
    </g>
    <circle class="f" data-r="testa" cx="200" cy="178" r="58"/>
    <path class="f" data-r="ciuffo" d="M178 128 Q180 108 194 116 Q200 100 206 116 Q220 108 222 128 Q200 138 178 128 Z"/>
    <circle class="f" data-r="guance" cx="157" cy="200" r="11"/>
    <circle class="f" data-r="guance" cx="243" cy="200" r="11"/>
    <ellipse class="f" data-r="muso" cx="200" cy="206" rx="32" ry="21"/>
    <path class="f" data-r="naso" d="M187 192 Q200 186 213 192 Q208 203 200 206 Q192 203 187 192 Z"/>
    <path class="stroke" d="M200 206 L200 213 M186 215 Q193 223 200 213 Q207 223 214 215"/>
    <circle class="ink" cx="182" cy="206" r="2.2"/>
    <circle class="ink" cx="176" cy="213" r="2.2"/>
    <circle class="ink" cx="218" cy="206" r="2.2"/>
    <circle class="ink" cx="224" cy="213" r="2.2"/>
    <g data-role="eyes" data-o="200 170">
      <circle class="ink" cx="176" cy="170" r="9"/>
      <circle class="ink" cx="224" cy="170" r="9"/>
      <circle class="hl" cx="179.5" cy="166.5" r="3"/>
      <circle class="hl" cx="227.5" cy="166.5" r="3"/>
    </g>
  </g>
  <path class="f" data-r="fiocco" d="M200 288 L172 274 L172 302 Z M200 288 L228 274 L228 302 Z"/>
  <circle class="f" data-r="fiocco" cx="200" cy="288" r="8"/>
  <text data-role="zzz" x="298" y="100">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
