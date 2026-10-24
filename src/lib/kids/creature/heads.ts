import type { CreaturePart } from './types'

// Teste (slot «testa»): centrate su (200, 145), ognuna con i suoi occhi
// (data-role="eyes") e il sorriso; coprono il collo del corpo (y 212–232)
export const HEADS: CreaturePart[] = [
  {
    id: 'orso',
    svg: `
<circle class="f" data-r="testa" cx="200" cy="146" r="82"/>
<ellipse class="f" data-r="guance" cx="146" cy="174" rx="14" ry="9"/>
<ellipse class="f" data-r="guance" cx="254" cy="174" rx="14" ry="9"/>
<ellipse class="f" data-r="muso" cx="200" cy="182" rx="42" ry="31"/>
<ellipse class="f" data-r="naso" cx="200" cy="165" rx="14" ry="10"/>
<path class="stroke" d="M200 175 L200 187 M185 189 Q200 202 215 189"/>
<g data-role="eyes" data-o="200 134"><circle class="ink" cx="168" cy="134" r="9"/><circle class="ink" cx="232" cy="134" r="9"/><circle class="hl" cx="171" cy="130.5" r="3"/><circle class="hl" cx="235" cy="130.5" r="3"/></g>`,
  },
  {
    id: 'gatto',
    svg: `
<path class="f" data-r="testa" d="M200 72 C252 72 282 106 284 146 C285 168 279 184 270 195 L282 204 L263 208 C247 223 225 230 200 230 C175 230 153 223 137 208 L118 204 L130 195 C121 184 115 168 116 146 C118 106 148 72 200 72 Z"/>
<ellipse class="f" data-r="guance" cx="152" cy="190" rx="14" ry="9"/>
<ellipse class="f" data-r="guance" cx="248" cy="190" rx="14" ry="9"/>
<path class="f" data-r="naso" d="M188 164 Q200 158 212 164 Q207 177 200 179 Q193 177 188 164 Z"/>
<path class="stroke" d="M200 179 L200 186 M185 186 Q192.5 196 200 186 Q207.5 196 215 186"/>
<path class="stroke" d="M164 168 L128 160 M164 178 L126 182 M236 168 L272 160 M236 178 L274 182"/>
<g data-role="eyes" data-o="200 138"><ellipse class="ink" cx="170" cy="138" rx="9" ry="11"/><ellipse class="ink" cx="230" cy="138" rx="9" ry="11"/><circle class="hl" cx="173" cy="134" r="3"/><circle class="hl" cx="233" cy="134" r="3"/></g>`,
  },
  {
    id: 'uccello',
    svg: `
<circle class="f" data-r="testa" cx="200" cy="148" r="78"/>
<path class="f" data-r="cresta" d="M186 90 C172 84 170 68 180 62 C186 70 192 72 196 70 C194 62 198 56 204 54 C206 62 210 70 214 70 C218 66 224 64 228 66 C228 80 222 90 214 92 Z"/>
<ellipse class="f" data-r="guance" cx="148" cy="172" rx="14" ry="9"/>
<ellipse class="f" data-r="guance" cx="252" cy="172" rx="14" ry="9"/>
<path class="f" data-r="becco" d="M174 166 Q200 150 226 166 Q214 190 200 196 Q186 190 174 166 Z"/>
<path class="stroke" d="M181 172 Q200 184 219 172"/>
<g data-role="eyes" data-o="200 136"><circle class="ink" cx="168" cy="136" r="10"/><circle class="ink" cx="232" cy="136" r="10"/><circle class="hl" cx="171.5" cy="132" r="3.5"/><circle class="hl" cx="235.5" cy="132" r="3.5"/></g>`,
  },
  {
    id: 'drago',
    svg: `
<ellipse class="f" data-r="testa" cx="200" cy="136" rx="78" ry="72"/>
<ellipse class="f" data-r="guance" cx="146" cy="150" rx="13" ry="9"/>
<ellipse class="f" data-r="guance" cx="254" cy="150" rx="13" ry="9"/>
<ellipse class="f" data-r="muso" cx="200" cy="186" rx="66" ry="42"/>
<path class="stroke" d="M178 172 Q184 164 190 172 M210 172 Q216 164 222 172"/>
<path class="stroke" d="M164 194 Q200 222 236 194 M179 204 L184 214 L189 206 M221 204 L216 214 L211 206"/>
<path class="stroke" d="M154 100 Q168 92 182 98 M218 98 Q232 92 246 100"/>
<g data-role="eyes" data-o="200 118"><circle class="ink" cx="168" cy="118" r="10"/><circle class="ink" cx="232" cy="118" r="10"/><circle class="hl" cx="171.5" cy="114" r="3.5"/><circle class="hl" cx="235.5" cy="114" r="3.5"/></g>`,
  },
  {
    id: 'scimmia',
    svg: `
<circle class="f" data-r="testa" cx="200" cy="146" r="82"/>
<path class="f" data-r="muso" d="M200 116 C190 98 142 96 140 136 C139 150 144 158 150 165 C138 190 160 218 200 218 C240 218 262 190 250 165 C256 158 261 150 260 136 C258 96 210 98 200 116 Z"/>
<path class="stroke" d="M192 166 L194 172 M208 166 L206 172"/>
<path class="stroke" d="M172 186 Q200 208 228 186"/>
<g data-role="eyes" data-o="200 138"><circle class="ink" cx="172" cy="138" r="9"/><circle class="ink" cx="228" cy="138" r="9"/><circle class="hl" cx="175" cy="134.5" r="3"/><circle class="hl" cx="231" cy="134.5" r="3"/></g>`,
  },
  {
    id: 'robot',
    svg: `
<rect class="f" data-r="testa" x="120" y="72" width="160" height="156" rx="34"/>
<rect class="f" data-r="visore" x="138" y="102" width="124" height="66" rx="24"/>
<ellipse class="f" data-r="guance" cx="150" cy="192" rx="12" ry="8"/>
<ellipse class="f" data-r="guance" cx="250" cy="192" rx="12" ry="8"/>
<path class="stroke" d="M176 190 Q200 210 224 190"/>
<circle class="stroke" cx="142" cy="88" r="4"/><circle class="stroke" cx="258" cy="88" r="4"/>
<circle class="stroke" cx="142" cy="214" r="4"/><circle class="stroke" cx="258" cy="214" r="4"/>
<g data-role="eyes" data-o="200 135"><circle class="ink" cx="170" cy="135" r="11"/><circle class="ink" cx="230" cy="135" r="11"/><circle class="hl" cx="174" cy="131" r="3.5"/><circle class="hl" cx="234" cy="131" r="3.5"/></g>`,
  },
]

