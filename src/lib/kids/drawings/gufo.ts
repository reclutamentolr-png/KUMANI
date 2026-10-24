import type { Drawing } from '../types'

// Gufo sul ramo di un albero di notte, con la luna, le stelle e una nuvola
const drawing: Drawing = {
  id: 'gufo',
  category: 'animali',
  level: 2,
  weight: { boy: 1, girl: 1 },
  figure: ['alaSx', 'alaDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'orecchioSx', 'orecchioDx', 'testa', 'contornoOcchi', 'becco'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<path class="f" data-r="luna" d="M70 32 A34 34 0 1 0 98.9 84 A30 30 0 0 1 70 32 Z"/>
<path class="f" data-r="stella" d="M200 11 L204.1 20.3 L214.3 21.4 L206.7 28.2 L208.8 38.1 L200 33 L191.2 38.1 L193.3 28.2 L185.7 21.4 L195.9 20.3 Z"/>
<path class="f" data-r="stella" d="M44 135 L48.1 144.3 L58.3 145.4 L50.7 152.2 L52.8 162.1 L44 157 L35.2 162.1 L37.3 152.2 L29.7 145.4 L39.9 144.3 Z"/>
<path class="f" data-r="stella" d="M50 235 L54.1 244.3 L64.3 245.4 L56.7 252.2 L58.8 262.1 L50 257 L41.2 262.1 L43.3 252.2 L35.7 245.4 L45.9 244.3 Z"/>
<path class="f" data-r="stella" d="M226 391 L230.1 400.3 L240.3 401.4 L232.7 408.2 L234.8 418.1 L226 413 L217.2 418.1 L219.3 408.2 L211.7 401.4 L221.9 400.3 Z"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M52 428 A16 16 0 0 1 60 398 A24 24 0 0 1 104 392 A18 18 0 0 1 132 412 A14 14 0 0 1 128 428 Z"/></g>
<path class="f" data-r="ramo" d="M36 346 Q32 330 52 330 Q200 320 340 328 L340 362 Q200 354 58 364 Q38 364 36 346 Z"/>
<path class="f" data-r="tronco" d="M322 436 C332 380 324 320 326 260 C328 180 318 100 328 4 L376 4 C370 100 378 200 374 280 C372 350 374 400 376 436 Z"/>
<path class="stroke" d="M348 60 Q354 80 348 100 M352 380 Q358 400 352 418"/>
<g data-role="plant" data-o="98 334">
  <path class="f" data-r="chioma" d="M98 334 Q84 296 44 298 Q58 336 98 334 Z"/>
  <path class="f" data-r="chioma" d="M118 332 Q120 296 152 284 Q154 320 118 332 Z"/>
</g>
<g data-role="plant" data-o="290 358">
  <path class="f" data-r="chioma" d="M290 358 Q276 394 242 398 Q252 364 290 358 Z"/>
  <path class="f" data-r="chioma" d="M300 360 Q312 392 300 414 Q282 386 300 360 Z"/>
</g>
<g data-role="figure" data-o="200 350">
  <g data-role="wingL" data-o="152 232">
    <path class="f" data-r="alaSx" d="M160 224 C118 228 90 264 90 306 C90 322 102 330 118 324 C140 314 156 292 166 262 Z"/>
    <path class="stroke" d="M104 304 Q112 300 118 290 M114 318 Q124 312 130 302"/>
  </g>
  <g data-role="wingR" data-o="248 232">
    <path class="f" data-r="alaDx" d="M240 224 C282 228 310 264 310 306 C310 322 298 330 282 324 C260 314 244 292 234 262 Z"/>
    <path class="stroke" d="M296 304 Q288 300 282 290 M286 318 Q276 312 270 302"/>
  </g>
  <ellipse class="f" data-r="corpo" cx="200" cy="264" rx="76" ry="78"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="284" rx="48" ry="50"/>
  <path class="stroke" d="M178 262 Q185 272 192 262 M208 262 Q215 272 222 262 M193 288 Q200 298 207 288 M174 296 Q181 306 188 296 M212 296 Q219 306 226 296"/>
  <ellipse class="f" data-r="piedeSx" cx="174" cy="340" rx="22" ry="12"/>
  <ellipse class="f" data-r="piedeDx" cx="226" cy="340" rx="22" ry="12"/>
  <path class="stroke" d="M166 334 L166 346 M182 334 L182 346 M218 334 L218 346 M234 334 L234 346"/>
  <g data-role="head" data-o="200 212">
    <path class="f" data-r="orecchioSx" d="M132 116 L134 64 L174 96 Z"/>
    <path class="f" data-r="orecchioDx" d="M268 116 L266 64 L226 96 Z"/>
    <ellipse class="f" data-r="testa" cx="200" cy="150" rx="82" ry="66"/>
    <circle class="f" data-r="contornoOcchi" cx="167" cy="146" r="30"/>
    <circle class="f" data-r="contornoOcchi" cx="233" cy="146" r="30"/>
    <path class="stroke" d="M180 194 Q200 212 220 194"/>
    <path class="f" data-r="becco" d="M186 176 L214 176 L200 200 Z"/>
    <g data-role="eyes" data-o="200 146">
      <circle class="ink" cx="167" cy="146" r="13"/>
      <circle class="ink" cx="233" cy="146" r="13"/>
      <circle class="hl" cx="171" cy="141" r="4"/>
      <circle class="hl" cx="237" cy="141" r="4"/>
    </g>
  </g>
  <text data-role="zzz" x="276" y="104">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
