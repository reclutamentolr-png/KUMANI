import type { Drawing } from '../types'

// Cagnolino con le orecchie a penzoloni e la lingua fuori, seduto in
// giardino davanti alla sua cuccia, con l'albero, il sole, la nuvola e l'osso
const drawing: Drawing = {
  id: 'cagnolino',
  category: 'animali',
  level: 2,
  weight: { boy: 1.1, girl: 1 },
  figure: ['coda', 'braccioSx', 'braccioDx', 'corpo', 'pancia', 'piedeSx', 'piedeDx', 'testa', 'macchie', 'muso', 'naso', 'lingua', 'orecchioSx', 'orecchioDx', 'collare', 'medaglietta'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="66 60">
  <path class="f" data-r="raggi" d="M96.5 54.6 L114.0 60.0 L96.5 65.4 Z M93.9 73.6 L104.8 88.2 L87.5 82.3 Z M80.6 87.4 L80.8 105.7 L70.3 90.7 Z M61.7 90.7 L51.2 105.7 L51.4 87.4 Z M44.5 82.3 L27.2 88.2 L38.1 73.6 Z M35.5 65.4 L18.0 60.0 L35.5 54.6 Z M38.1 46.4 L27.2 31.8 L44.5 37.7 Z M51.4 32.6 L51.2 14.3 L61.7 29.3 Z M70.3 29.3 L80.8 14.3 L80.6 32.6 Z M87.5 37.7 L104.8 31.8 L93.9 46.4 Z"/>
</g>
<circle class="f" data-r="sole" cx="66" cy="60" r="27"/>
<g data-role="cloud"><path class="f" data-r="nuvola" d="M300 60 A14 14 0 0 1 308 34 A21 21 0 0 1 348 28 A16 16 0 0 1 372 48 A12 12 0 0 1 368 60 Z"/></g>
<g data-role="plant" data-o="50 390">
  <rect class="f" data-r="tronco" x="36" y="236" width="28" height="156" rx="4"/>
  <path class="f" data-r="chioma" d="M30 262 A30 30 0 0 1 16 210 A34 34 0 0 1 48 152 A36 36 0 0 1 100 178 A30 30 0 0 1 86 258 A30 30 0 0 1 30 262 Z"/>
</g>
<path class="f" data-r="cuccia" d="M302 300 L382 300 L382 392 L302 392 Z"/>
<path class="f" data-r="tetto" d="M290 306 L342 252 L394 306 Z"/>
<path class="stroke" d="M323 392 L323 354 A19 19 0 0 1 361 354 L361 392"/>
<path class="f" data-r="prato" d="M2 384 Q110 370 210 382 T398 380 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<path class="f" data-r="osso" d="M320 404 A9 9 0 1 0 312 416 A9 9 0 1 0 320 428 L360 428 A9 9 0 1 0 368 416 A9 9 0 1 0 360 404 Z"/>
<g data-role="figure" data-o="200 412">
  <g data-role="tail" data-o="150 382">
    <path class="f" data-r="coda" d="M154 396 Q98 396 84 332 Q82 314 98 316 Q110 362 158 370 Z"/>
  </g>
  <g data-role="armL" data-o="150 262"><ellipse class="f" data-r="braccioSx" cx="134" cy="302" rx="21" ry="44" transform="rotate(22 134 302)"/></g>
  <g data-role="armR" data-o="250 262"><ellipse class="f" data-r="braccioDx" cx="266" cy="302" rx="21" ry="44" transform="rotate(-22 266 302)"/></g>
  <ellipse class="f" data-r="corpo" cx="200" cy="312" rx="68" ry="90"/>
  <ellipse class="f" data-r="pancia" cx="200" cy="336" rx="40" ry="52"/>
  <ellipse class="f" data-r="piedeSx" cx="158" cy="396" rx="36" ry="19"/>
  <ellipse class="f" data-r="piedeDx" cx="242" cy="396" rx="36" ry="19"/>
  <path class="stroke" d="M150 402 L150 413 M164 402 L164 413 M236 402 L236 413 M250 402 L250 413"/>
  <g data-role="head" data-o="200 246">
    <ellipse class="f" data-r="testa" cx="200" cy="170" rx="80" ry="70"/>
    <ellipse class="f" data-r="macchie" cx="234" cy="156" rx="24" ry="22"/>
    <ellipse class="f" data-r="muso" cx="200" cy="202" rx="40" ry="28"/>
    <path class="f" data-r="lingua" d="M188 211 L212 211 Q213 238 200 238 Q187 238 188 211 Z"/>
    <path class="stroke" d="M200 222 L200 230"/>
    <ellipse class="f" data-r="naso" cx="200" cy="188" rx="15" ry="11"/>
    <path class="stroke" d="M200 199 L200 207 M182 206 Q191 217 200 207 Q209 217 218 206"/>
    <g data-role="ears" data-o="200 118">
      <path class="f" data-r="orecchioSx" d="M146 110 Q102 104 96 164 Q94 214 122 218 Q146 212 150 168 Z"/>
      <path class="f" data-r="orecchioDx" d="M254 110 Q298 104 304 164 Q306 214 278 218 Q254 212 250 168 Z"/>
    </g>
    <g data-role="eyes" data-o="200 158">
      <circle class="ink" cx="168" cy="158" r="10"/>
      <circle class="ink" cx="232" cy="158" r="10"/>
      <circle class="hl" cx="172" cy="154" r="3.5"/>
      <circle class="hl" cx="236" cy="154" r="3.5"/>
    </g>
  </g>
  <path class="f" data-r="collare" d="M152 240 Q200 262 248 240 L248 256 Q200 280 152 256 Z"/>
  <circle class="f" data-r="medaglietta" cx="200" cy="281" r="14"/>
  <text data-role="zzz" x="286" y="104">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