// Sopra la testa (slot «sopra»): orecchie, corna, criniera, antenne. Si
// disegnano prima della testa: le basi restano nascoste sotto ogni testa
export const TOPS: CreaturePart[] = [
  {
    id: 'orecchieTonde',
    svg: `
<g data-role="ears" data-o="200 100">
<circle class="f" data-r="orecchioSx" cx="136" cy="84" r="31"/>
<circle class="f" data-r="orecchioDx" cx="264" cy="84" r="31"/>
<circle class="f" data-r="internoOrecchioSx" cx="132" cy="80" r="16"/>
<circle class="f" data-r="internoOrecchioDx" cx="268" cy="80" r="16"/>
</g>`,
  },
  {
    id: 'orecchieGatto',
    svg: `
<g data-role="ears" data-o="200 100">
<path class="f" data-r="orecchioSx" d="M138 124 L124 52 Q122 38 135 43 L190 88 Z"/>
<path class="f" data-r="orecchioDx" d="M262 124 L276 52 Q278 38 265 43 L210 88 Z"/>
<path class="f" data-r="internoOrecchioSx" d="M142 104 L134 62 Q134 55 140 58 L168 82 Z"/>
<path class="f" data-r="internoOrecchioDx" d="M258 104 L266 62 Q266 55 260 58 L232 82 Z"/>
</g>`,
  },
  {
    id: 'orecchieConiglio',
    svg: `
<g data-role="ears" data-o="200 100">
<ellipse class="f" data-r="orecchioSx" cx="146" cy="74" rx="22" ry="48" transform="rotate(-24 146 74)"/>
<ellipse class="f" data-r="orecchioDx" cx="254" cy="74" rx="22" ry="48" transform="rotate(24 254 74)"/>
<ellipse class="f" data-r="internoOrecchioSx" cx="142" cy="66" rx="10" ry="30" transform="rotate(-24 142 66)"/>
<ellipse class="f" data-r="internoOrecchioDx" cx="258" cy="66" rx="10" ry="30" transform="rotate(24 258 66)"/>
</g>`,
  },
  {
    id: 'corno',
    svg: `
<path class="f" data-r="corno" d="M174 104 L195 36 Q200 24 205 36 L226 104 Z"/>
<path class="stroke" d="M184 86 L214 74 M190 66 L208 58"/>`,
  },
  {
    id: 'cornaDrago',
    svg: `
<path class="f" data-r="corno" d="M146 108 C140 82 126 62 110 48 Q104 40 114 38 C146 40 170 62 182 96 Z"/>
<path class="f" data-r="corno" d="M254 108 C260 82 274 62 290 48 Q296 40 286 38 C254 40 230 62 218 96 Z"/>`,
  },
  {
    id: 'criniera',
    svg: `
<path class="f" data-r="criniera" d="M182.4 222.3 A18 18 0 0 1 150 208.8 A18 18 0 0 1 125.2 184 A18 18 0 0 1 111.7 151.6 A18 18 0 0 1 111.7 116.4 A18 18 0 0 1 125.2 84 A18 18 0 0 1 150 59.2 A18 18 0 0 1 182.4 45.7 A18 18 0 0 1 217.6 45.7 A18 18 0 0 1 250 59.2 A18 18 0 0 1 274.8 84 A18 18 0 0 1 288.3 116.4 A18 18 0 0 1 288.3 151.6 A18 18 0 0 1 274.8 184 A18 18 0 0 1 250 208.8 A18 18 0 0 1 217.6 222.3 A18 18 0 0 1 182.4 222.3 Z"/>`,
  },
  {
    id: 'antenne',
    svg: `
<g data-role="ears" data-o="200 100">
<path class="stroke" d="M176 100 Q168 70 152 52 M224 100 Q232 70 248 52"/>
<circle class="f" data-r="antenne" cx="148" cy="46" r="14"/>
<circle class="f" data-r="antenne" cx="252" cy="46" r="14"/>
</g>`,
  },
]
