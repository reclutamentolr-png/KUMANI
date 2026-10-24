import type { Drawing } from '../types'

// Trenino a vapore sorridente con un vagone, sul binario tra montagne e
// fiori (il fumo esce dal comignolo, le ruote girano)
const drawing: Drawing = {
  id: 'trenino',
  category: 'mezzi',
  level: 3,
  weight: { boy: 1.3, girl: 1 },
  figure: ['fumo', 'tettoVagone', 'vagone', 'finestrinoVagone', 'telaio', 'comignolo', 'caldaia', 'locomotiva', 'tetto', 'finestrino', 'muso', 'guance', 'ruotaVagone', 'ruotaLocomotiva'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="60 62">
  <path class="stroke" d="M94 62 L106 62 M84 86 L92.5 94.5 M60 96 L60 108 M36 86 L27.5 94.5 M26 62 L14 62 M36 38 L27.5 29.5 M60 28 L60 16 M84 38 L92.5 29.5"/>
</g>
<circle class="f" data-r="sole" cx="60" cy="62" r="26"/>
<g data-role="cloud"><path class="f" data-r="nuvola" transform="translate(236 2)" d="M52 82 A16 16 0 0 1 60 52 A24 24 0 0 1 104 46 A18 18 0 0 1 132 66 A14 14 0 0 1 128 82 Z"/></g>
<path class="f" data-r="montagna" d="M2 300 L2 236 L64 176 L112 220 L172 150 L246 228 L300 186 L398 270 L398 300 Z"/>
<path class="f" data-r="prato" d="M2 296 Q120 276 220 292 T398 288 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<rect class="f" data-r="traversine" x="16" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="60" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="104" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="148" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="192" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="236" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="280" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="324" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="traversine" x="368" y="366" width="24" height="26" rx="4"/>
<rect class="f" data-r="binario" x="2" y="360" width="396" height="14"/>
<g data-role="plant" data-o="46 438">
  <path class="stroke" d="M46 424 L46 438"/>
  <circle class="f" data-r="fiore" cx="46.0" cy="399.0" r="8"/>
  <circle class="f" data-r="fiore" cx="54.6" cy="405.2" r="8"/>
  <circle class="f" data-r="fiore" cx="51.3" cy="415.3" r="8"/>
  <circle class="f" data-r="fiore" cx="40.7" cy="415.3" r="8"/>
  <circle class="f" data-r="fiore" cx="37.4" cy="405.2" r="8"/>
  <circle class="f" data-r="centroFiore" cx="46" cy="408" r="6.5"/>
</g>
<g data-role="plant" data-o="354 438">
  <path class="stroke" d="M354 424 L354 438"/>
  <circle class="f" data-r="fiore" cx="354.0" cy="399.0" r="8"/>
  <circle class="f" data-r="fiore" cx="362.6" cy="405.2" r="8"/>
  <circle class="f" data-r="fiore" cx="359.3" cy="415.3" r="8"/>
  <circle class="f" data-r="fiore" cx="348.7" cy="415.3" r="8"/>
  <circle class="f" data-r="fiore" cx="345.4" cy="405.2" r="8"/>
  <circle class="f" data-r="centroFiore" cx="354" cy="408" r="6.5"/>
</g>
<g data-role="figure" data-o="200 360">
  <g data-role="cloud">
    <circle class="f" data-r="fumo" cx="280" cy="168" r="12"/>
    <circle class="f" data-r="fumo" cx="256" cy="138" r="17"/>
    <circle class="f" data-r="fumo" cx="218" cy="104" r="22"/>
  </g>
  <path class="f" data-r="tettoVagone" d="M34 232 Q34 214 50 214 L168 214 Q184 214 184 232 Z"/>
  <rect class="f" data-r="vagone" x="42" y="226" width="134" height="86" rx="8"/>
  <rect class="f" data-r="finestrinoVagone" x="56" y="244" width="42" height="36" rx="9"/>
  <rect class="f" data-r="finestrinoVagone" x="120" y="244" width="42" height="36" rx="9"/>
  <rect class="f" data-r="telaio" x="36" y="306" width="146" height="20" rx="7"/>
  <path class="stroke" d="M182 318 L190 318"/>
  <path class="f" data-r="comignolo" d="M266 230 L266 204 L258 186 L298 186 L290 204 L290 230 Z"/>
  <rect class="f" data-r="caldaia" x="246" y="226" width="86" height="86" rx="10"/>
  <rect class="f" data-r="locomotiva" x="188" y="172" width="70" height="140" rx="6"/>
  <rect class="f" data-r="tetto" x="178" y="156" width="90" height="22" rx="9"/>
  <rect class="f" data-r="finestrino" x="202" y="192" width="42" height="40" rx="9"/>
  <rect class="f" data-r="telaio" x="182" y="306" width="186" height="20" rx="7"/>
  <circle class="f" data-r="muso" cx="332" cy="266" r="36"/>
  <circle class="f" data-r="guance" cx="310" cy="280" r="7.5"/>
  <circle class="f" data-r="guance" cx="354" cy="280" r="7.5"/>
  <path class="stroke" d="M320 282 Q332 293 344 282"/>
  <g data-role="eyes" data-o="332 256">
    <circle class="ink" cx="320" cy="256" r="6.5"/>
    <circle class="ink" cx="344" cy="256" r="6.5"/>
    <circle class="hl" cx="322.3" cy="253.7" r="2"/>
    <circle class="hl" cx="346.3" cy="253.7" r="2"/>
  </g>
  <g data-role="wheel" data-o="74 338">
    <circle class="f" data-r="ruotaVagone" cx="74" cy="338" r="22"/>
    <circle class="stroke" cx="74" cy="338" r="6"/>
    <path class="stroke" d="M74 322 L74 331 M74 345 L74 354 M58 338 L67 338 M81 338 L90 338"/>
  </g>
  <g data-role="wheel" data-o="144 338">
    <circle class="f" data-r="ruotaVagone" cx="144" cy="338" r="22"/>
    <circle class="stroke" cx="144" cy="338" r="6"/>
    <path class="stroke" d="M144 322 L144 331 M144 345 L144 354 M128 338 L137 338 M151 338 L160 338"/>
  </g>
  <g data-role="wheel" data-o="214 338">
    <circle class="f" data-r="ruotaLocomotiva" cx="214" cy="338" r="22"/>
    <circle class="stroke" cx="214" cy="338" r="6"/>
    <path class="stroke" d="M214 322 L214 331 M214 345 L214 354 M198 338 L207 338 M221 338 L230 338"/>
  </g>
  <g data-role="wheel" data-o="270 338">
    <circle class="f" data-r="ruotaLocomotiva" cx="270" cy="338" r="22"/>
    <circle class="stroke" cx="270" cy="338" r="6"/>
    <path class="stroke" d="M270 322 L270 331 M270 345 L270 354 M254 338 L263 338 M277 338 L286 338"/>
  </g>
  <g data-role="wheel" data-o="326 338">
    <circle class="f" data-r="ruotaLocomotiva" cx="326" cy="338" r="22"/>
    <circle class="stroke" cx="326" cy="338" r="6"/>
    <path class="stroke" d="M326 322 L326 331 M326 345 L326 354 M310 338 L319 338 M333 338 L342 338"/>
  </g>
  <text data-role="zzz" x="330" y="216">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
