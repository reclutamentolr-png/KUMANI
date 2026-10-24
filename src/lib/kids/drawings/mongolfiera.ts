import type { Drawing } from '../types'

// Mongolfiera sorridente che vola nel cielo tra le nuvole, sopra le colline
// (la faccia sta sullo spicchio centrale del pallone, la fiammella pulsa)
const drawing: Drawing = {
  id: 'mongolfiera',
  category: 'mezzi',
  level: 2,
  weight: { boy: 1, girl: 1.1 },
  figure: ['pallone', 'spicchio', 'guance', 'fascia', 'fiamma', 'bordoCesto', 'cesto'],
  svg: `
<rect class="f" data-r="cielo" x="2" y="2" width="396" height="436" rx="18"/>
<g data-role="sun" data-o="62 64">
  <path class="stroke" d="M96 64 L108 64 M86 88 L94.5 96.5 M62 98 L62 110 M38 88 L29.5 96.5 M28 64 L16 64 M38 40 L29.5 31.5 M62 30 L62 18 M86 40 L94.5 31.5"/>
</g>
<circle class="f" data-r="sole" cx="62" cy="64" r="26"/>
<g data-role="cloud"><path class="f" data-r="nuvola" transform="translate(242 20)" d="M52 82 A16 16 0 0 1 60 52 A24 24 0 0 1 104 46 A18 18 0 0 1 132 66 A14 14 0 0 1 128 82 Z"/></g>
<g data-role="cloud"><path class="f" data-r="nuvola" transform="translate(-20 196) scale(0.8)" d="M52 82 A16 16 0 0 1 60 52 A24 24 0 0 1 104 46 A18 18 0 0 1 132 66 A14 14 0 0 1 128 82 Z"/></g>
<path class="stroke" d="M318 200 Q326 192 334 200 Q342 192 350 200 M334 236 Q340 230 346 236 Q352 230 358 236"/>
<path class="f" data-r="montagna" d="M2 400 Q70 366 150 392 Q230 362 310 388 Q356 372 398 380 L398 420 L2 420 Z"/>
<path class="f" data-r="prato" d="M2 414 Q120 398 220 414 T398 408 L398 420 Q398 438 380 438 L20 438 Q2 438 2 420 Z"/>
<path class="f" data-r="tronco" d="M342 400 L342 366 L354 366 L354 400 Z"/>
<g data-role="plant" data-o="348 400">
  <circle class="f" data-r="chioma" cx="348" cy="348" r="24"/>
</g>
<g data-role="figure" data-o="200 356">
  <path class="stroke" d="M172 270 L172 296 M228 270 L228 296"/>
  <g data-role="flame" data-o="200 294">
    <path class="f" data-r="fiamma" d="M189 294 C185 284 191 276 194 266 C200 272 204 270 206 264 C212 274 215 284 211 294 Z"/>
  </g>
  <path class="f" data-r="pallone" d="M200 60 C260 60 294 102 294 150 C294 196 256 222 238 254 L162 254 C144 222 106 196 106 150 C106 102 140 60 200 60 Z"/>
  <path class="f" data-r="spicchio" d="M200 60 C166 86 152 118 152 150 C152 196 170 226 178 254 L222 254 C230 226 248 196 248 150 C248 118 234 86 200 60 Z"/>
  <path class="f" data-r="fascia" d="M164 248 L236 248 L229 272 L171 272 Z"/>
  <circle class="f" data-r="guance" cx="169" cy="168" r="10"/>
  <circle class="f" data-r="guance" cx="231" cy="168" r="10"/>
  <path class="stroke" d="M185 168 Q200 183 215 168"/>
  <g data-role="eyes" data-o="200 146">
    <circle class="ink" cx="182" cy="146" r="8.5"/>
    <circle class="ink" cx="218" cy="146" r="8.5"/>
    <circle class="hl" cx="184.8" cy="143.2" r="2.6"/>
    <circle class="hl" cx="220.8" cy="143.2" r="2.6"/>
  </g>
  <path class="f" data-r="cesto" d="M168 304 L232 304 L227 348 Q226 356 218 356 L182 356 Q174 356 173 348 Z"/>
  <path class="stroke" d="M171 328 L229 328 M189 310 L190 352 M211 310 L210 352"/>
  <rect class="f" data-r="bordoCesto" x="158" y="292" width="84" height="18" rx="8"/>
  <text data-role="zzz" x="252" y="104">z<tspan font-size="22" dy="-14">z</tspan><tspan font-size="16" dy="-12">z</tspan></text>
</g>`,
}

export default drawing
