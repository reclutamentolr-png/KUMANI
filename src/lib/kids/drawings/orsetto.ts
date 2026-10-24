import type { Drawing } from '../types'

// Orsetto nel prato con sole, nuvola e due fiori (il primo disegno, da cui
// nasce il formato di tutti gli altri)
const drawing: Drawing = {
  id: 'orsetto',
  category: 'animali',
  level: 1,
  weight: { boy: 1, girl: 1 },
  figure: ['braccioSx', 'braccioDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'orecchioSx', 'orecchioDx', 'testa', 'muso', 'naso', 'fiocco'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="330 60">
  <path class="f" data-r="raggi" d="M363.3 53.2 L382.0 60.0 L363.3 66.8 Z M358.3 78.8 L366.8 96.8 L348.8 88.3 Z M336.8 93.3 L330.0 112.0 L323.2 93.3 Z M311.2 88.3 L293.2 96.8 L301.7 78.8 Z M296.7 66.8 L278.0 60.0 L296.7 53.2 Z M301.7 41.2 L293.2 23.2 L311.2 31.7 Z M323.2 26.7 L330.0 8.0 L336.8 26.7 Z M348.8 31.7 L366.8 23.2 L358.3 41.2 Z"/>
</g>
<circle class="f" data-r="sole" cx="330" cy="60" r="30"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M52 82 A16 16 0 0 1 60 52 A24 24 0 0 1 104 46 A18 18 0 0 1 132 66 A14 14 0 0 1 128 82 Z"/></g>
<path class="f" data-r="prato" d="M2 392 Q110 352 210 382 T398 372 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<g data-role="plant" data-o="52 438">
  <path class="stroke" d="M52 411 L52 438"/>
  <circle class="f" data-r="fiore" cx="52" cy="393" r="9"/>
  <circle class="f" data-r="fiore" cx="62.5" cy="400.6" r="9"/>
  <circle class="f" data-r="fiore" cx="58.5" cy="412.9" r="9"/>
  <circle class="f" data-r="fiore" cx="45.5" cy="412.9" r="9"/>
  <circle class="f" data-r="fiore" cx="41.5" cy="400.6" r="9"/>
  <circle class="f" data-r="centroFiore" cx="52" cy="404" r="7"/>
</g>
<g data-role="plant" data-o="356 438">
  <path class="stroke" d="M356 407 L356 438"/>
  <circle class="f" data-r="fiore2" cx="356" cy="389" r="9"/>
  <circle class="f" data-r="fiore2" cx="366.5" cy="396.6" r="9"/>
  <circle class="f" data-r="fiore2" cx="362.5" cy="408.9" r="9"/>
  <circle class="f" data-r="fiore2" cx="349.5" cy="408.9" r="9"/>
  <circle class="f" data-r="fiore2" cx="345.5" cy="396.6" r="9"/>
  <circle class="f" data-r="centroFiore2" cx="356" cy="400" r="7"/>
</g>
<g data-role="figure" data-o="200 412">
  <g data-role="armL" data-o="142 240"><ellipse class="f" data-r="braccioSx" cx="128" cy="284" rx="24" ry="50" transform="rotate(18 128 284)"/></g>
  <g data-role="armR" data-o="258 240"><ellipse class="f" data-r="braccioDx" cx="272" cy="284" rx="24" ry="50" transform="rotate(-18 272 284)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="300" rx="82" ry="92"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="318" rx="52" ry="60"/>
  <ellipse class="f" data-r="piedeSx" cx="150" cy="388" rx="38" ry="24"/>
  <ellipse class="f" data-r="piedeDx" cx="250" cy="388" rx="38" ry="24"/>
  <g data-role="head" data-o="200 228">
    <circle class="f" data-r="orecchioSx" cx="140" cy="92" r="30"/>
    <circle class="f" data-r="orecchioDx" cx="260" cy="92" r="30"/>
    <circle class="f" data-r="testa" cx="200" cy="150" r="80"/>
    <ellipse class="f" data-r="muso" cx="200" cy="182" rx="40" ry="29"/>
    <ellipse class="f" data-r="naso" cx="200" cy="166" rx="13" ry="10"/>
    <path class="stroke" d="M200 176 L200 186 M186 188 Q200 200 214 188"/>
    <g data-role="eyes" data-o="200 136">
      <circle class="ink" cx="170" cy="136" r="8"/>
      <circle class="ink" cx="230" cy="136" r="8"/>
      <circle class="hl" cx="173" cy="133" r="2.5"/>
      <circle class="hl" cx="233" cy="133" r="2.5"/>
    </g>
  </g>
  <path class="f" data-r="fiocco" d="M200 226 L168 208 L168 244 Z M200 226 L232 208 L232 244 Z"/>
  <circle class="f" data-r="fiocco" cx="200" cy="226" r="9"/>
  <text data-role="zzz" x="282" y="92">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
