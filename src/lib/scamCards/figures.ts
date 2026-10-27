// Figure delle Carte Antitruffa: un animale per truffa, disegnato da noi
// (SVG in un riquadro 200×130). Solo testo fisso scritto qui, nessun dato
// dell'utente: si può inserire nella pagina così com'è.

const K = '#171717'
const S = `stroke="${K}" stroke-width="2.5" stroke-linejoin="round"`
const shadow = `<ellipse cx="96" cy="123" rx="62" ry="6" fill="${K}" opacity=".13"/>`
// uid: distingue il gradiente del camaleonte quando ci sono più carte nella pagina
export const FIGURES: ((uid: string) => string)[] = [
  // 1 Volpe corriere: pesca con il pacco come esca
  () => `${shadow}
    <path d="M122 96 L178 18" stroke="#7a5230" stroke-width="4" stroke-linecap="round"/>
    <path d="M178 18 Q182 40 160 58" stroke="${K}" stroke-width="1.5" fill="none"/>
    <g transform="translate(144 60) rotate(8)"><rect width="34" height="28" rx="3" fill="#c9965a" ${S}/><path d="M0 9h34M17 0v28" ${S}/><path d="M17 0 v-4 q0 -5 5 -5" stroke="${K}" stroke-width="2" fill="none"/></g>
    <path d="M122 120 Q152 116 148 90 Q140 106 122 108Z" fill="#e0762b" ${S}/><path d="M148 90 Q151 100 143 106 Q141 97 148 90Z" fill="#fff"/>
    <path d="M62 124 V102 Q62 86 92 86 Q122 86 122 102 V124Z" fill="#8a5a2b" ${S}/>
    <path d="M82 87 L92 100 L102 87Z" fill="#f3e2c0" stroke="${K}" stroke-width="2"/>
    <circle cx="122" cy="98" r="7" fill="#e0762b" ${S}/>
    <path d="M58 50 L56 14 L82 38Z" fill="#e0762b" ${S}/><path d="M126 50 L128 14 L102 38Z" fill="#e0762b" ${S}/>
    <path d="M54 50 Q56 34 92 34 Q128 34 130 50 Q120 72 92 92 Q64 72 54 50Z" fill="#e0762b" ${S}/>
    <path d="M57 55 Q75 62 85 80 L92 91 Q66 74 57 55Z" fill="#fff"/><path d="M127 55 Q109 62 99 80 L92 91 Q118 74 127 55Z" fill="#fff"/>
    <circle cx="92" cy="88" r="5" fill="${K}"/>
    <path d="M70 58 Q78 53 87 58" stroke="${K}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="81" cy="61" r="3.5" fill="${K}"/>
    <path d="M97 58 Q106 53 114 58" stroke="${K}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="108" cy="61" r="3.5" fill="${K}"/>
    <path d="M60 42 Q62 20 92 20 Q122 20 124 42Z" fill="#6b4421" ${S}/>
    <path d="M62 42 Q44 42 44 49 Q58 49 76 43" fill="#4b2f16" ${S}/>
    <rect x="86" y="26" width="13" height="8" rx="2" fill="#e7c56a" stroke="${K}" stroke-width="1.5"/>`,
  // 2 Lupo bancario con la cuffia del call center
  () => `${shadow}
    <path d="M58 124 V104 Q58 86 92 86 Q126 86 126 104 V124Z" fill="#2c3440" ${S}/>
    <path d="M80 87 L92 112 L104 87Z" fill="#fff" stroke="${K}" stroke-width="2"/>
    <path d="M92 92 L87 98 L92 116 L97 98Z" fill="#c0392b" stroke="${K}" stroke-width="1.5"/>
    <rect x="106" y="100" width="14" height="10" rx="2" fill="#e7c56a" stroke="${K}" stroke-width="1.5"/>
    <path d="M60 46 L62 10 L84 32Z" fill="#8e98a3" ${S}/><path d="M124 46 L122 10 L100 32Z" fill="#8e98a3" ${S}/>
    <path d="M56 50 L48 58 L57 60 L50 70 L64 72 L78 88 Q92 96 106 88 L120 72 L134 70 L127 60 L136 58 L128 50 Q126 30 92 30 Q58 30 56 50Z" fill="#8e98a3" ${S}/>
    <path d="M74 70 Q92 58 110 70 Q108 90 92 93 Q76 90 74 70Z" fill="#d6dbe0" stroke="${K}" stroke-width="2"/>
    <ellipse cx="92" cy="71" rx="7" ry="5" fill="${K}"/>
    <path d="M80 81 Q92 91 104 81" stroke="${K}" stroke-width="2.5" fill="#fff"/><path d="M85 83 l2 4 l2 -3 M95 83 l2 3 l2 -4" stroke="${K}" stroke-width="1.5" fill="none"/>
    <ellipse cx="78" cy="53" rx="6.5" ry="5" fill="#f2c94c" stroke="${K}" stroke-width="2"/><circle cx="80" cy="54" r="2.6" fill="${K}"/>
    <ellipse cx="106" cy="53" rx="6.5" ry="5" fill="#f2c94c" stroke="${K}" stroke-width="2"/><circle cx="108" cy="54" r="2.6" fill="${K}"/>
    <path d="M68 42 L86 47 M116 42 L98 47" stroke="${K}" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M54 52 Q52 16 92 16 Q132 16 130 52" stroke="${K}" stroke-width="3.5" fill="none"/>
    <rect x="47" y="45" width="11" height="17" rx="4" fill="${K}"/><rect x="126" y="45" width="11" height="17" rx="4" fill="${K}"/>
    <path d="M52 61 Q54 82 72 84" stroke="${K}" stroke-width="2.5" fill="none"/><circle cx="73" cy="84" r="3.5" fill="${K}"/>`,
  // 3 Camaleonte: cambia colore e numero, «Ciao mamma»
  (uid) => { const id = `cham-${uid}`; return `
    <defs><linearGradient id="${id}" x1="0" x2="1"><stop offset="0" stop-color="#5cc46a"/><stop offset=".55" stop-color="#e8c547"/><stop offset="1" stop-color="#e2568c"/></linearGradient></defs>
    <path d="M8 114 Q100 104 192 116" stroke="#7a5230" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M142 88 Q172 98 174 76 Q174 60 160 62 Q148 66 154 76 Q160 82 164 74" stroke="${K}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M142 88 Q172 98 174 76 Q174 60 160 62 Q148 66 154 76 Q160 82 164 74" stroke="#e2568c" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M80 92 L76 110 M128 94 L134 110" stroke="${K}" stroke-width="9" stroke-linecap="round"/><path d="M80 92 L76 110 M128 94 L134 110" stroke="#4fa35c" stroke-width="5" stroke-linecap="round"/>
    <path d="M62 56 Q100 34 140 56 Q158 74 142 92 Q110 104 66 88Z" fill="url(#${id})" ${S}/>
    <path d="M90 50 Q94 70 88 92 M112 46 Q118 70 112 98" stroke="${K}" stroke-width="1.5" fill="none" opacity=".45"/>
    <path d="M70 54 Q52 38 34 52 Q22 62 28 76 Q42 88 68 84Z" fill="url(#${id})" ${S}/>
    <path d="M42 48 Q50 30 70 42" fill="#5cc46a" ${S}/>
    <path d="M30 74 Q44 78 58 76" stroke="${K}" stroke-width="2" fill="none"/>
    <circle cx="50" cy="60" r="10" fill="#5cc46a" ${S}/><circle cx="46" cy="60" r="4" fill="${K}"/>
    <g transform="translate(4 70) rotate(-12)"><rect width="18" height="30" rx="3" fill="#2a2a2a" ${S}/><rect x="2.5" y="4" width="13" height="20" rx="1" fill="#9fd3f0"/></g>
    <path d="M78 6 h70 a6 6 0 0 1 6 6 v12 a6 6 0 0 1 -6 6 h-56 l-10 8 v-8 h-4 a6 6 0 0 1 -6 -6 v-12 a6 6 0 0 1 6 -6z" fill="#fff" stroke="${K}" stroke-width="2"/>
    <text x="115" y="22" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-weight="800" font-size="11" fill="${K}">Ciao mamma!</text>`; },
  // 4 Pavone guru: coda a ventaglio, occhiali scuri, catena d'oro
  () => `${shadow}
    ${[-60, -40, -20, 0, 20, 40, 60].map((a) => `<g transform="rotate(${a} 100 106)"><path d="M100 106 L100 50" stroke="#2f8f6a" stroke-width="3"/><ellipse cx="100" cy="44" rx="11" ry="15" fill="#2f8f6a" stroke="${K}" stroke-width="2"/><ellipse cx="100" cy="46" rx="6" ry="8" fill="#e7c56a"/><circle cx="100" cy="47" r="3.5" fill="#1f4fa0"/></g>`).join('')}
    <path d="M80 124 Q76 92 92 80 Q100 74 108 80 Q124 92 120 124Z" fill="#1f6fc0" ${S}/>
    <path d="M92 84 Q88 60 94 50 L110 50 Q112 62 108 84Z" fill="#1f6fc0" ${S}/>
    <circle cx="102" cy="46" r="13" fill="#1f6fc0" ${S}/>
    <path d="M114 44 L127 49 L114 53Z" fill="#e7c56a" stroke="${K}" stroke-width="2"/>
    <path d="M98 34 L93 22 M102 33 L102 19 M106 34 L111 22" stroke="${K}" stroke-width="2"/>
    <circle cx="93" cy="21" r="3" fill="#2f8f6a" stroke="${K}" stroke-width="1.5"/><circle cx="102" cy="18" r="3" fill="#2f8f6a" stroke="${K}" stroke-width="1.5"/><circle cx="111" cy="21" r="3" fill="#2f8f6a" stroke="${K}" stroke-width="1.5"/>
    <path d="M89 44 h26" stroke="${K}" stroke-width="2"/><rect x="95" y="41" width="9" height="8" rx="3" fill="${K}"/><rect x="106" y="41" width="9" height="8" rx="3" fill="${K}"/>
    <path d="M90 78 Q101 94 112 78" stroke="#e7c56a" stroke-width="3.5" fill="none"/>
    <circle cx="101" cy="90" r="7" fill="#e7c56a" stroke="${K}" stroke-width="2"/><text x="101" y="94" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-weight="800" font-size="10" fill="${K}">€</text>
    <g transform="translate(12 76)"><rect width="26" height="40" rx="4" fill="#2a2a2a" ${S}/><rect x="3" y="5" width="20" height="28" fill="#fff"/><path d="M6 28 L12 20 L16 24 L21 12" stroke="#3a9a5b" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M17 12 h4 v4" stroke="#3a9a5b" stroke-width="2.5" fill="none"/></g>`,
  // 5 Avvoltoio recuperatore: torna su chi è già stato truffato
  () => `${shadow}
    <path d="M58 124 Q50 80 92 70 Q134 80 126 124Z" fill="#5a4636" ${S}/>
    <path d="M58 124 L52 110 L62 112 L56 98 L66 100 M126 124 L132 110 L122 112 L128 98 L118 100" stroke="${K}" stroke-width="2" fill="none"/>
    <path d="M86 72 Q84 54 92 44 L102 46 Q98 60 100 72Z" fill="#e7a3a0" ${S}/>
    <path d="M68 78 Q74 66 81 74 Q87 64 93 74 Q99 64 105 74 Q112 66 118 78 Q92 92 68 78Z" fill="#f3ecdb" ${S}/>
    <circle cx="96" cy="36" r="14" fill="#e7a3a0" ${S}/>
    <path d="M107 31 Q127 29 127 42 Q125 50 118 45 Q116 41 107 42Z" fill="#e7c56a" ${S}/>
    <circle cx="99" cy="33" r="3.5" fill="${K}"/><path d="M90 26 L105 30" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
    <g transform="translate(18 90)"><rect width="42" height="28" rx="3" fill="#7a4a24" ${S}/><path d="M14 0 v-6 h14 v6" stroke="${K}" stroke-width="2.5" fill="none"/><rect x="18" y="10" width="6" height="6" fill="#e7c56a" stroke="${K}" stroke-width="1.2"/></g>
    <path d="M60 104 Q56 100 58 96" stroke="${K}" stroke-width="2.5" fill="none"/>
    <g fill="#e7c56a" stroke="${K}" stroke-width="1.5"><circle cx="150" cy="112" r="6"/><circle cx="160" cy="116" r="6"/><circle cx="154" cy="104" r="6"/></g>`,
  // 6 Serpente con il berretto da ufficiale e il documento timbrato
  () => `${shadow}
    <path d="M40 114 Q40 96 92 96 Q144 96 144 110 Q144 124 92 124 Q40 124 40 114Z" fill="#c2a23a" ${S}/>
    <path d="M56 98 Q56 82 92 82 Q128 82 128 94 Q128 102 92 102 Q56 102 56 98Z" fill="#c2a23a" ${S}/>
    <g fill="#8a6f1e"><path d="M60 110 l5 -4 l5 4 l-5 4z"/><path d="M84 116 l5 -4 l5 4 l-5 4z"/><path d="M110 112 l5 -4 l5 4 l-5 4z"/><path d="M76 92 l5 -4 l5 4 l-5 4z"/><path d="M102 90 l5 -4 l5 4 l-5 4z"/></g>
    <path d="M100 86 Q114 64 100 50 L84 52 Q98 64 86 86Z" fill="#c2a23a" ${S}/>
    <ellipse cx="90" cy="46" rx="21" ry="13" fill="#c2a23a" ${S}/>
    <path d="M70 50 L58 52 M58 52 l-5 -4 M58 52 l-5 4" stroke="#c0392b" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="82" cy="43" rx="4.5" ry="4.5" fill="#f2e45c" stroke="${K}" stroke-width="1.5"/><path d="M82 40 v6" stroke="${K}" stroke-width="2"/>
    <ellipse cx="97" cy="43" rx="4.5" ry="4.5" fill="#f2e45c" stroke="${K}" stroke-width="1.5"/><path d="M97 40 v6" stroke="${K}" stroke-width="2"/>
    <path d="M72 35 Q74 16 92 16 Q110 16 110 35Z" fill="#23324a" ${S}/>
    <path d="M70 35 Q90 42 114 35 L112 31 Q90 37 72 31Z" fill="${K}"/>
    <circle cx="91" cy="24" r="4.5" fill="#e7c56a" stroke="${K}" stroke-width="1.5"/>
    <path d="M144 110 Q162 108 160 98" stroke="${K}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M144 110 Q162 108 160 98" stroke="#c2a23a" stroke-width="5" fill="none" stroke-linecap="round"/>
    <g transform="translate(138 42) rotate(6)"><rect width="38" height="50" rx="2" fill="#fff" ${S}/><path d="M7 11h24M7 19h24M7 27h16" stroke="#9a9384" stroke-width="2.5"/><circle cx="27" cy="39" r="8" fill="#d0574a" stroke="${K}" stroke-width="2"/></g>`,
  // 7 Coccodrillo: lacrime finte e cuore in regalo
  () => `${shadow}
    <path d="M68 92 Q100 74 150 84 Q178 90 194 108 Q160 112 140 106 Q110 114 68 108Z" fill="#4f8a3c" ${S}/>
    <path d="M96 80 l6 -8 l6 7 l6 -8 l6 8 l6 -7 l6 8" fill="#3d6f2e" stroke="${K}" stroke-width="2"/>
    <path d="M96 106 v14 h10 M136 106 v14 h10" stroke="${K}" stroke-width="7" stroke-linecap="round"/><path d="M96 106 v14 h10 M136 106 v14 h10" stroke="#4f8a3c" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M14 80 Q14 68 40 66 L80 63 Q96 63 98 78 Q98 94 80 96 L40 94 Q14 92 14 80Z" fill="#4f8a3c" ${S}/>
    <path d="M18 82 L90 82" stroke="${K}" stroke-width="2.5"/>
    <path d="M24 82 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5" fill="#fff" stroke="${K}" stroke-width="1.4"/>
    <circle cx="22" cy="72" r="2" fill="${K}"/>
    <path d="M64 66 Q72 48 88 60" fill="#4f8a3c" ${S}/>
    <circle cx="76" cy="60" r="5" fill="#f2e45c" stroke="${K}" stroke-width="1.5"/><path d="M76 56 v8" stroke="${K}" stroke-width="2"/>
    <path d="M82 67 Q77 76 82 79 Q87 76 82 67Z" fill="#7cc7ef" stroke="${K}" stroke-width="1.5"/>
    <path d="M40 54 S16 40 16 26 C16 19 21 14 27 14 c5 0 9 3 13 7 c4 -4 8 -7 13 -7 c6 0 11 5 11 12 c0 14 -24 28 -24 28z" fill="#e2567c" ${S}/>
    <path d="M150 30 c-3 -4 -9 -2 -8 3 c1 4 8 8 8 8 s7 -4 8 -8 c1 -5 -5 -7 -8 -3z" fill="#e2567c" stroke="${K}" stroke-width="1.5"/>
    <path d="M176 50 c-2 -3 -7 -1 -6 2 c1 3 6 6 6 6 s5 -3 6 -6 c1 -3 -4 -5 -6 -2z" fill="#e2567c" stroke="${K}" stroke-width="1.5"/>`,
  // 8 Pappagallo: ripete la voce di chi ami
  () => `${shadow}
    <path d="M44 116 H176" stroke="#7a5230" stroke-width="6" stroke-linecap="round"/>
    <path d="M100 104 L92 128 L110 128Z" fill="#1f6fc0" ${S}/>
    <ellipse cx="104" cy="80" rx="26" ry="32" fill="#d63a2f" ${S}/>
    <path d="M108 64 Q138 78 122 108 Q104 98 108 64Z" fill="#2f9d58" ${S}/>
    <path d="M122 108 Q114 100 110 94" stroke="#1f6fc0" stroke-width="3" fill="none"/>
    <path d="M96 112 v6 M110 112 v6" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="100" cy="44" r="21" fill="#d63a2f" ${S}/>
    <ellipse cx="91" cy="46" rx="9" ry="10" fill="#fff" stroke="${K}" stroke-width="1.5"/>
    <circle cx="90" cy="44" r="3.8" fill="${K}"/>
    <path d="M80 44 Q62 44 64 62 Q70 56 77 59 Q82 54 82 48Z" fill="#f3ecdb" ${S}/>
    <path d="M70 58 Q75 66 81 58" fill="#3a3a3a" stroke="${K}" stroke-width="1.5"/>
    <path d="M52 40 q-8 10 0 20 M42 34 q-14 16 0 32 M32 28 q-20 22 0 44" stroke="${K}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M150 24 l4 -10 l4 10 M152 20 h4" stroke="${K}" stroke-width="0" fill="none"/>
    <g transform="translate(140 18)"><path d="M0 6 h44 a6 6 0 0 1 6 6 v12 a6 6 0 0 1 -6 6 h-30 l-8 7 v-7 h-6 a6 6 0 0 1 -6 -6 v-12 a6 6 0 0 1 6 -6z" fill="#fff" stroke="${K}" stroke-width="2" transform="translate(-6 0)"/><text x="19" y="22" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-weight="800" font-size="10" fill="${K}">Sono io!</text></g>`,
  // 9 Fantasma con la multa che scade in 24 ore
  () => `${shadow}
    <path d="M58 118 Q58 30 98 28 Q138 30 138 118 l-10 -8 l-10 8 l-10 -8 l-10 8 l-10 -8 l-10 8 l-10 -8 l-10 8z" fill="#f4f1ff" ${S}/>
    <ellipse cx="86" cy="62" rx="6" ry="8" fill="${K}"/><ellipse cx="110" cy="62" rx="6" ry="8" fill="${K}"/>
    <path d="M77 49 L93 55 M119 49 L103 55" stroke="${K}" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="98" cy="86" rx="7" ry="5.5" fill="${K}"/>
    <path d="M58 82 Q42 80 40 70" stroke="${K}" stroke-width="2.5" fill="none"/>
    <g transform="translate(140 46) rotate(8)"><rect width="42" height="54" rx="2" fill="#fff" ${S}/><rect width="42" height="13" fill="#d0574a" ${S}/><text x="21" y="10" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-weight="800" font-size="8.5" fill="#fff">MULTA</text><path d="M7 22h28M7 29h20" stroke="#9a9384" stroke-width="2.5"/><text x="21" y="46" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="10" fill="${K}">€ 86</text></g>
    <path d="M136 82 Q144 78 146 72" stroke="${K}" stroke-width="2.5" fill="none"/>
    <g transform="translate(30 30)"><circle r="17" fill="#fff" ${S}/><path d="M0 -10 V0 L7 5" stroke="${K}" stroke-width="2.5" fill="none" stroke-linecap="round"/><text x="0" y="31" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="10" fill="${K}">24h</text></g>`,
  // 10 Gazza ladra: ruba il codice di 6 cifre
  () => `
    <path d="M70 114 Q130 106 196 112" stroke="#7a5230" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M122 80 L190 62 L192 74 L126 94Z" fill="#1d2433" ${S}/><path d="M130 84 L186 68" stroke="#4a78c8" stroke-width="2.5"/>
    <path d="M96 100 v12 M110 100 v12" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="102" cy="82" rx="30" ry="21" fill="#fff" ${S}/>
    <path d="M78 72 Q100 52 132 70 Q130 92 106 98 Q98 84 78 72Z" fill="#1d2433" ${S}/>
    <path d="M96 74 Q110 66 124 74" stroke="#4a78c8" stroke-width="3" fill="none"/>
    <circle cx="70" cy="58" r="18" fill="#1d2433" ${S}/>
    <circle cx="64" cy="53" r="4.5" fill="#fff"/><circle cx="62" cy="53" r="2.2" fill="${K}"/>
    <path d="M56 46 L70 50" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M54 56 L36 61 L54 66Z" fill="${K}"/>
    <g transform="translate(4 58) rotate(-8)"><rect width="40" height="19" rx="2" fill="#fff9c4" stroke="${K}" stroke-width="2"/><text x="20" y="14" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="10" fill="${K}">482913</text></g>`,
  // 11 Gatto prestigiatore: il pacco sparisce
  () => `${shadow}
    <path d="M70 124 Q66 92 96 88 Q126 92 122 124Z" fill="#7d7d8c" ${S}/>
    <path d="M88 93 l-9 -5 v10z M104 93 l9 -5 v10z" fill="#c0392b" stroke="${K}" stroke-width="1.5"/><circle cx="96" cy="93" r="3.2" fill="#c0392b" stroke="${K}" stroke-width="1.2"/>
    <path d="M68 54 L64 26 L86 40Z" fill="#7d7d8c" ${S}/><path d="M124 54 L128 26 L106 40Z" fill="#7d7d8c" ${S}/>
    <ellipse cx="96" cy="62" rx="32" ry="27" fill="#7d7d8c" ${S}/>
    <rect x="76" y="12" width="40" height="26" rx="2" fill="${K}"/><rect x="66" y="35" width="60" height="6" rx="2" fill="${K}"/><rect x="76" y="29" width="40" height="5" fill="#8a5cc7"/>
    <path d="M76 60 Q84 52 92 60 Q84 66 76 60Z" fill="#9fdc6a" stroke="${K}" stroke-width="2"/><path d="M85 55 v9" stroke="${K}" stroke-width="2.5"/>
    <path d="M100 60 Q108 52 116 60 Q108 66 100 60Z" fill="#9fdc6a" stroke="${K}" stroke-width="2"/><path d="M109 55 v9" stroke="${K}" stroke-width="2.5"/>
    <path d="M93 70 h6 l-3 4z" fill="#e2567c" stroke="${K}" stroke-width="1.2"/><path d="M90 77 q6 5 6 0 q0 5 6 0" stroke="${K}" stroke-width="2" fill="none"/>
    <path d="M70 72 h-16 M70 77 l-14 4 M122 72 h16 M122 77 l14 4" stroke="${K}" stroke-width="1.5"/>
    <path d="M124 104 L162 68" stroke="${K}" stroke-width="4.5" stroke-linecap="round"/><path d="M157 73 L162 68" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <circle cx="124" cy="104" r="7" fill="#7d7d8c" ${S}/>
    <g transform="translate(150 86)"><rect width="34" height="28" rx="3" fill="none" stroke="${K}" stroke-width="2" stroke-dasharray="4 4"/><path d="M0 9h34M17 0v28" stroke="${K}" stroke-width="1.5" stroke-dasharray="3 4"/></g>
    <path d="M168 50 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2z" fill="#e7c56a" stroke="${K}" stroke-width="1.2"/><path d="M188 76 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#e7c56a" stroke="${K}" stroke-width="1.2"/>`,
  // 12 Iena sorridente con la carta all'amo
  () => `${shadow}
    <path d="M60 124 Q56 90 94 86 Q132 90 128 124Z" fill="#c9a66b" ${S}/>
    <g fill="#6b4f2a"><circle cx="76" cy="106" r="4"/><circle cx="90" cy="114" r="3.5"/><circle cx="110" cy="104" r="4"/><circle cx="116" cy="117" r="3"/></g>
    <circle cx="66" cy="38" r="11" fill="#c9a66b" ${S}/><circle cx="66" cy="38" r="5" fill="#5a4026"/>
    <circle cx="122" cy="38" r="11" fill="#c9a66b" ${S}/><circle cx="122" cy="38" r="5" fill="#5a4026"/>
    <path d="M62 50 Q64 30 94 30 Q124 30 126 50 Q128 70 114 82 L74 82 Q60 70 62 50Z" fill="#c9a66b" ${S}/>
    <path d="M76 32 l5 -10 l6 8 l6 -10 l6 8 l6 -10 l6 12" fill="#5a4026" stroke="${K}" stroke-width="2" stroke-linejoin="round"/>
    <g fill="#6b4f2a"><circle cx="70" cy="58" r="3"/><circle cx="118" cy="60" r="3"/><circle cx="112" cy="40" r="2.5"/></g>
    <path d="M76 62 Q94 54 112 62 L112 84 Q94 92 76 84Z" fill="#5a4026" ${S}/>
    <ellipse cx="94" cy="63" rx="6" ry="4" fill="${K}"/>
    <path d="M72 74 Q94 94 116 74 Q94 84 72 74Z" fill="#fff" stroke="${K}" stroke-width="2"/><path d="M82 78 v6 M90 80 v7 M98 80 v7 M106 78 v6" stroke="${K}" stroke-width="1.2"/>
    <circle cx="80" cy="48" r="5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="82" cy="49" r="2.5" fill="${K}"/>
    <circle cx="108" cy="48" r="5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="110" cy="49" r="2.5" fill="${K}"/>
    <circle cx="128" cy="100" r="7" fill="#c9a66b" ${S}/>
    <g transform="translate(130 74) rotate(-10)"><rect width="50" height="32" rx="4" fill="#3f7cc4" ${S}/><rect y="7" width="50" height="6" fill="${K}"/><rect x="6" y="18" width="10" height="7" rx="1.5" fill="#e7c56a"/></g>
    <path d="M168 46 v20 q0 8 -8 8 q-7 0 -7 -7" stroke="${K}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M168 46 V20" stroke="${K}" stroke-width="1.2"/>`,
  // 13 Ragno: la rete dei «guadagni facili»
  () => { const c = [100, 64], ang = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => a * Math.PI / 180);
    const pt = (r: number, a: number) => `${(c[0] + r * Math.cos(a)).toFixed(1)} ${(c[1] + r * Math.sin(a) * 0.95).toFixed(1)}`;
    const ring = (r: number) => `M${ang.map((a) => pt(r, a)).join(' L')}Z`;
    return `
    <g stroke="#8a8373" stroke-width="1.4" fill="none">${ang.map((a) => `<path d="M${pt(0, a)} L${pt(66, a)}"/>`).join('')}<path d="${ring(20)}"/><path d="${ring(38)}"/><path d="${ring(56)}"/></g>
    <g font-family="Nunito Sans, sans-serif" font-weight="800" font-size="9" text-anchor="middle">
      <g transform="translate(50 30)"><circle r="10" fill="#e7c56a" stroke="${K}" stroke-width="1.8"/><text y="3.5" fill="${K}">€</text></g>
      <g transform="translate(152 36)"><circle r="10" fill="#e7c56a" stroke="${K}" stroke-width="1.8"/><text y="3.5" fill="${K}">€</text></g>
      <g transform="translate(150 98)"><rect x="-16" y="-9" width="32" height="18" rx="9" fill="#4d9e4a" stroke="${K}" stroke-width="1.8"/><text y="3.5" fill="#fff">+50€</text></g>
      <g transform="translate(48 100)"><circle r="10" fill="#e2567c" stroke="${K}" stroke-width="1.8"/><path d="M-4 0 l3 3 l5 -6" stroke="#fff" stroke-width="2" fill="none"/></g>
    </g>
    <path d="M100 0 V44" stroke="${K}" stroke-width="1.5"/>
    <g stroke="${K}" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M90 62 Q72 46 64 58"/><path d="M88 68 Q66 62 58 76"/><path d="M88 74 Q70 84 64 98"/><path d="M92 80 Q84 98 80 108"/>
      <path d="M110 62 Q128 46 136 58"/><path d="M112 68 Q134 62 142 76"/><path d="M112 74 Q130 84 136 98"/><path d="M108 80 Q116 98 120 108"/>
    </g>
    <ellipse cx="100" cy="72" rx="16" ry="14" fill="#2b2b33" ${S}/>
    <circle cx="100" cy="54" r="11" fill="#2b2b33" ${S}/>
    <g fill="#fff"><circle cx="95" cy="51" r="3"/><circle cx="105" cy="51" r="3"/><circle cx="91" cy="56" r="1.8"/><circle cx="109" cy="56" r="1.8"/></g>
    <g fill="${K}"><circle cx="96" cy="52" r="1.5"/><circle cx="106" cy="52" r="1.5"/></g>
    <path d="M94 60 q6 4 12 0" stroke="#fff" stroke-width="1.8" fill="none"/>`; },
  // 14 Pianta carnivora con l'email come esca
  () => `${shadow}
    <path d="M98 96 Q92 76 102 58" stroke="#3f8f4a" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M96 86 Q76 84 70 70 Q88 70 96 82Z" fill="#5cb85c" ${S}/><path d="M100 80 Q118 80 124 68 Q108 66 100 76Z" fill="#5cb85c" ${S}/>
    <path d="M70 100 h58 l-7 24 h-44z" fill="#c26b3c" ${S}/><rect x="66" y="93" width="66" height="10" rx="2" fill="#d98450" ${S}/>
    <path d="M102 58 Q130 82 160 62 Q160 48 146 46 Q126 58 102 58Z" fill="#5cb85c" ${S}/>
    <path d="M108 58 Q128 70 152 58 Q130 54 108 58Z" fill="#d6455a"/>
    <path d="M102 58 Q76 22 120 12 Q150 14 146 40 Q126 46 102 58Z" fill="#5cb85c" ${S}/>
    <path d="M108 54 Q122 32 142 38 Q126 46 108 54Z" fill="#d6455a"/>
    <path d="M146 40 l6 -4 M138 43 l4 -6 M130 46 l2 -7 M160 62 l7 2 M152 66 l4 6 M142 68 l1 7" stroke="${K}" stroke-width="2" stroke-linecap="round"/>
    <g transform="translate(124 40) rotate(14)"><rect width="28" height="19" rx="1.5" fill="#fff" stroke="${K}" stroke-width="2"/><path d="M0 0 l14 10 l14 -10" stroke="${K}" stroke-width="2" fill="none"/></g>
    <circle cx="114" cy="24" r="5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="116" cy="24" r="2.4" fill="${K}"/>
    <circle cx="128" cy="20" r="5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="130" cy="20" r="2.4" fill="${K}"/>`,
  // 15 Geco che attacca l'adesivo QR sopra quello vero
  () => `${shadow}
    <rect x="40" y="50" width="10" height="72" fill="#7d8790" ${S}/>
    <rect x="20" y="12" width="50" height="44" rx="6" fill="#9aa4ad" ${S}/>
    <rect x="28" y="20" width="34" height="28" fill="#fff" stroke="${K}" stroke-width="1.5"/>
    <g transform="translate(32 18) rotate(-9)"><rect width="30" height="30" fill="#fff" stroke="#d0574a" stroke-width="2.8"/><path d="M4 4h9v9H4zM17 4h9v9h-9zM4 17h9v9H4zM17 17h4v4h-4zM22 22h4v4h-4z" fill="${K}"/></g>
    <path d="M150 112 Q172 122 190 104" stroke="${K}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M150 112 Q172 122 190 104" stroke="#7ac943" stroke-width="5.5" fill="none" stroke-linecap="round"/>
    <g stroke="${K}" stroke-width="7" stroke-linecap="round"><path d="M106 70 L92 80"/><path d="M110 66 L126 56"/><path d="M130 96 L116 108"/><path d="M136 98 L152 88"/></g>
    <g stroke="#7ac943" stroke-width="3.5" stroke-linecap="round"><path d="M106 70 L92 80"/><path d="M110 66 L126 56"/><path d="M130 96 L116 108"/><path d="M136 98 L152 88"/></g>
    <g fill="#7ac943" stroke="${K}" stroke-width="1.5"><circle cx="91" cy="81" r="4"/><circle cx="127" cy="55" r="4"/><circle cx="115" cy="109" r="4"/><circle cx="153" cy="87" r="4"/></g>
    <path d="M152 112 Q130 96 118 80 Q108 64 92 58" stroke="${K}" stroke-width="18" fill="none" stroke-linecap="round"/>
    <path d="M152 112 Q130 96 118 80 Q108 64 92 58" stroke="#7ac943" stroke-width="13" fill="none" stroke-linecap="round"/>
    <g fill="#4f8a2a"><circle cx="126" cy="92" r="2.5"/><circle cx="114" cy="74" r="2.5"/><circle cx="138" cy="102" r="2"/></g>
    <ellipse cx="84" cy="54" rx="15" ry="11" fill="#7ac943" ${S}/>
    <circle cx="86" cy="47" r="5.5" fill="#f2e45c" stroke="${K}" stroke-width="1.5"/><path d="M86 43 v8" stroke="${K}" stroke-width="2"/>
    <path d="M71 58 Q78 62 86 58" stroke="${K}" stroke-width="2" fill="none"/>`,
  // 16 Corvo con la lettera del finto rimborso
  () => `${shadow}
    <path d="M62 94 L30 106 L36 94 L26 88 L62 84Z" fill="#1f2128" ${S}/>
    <path d="M92 104 v16 M106 104 v16" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 94 Q60 64 96 60 Q130 60 136 84 Q132 104 100 108 Q70 108 60 94Z" fill="#1f2128" ${S}/>
    <path d="M80 76 Q104 66 128 86 Q104 98 80 90Z" fill="#383b46" stroke="${K}" stroke-width="2"/>
    <circle cx="132" cy="56" r="18" fill="#1f2128" ${S}/>
    <path d="M147 51 L174 58 L147 65Z" fill="#5d6068" ${S}/>
    <circle cx="136" cy="51" r="4.5" fill="#fff"/><circle cx="137.5" cy="51" r="2.2" fill="${K}"/>
    <path d="M126 43 L142 47" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <g transform="translate(150 62) rotate(10)"><rect width="38" height="26" rx="1.5" fill="#fff" ${S}/><path d="M0 0 l19 14 l19 -14" stroke="${K}" stroke-width="2" fill="none"/><circle cx="19" cy="16" r="5" fill="#d0574a" stroke="${K}" stroke-width="1.5"/></g>
    <g transform="translate(166 30)"><circle r="9" fill="#e7c56a" stroke="${K}" stroke-width="1.8"/><text y="3.5" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-weight="800" font-size="10" fill="${K}">€</text></g>`,
  // 17 Paguro che affitta una casa non sua
  () => `${shadow}
    <g transform="translate(92 22)"><path d="M0 34 L36 4 L72 34 V88 H0Z" fill="#f3e2c0" ${S}/><path d="M-6 36 L36 0 L78 36" stroke="#c0392b" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="10" y="44" width="16" height="14" fill="#9fd3f0" stroke="${K}" stroke-width="2"/><rect x="44" y="44" width="16" height="14" fill="#9fd3f0" stroke="${K}" stroke-width="2"/><rect x="26" y="64" width="18" height="24" fill="#8a5a2b" stroke="${K}" stroke-width="2"/></g>
    <g stroke="${K}" stroke-width="3" stroke-linecap="round"><path d="M68 106 l-8 14"/><path d="M78 108 l-4 14"/><path d="M92 108 l4 14"/></g>
    <ellipse cx="82" cy="96" rx="22" ry="15" fill="#e8613c" ${S}/>
    <path d="M74 84 v-18 M88 84 v-20" stroke="${K}" stroke-width="2.5"/>
    <circle cx="74" cy="63" r="6" fill="#fff" ${S}/><circle cx="73" cy="63" r="3" fill="${K}"/>
    <circle cx="88" cy="61" r="6" fill="#fff" ${S}/><circle cx="87" cy="61" r="3" fill="${K}"/>
    <path d="M76 102 q6 4 12 0" stroke="${K}" stroke-width="2" fill="none"/>
    <path d="M62 94 Q42 92 40 78 Q48 84 56 82 Q50 74 58 70 Q66 80 64 92Z" fill="#e8613c" ${S}/>
    <path d="M46 76 L38 34" stroke="#7a5230" stroke-width="3.5" stroke-linecap="round"/>
    <g transform="translate(6 14) rotate(-6)"><rect width="62" height="20" rx="2" fill="#fff" stroke="${K}" stroke-width="2"/><text x="31" y="14" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-weight="800" font-size="9" fill="#c0392b">AFFITTASI</text></g>`,
  // 18 Scimmia con la ruota della fortuna truccata
  () => { const cols = ['#e7c56a', '#d0574a', '#3f7cc4', '#4d9e4a'], r = 34;
    const wedge = (i: number) => { const a0 = (i * 45 - 90) * Math.PI / 180, a1 = ((i + 1) * 45 - 90) * Math.PI / 180;
      return `<path d="M0 0 L${(r * Math.cos(a0)).toFixed(1)} ${(r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(1)} ${(r * Math.sin(a1)).toFixed(1)}Z" fill="${cols[i % 4]}" stroke="${K}" stroke-width="1.5"/>`; };
    return `${shadow}
    <path d="M142 94 L130 122 M142 94 L154 122" stroke="${K}" stroke-width="3.5" stroke-linecap="round"/>
    <g transform="translate(142 58) rotate(12)">${[0, 1, 2, 3, 4, 5, 6, 7].map(wedge).join('')}<circle r="${r}" fill="none" ${S}/><circle r="6" fill="#fff" ${S}/></g>
    <path d="M136 16 L148 16 L142 28Z" fill="#d0574a" stroke="${K}" stroke-width="1.5"/>
    <path d="M44 112 Q20 118 20 96 Q20 84 32 88" stroke="${K}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M44 112 Q20 118 20 96 Q20 84 32 88" stroke="#8a5a2b" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="64" cy="100" rx="22" ry="22" fill="#8a5a2b" ${S}/><ellipse cx="64" cy="104" rx="13" ry="14" fill="#e9c79a"/>
    <path d="M82 92 Q98 80 110 66" stroke="${K}" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M82 92 Q98 80 110 66" stroke="#8a5a2b" stroke-width="5.5" fill="none" stroke-linecap="round"/>
    <circle cx="40" cy="58" r="8" fill="#e9c79a" ${S}/><circle cx="86" cy="58" r="8" fill="#e9c79a" ${S}/>
    <circle cx="63" cy="56" r="22" fill="#8a5a2b" ${S}/>
    <path d="M49 58 Q49 44 63 47 Q77 44 77 58 Q77 74 63 76 Q49 74 49 58Z" fill="#e9c79a" stroke="${K}" stroke-width="2"/>
    <circle cx="57" cy="56" r="3" fill="${K}"/><circle cx="69" cy="56" r="3" fill="${K}"/>
    <path d="M55 66 Q63 75 71 66 Z" fill="#fff" stroke="${K}" stroke-width="2"/>
    <path d="M178 22 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z M104 26 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5z" fill="#e7c56a" stroke="${K}" stroke-width="1.2"/>`; },
  // 19 Tarlo con la cuffia che esce dal computer
  () => `${shadow}
    <rect x="34" y="30" width="96" height="64" rx="5" fill="#2a2a2a" ${S}/>
    <rect x="40" y="36" width="84" height="52" fill="#9fd3f0"/>
    <path d="M22 98 H142 L134 110 H30Z" fill="#9aa4ad" ${S}/><path d="M30 94 H134" stroke="${K}" stroke-width="2.5"/>
    <path d="M46 56 L57 38 L68 56Z" fill="#f2c94c" stroke="${K}" stroke-width="2"/><text x="57" y="54" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-weight="800" font-size="11" fill="${K}">!</text>
    <ellipse cx="94" cy="66" rx="15" ry="11" fill="${K}"/>
    <path d="M80 60 l-6 -4 M108 60 l6 -5 M84 75 l-5 5 M105 74 l6 4" stroke="${K}" stroke-width="1.8"/>
    <path d="M94 68 Q94 40 116 30 Q132 24 140 36" stroke="${K}" stroke-width="22" fill="none" stroke-linecap="round"/>
    <path d="M94 68 Q94 40 116 30 Q132 24 140 36" stroke="#e8a0b4" stroke-width="16" fill="none" stroke-linecap="round"/>
    <path d="M90 52 h10 M94 42 l9 3 M106 33 l5 8" stroke="#c7768e" stroke-width="2"/>
    <circle cx="146" cy="40" r="15" fill="#e8a0b4" ${S}/>
    <circle cx="141" cy="37" r="5.5" fill="#fff" stroke="${K}" stroke-width="2"/><circle cx="154" cy="37" r="5.5" fill="#fff" stroke="${K}" stroke-width="2"/><path d="M146.5 37 h2" stroke="${K}" stroke-width="2"/>
    <circle cx="142" cy="38" r="2.2" fill="${K}"/><circle cx="155" cy="38" r="2.2" fill="${K}"/>
    <path d="M141 47 Q147 52 154 47" stroke="${K}" stroke-width="2" fill="none"/>
    <path d="M132 32 Q146 14 162 32" stroke="${K}" stroke-width="3" fill="none"/>
    <path d="M161 34 Q166 50 152 54" stroke="${K}" stroke-width="2.2" fill="none"/><circle cx="151" cy="54" r="3" fill="${K}"/>`,
  // 20 Anguilla elettrica con la bolletta
  () => `
    <path d="M18 98 Q48 70 80 96 Q112 122 140 90 Q154 74 166 66" stroke="${K}" stroke-width="24" fill="none" stroke-linecap="round"/>
    <path d="M18 98 Q48 70 80 96 Q112 122 140 90 Q154 74 166 66" stroke="#3a7fa0" stroke-width="18" fill="none" stroke-linecap="round"/>
    <path d="M22 102 Q48 80 80 102 Q112 126 142 96" stroke="#f2e45c" stroke-width="3" fill="none" stroke-dasharray="6 6"/>
    <g transform="translate(138 14) rotate(-8)"><rect width="36" height="44" rx="2" fill="#fff" ${S}/><rect width="36" height="11" fill="#f2c94c" ${S}/><path d="M6 19h24M6 26h16" stroke="#9a9384" stroke-width="2.5"/><text x="18" y="39" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="9" fill="${K}">€ ???</text></g>
    <ellipse cx="164" cy="66" rx="21" ry="14" fill="#3a7fa0" ${S}/>
    <circle cx="170" cy="60" r="4.5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="171" cy="60" r="2.2" fill="${K}"/>
    <path d="M162 54 L176 56" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M182 70 Q170 76 156 70" stroke="${K}" stroke-width="2" fill="none"/>
    ${[[24, 36], [76, 44], [108, 58]].map(([x, y]) => `<path transform="translate(${x} ${y})" d="M10 0 L0 16 h8 l-4 14 l14 -18 h-8 l4 -12z" fill="#f2e45c" stroke="${K}" stroke-width="1.8" stroke-linejoin="round"/>`).join('')}`,
];

// SVG completo della figura della carta n. (1-20)
export function figureSvg(no: number, label: string, uid: string): string {
  const draw = FIGURES[no - 1]
  return draw ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 130" role="img" aria-label="${label.replace(/"/g, '')}">${draw(uid)}</svg>` : ''
}
