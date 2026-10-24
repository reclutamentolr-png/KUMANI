import type { Drawing } from '../types'

// Coniglietto seduto nell'orto, con l'arcobaleno, due nuvole e le carote
const drawing: Drawing = {
  id: 'coniglietto',
  category: 'animali',
  level: 1,
  weight: { boy: 1, girl: 1.2 },
  figure: ['braccioSx', 'braccioDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'orecchioSx', 'orecchioDx', 'internoOrecchioSx', 'internoOrecchioDx', 'testa', 'naso'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<path class="f" data-r="arcobaleno" d="M55 392 A145 145 0 0 1 345 392 L312 392 A112 112 0 0 0 88 392 Z"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M36 92 A15 15 0 0 1 44 64 A22 22 0 0 1 86 58 A17 17 0 0 1 112 78 A13 13 0 0 1 108 92 Z"/></g>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M282 64 A13 13 0 0 1 290 40 A20 20 0 0 1 328 36 A15 15 0 0 1 352 52 A12 12 0 0 1 348 64 Z"/></g>
<path class="f" data-r="prato" d="M2 386 Q100 362 200 378 T398 378 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="32 412">
  <path class="stroke" d="M32 392 Q22 372 14 366 M32 392 L32 362 M32 392 Q42 372 50 366"/>
  <path class="f" data-r="carota" d="M14 394 Q32 386 50 394 L34 432 Q32 436 30 432 Z"/>
</g>
<g data-role="plant" data-o="368 412">
  <path class="stroke" d="M368 390 Q358 370 350 364 M368 390 L368 360 M368 390 Q378 370 386 364"/>
  <path class="f" data-r="carota" d="M350 392 Q368 384 386 392 L370 430 Q368 434 366 430 Z"/>
</g>
<g data-role="figure" data-o="200 414">
  <g data-role="armL" data-o="148 263"><ellipse class="f" data-r="braccioSx" cx="132" cy="304" rx="22" ry="44" transform="rotate(22 132 304)"/></g>
  <g data-role="armR" data-o="252 263"><ellipse class="f" data-r="braccioDx" cx="268" cy="304" rx="22" ry="44" transform="rotate(-22 268 304)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="320" rx="64" ry="82"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="336" rx="40" ry="52"/>
  <ellipse class="f" data-r="piedeSx" cx="156" cy="396" rx="38" ry="20"/>
  <ellipse class="f" data-r="piedeDx" cx="244" cy="396" rx="38" ry="20"/>
  <g data-role="head" data-o="200 248">
    <g data-role="ears" data-o="200 150">
      <ellipse class="f" data-r="orecchioSx" cx="164" cy="114" rx="24" ry="48" transform="rotate(-12 164 114)"/>
      <ellipse class="f" data-r="orecchioDx" cx="236" cy="114" rx="24" ry="48" transform="rotate(12 236 114)"/>
      <ellipse class="f" data-r="internoOrecchioSx" cx="164" cy="110" rx="12" ry="32" transform="rotate(-12 164 114)"/>
      <ellipse class="f" data-r="internoOrecchioDx" cx="236" cy="110" rx="12" ry="32" transform="rotate(12 236 114)"/>
    </g>
    <ellipse class="f" data-r="testa" cx="200" cy="184" rx="78" ry="66"/>
    <path class="stroke" d="M146 204 L120 198 M146 213 L120 216 M254 204 L280 198 M254 213 L280 216"/>
    <ellipse class="f" data-r="naso" cx="200" cy="200" rx="13" ry="10"/>
    <path class="stroke" d="M200 210 L200 218 M186 220 Q193 230 200 218 Q207 230 214 220"/>
    <g data-role="eyes" data-o="200 178">
      <circle class="ink" cx="170" cy="178" r="9"/>
      <circle class="ink" cx="230" cy="178" r="9"/>
      <circle class="hl" cx="173.5" cy="174.5" r="3"/>
      <circle class="hl" cx="233.5" cy="174.5" r="3"/>
    </g>
  </g>
  <text data-role="zzz" x="286" y="162">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
