// «Crea il tuo animale»: il bambino monta un personaggio a pezzi (testa,
// orecchie o corna, corpo, braccia, piedi, coda, ali), lo colora e lo anima.
// Tutti i pezzi sono disegnati sullo stesso scheletro (viewBox 0 0 400 440),
// così qualunque combinazione si incastra. Formato dei pezzi come i disegni
// (src/lib/kids/types.ts): class="f" + data-r per le parti da colorare,
// gruppi con data-role e data-o per quelle che si muovono.
//
// SCHELETRO (coordinate del disegno)
// - piedi: due, centrati su (155, 392) e (245, 392), dentro y 368–414;
//   si disegnano DOPO il corpo
// - corpo: centro (200, 300), dentro x 122–278, y 212–394; collo in (200, 222)
// - testa: centro (200, 145), dentro x 115–285, y 62–232; perno del collo
//   (200, 228); ogni testa porta i suoi occhi (data-role="eyes", perno al
//   centro degli occhi) e il sorriso
// - sopra la testa (orecchie, corna, criniera, antenne): dentro x 100–300,
//   y 30–150, si disegnano PRIMA della testa (la base resta nascosta)
// - braccia: gruppi armL (perno 146, 250) e armR (perno 254, 250), appese in
//   giù fino a y ~340, si disegnano PRIMA del corpo
// - coda: attaccata in (262, 345), verso destra/in alto dentro x 250–372,
//   y 210–395, PRIMA del corpo; gruppo data-role="tail" data-o="262 345"
// - ali: dietro a tutto; sinistra attaccata in (168, 258) dentro x 32–175,
//   y 150–345 (data-role="wingL" data-o="168 258"), destra speculare in
//   (232, 258) dentro x 225–368 (data-role="wingR" data-o="232 258")
// I nomi delle parti (data-r) sono fissi per pezzo, così si traducono una
// volta sola: vedi PART_IDS.

export const SLOTS = ['ali', 'coda', 'braccia', 'corpo', 'piedi', 'sopra', 'testa'] as const
export type Slot = (typeof SLOTS)[number]

// Ordine di scelta per il bambino (diverso dall'ordine di disegno)
export const PICK_ORDER: Slot[] = ['testa', 'sopra', 'corpo', 'braccia', 'piedi', 'coda', 'ali']

// Slot che si possono lasciare vuoti
export const OPTIONAL: Slot[] = ['sopra', 'coda', 'ali']

export type CreaturePart = {
  id: string // es. 'gatto' (nome in messages → kids.creature.parts.<slot>.<id>)
  svg: string
}

// Parti da colorare ammesse per ogni pezzo
export const PART_IDS: Record<Slot, string[]> = {
  testa: ['testa', 'muso', 'naso', 'becco', 'guance', 'visore', 'cresta'],
  sopra: ['orecchioSx', 'orecchioDx', 'internoOrecchioSx', 'internoOrecchioDx', 'corno', 'criniera', 'antenne', 'ciuffo'],
  corpo: ['corpo', 'pancia', 'macchie', 'strisce', 'piume', 'bottoni', 'placche'],
  braccia: ['braccioSx', 'braccioDx', 'maniSx', 'maniDx'],
  piedi: ['piedeSx', 'piedeDx', 'ruote', 'suole'],
  coda: ['coda', 'ciuffoCoda', 'punteCoda'],
  ali: ['alaSx', 'alaDx', 'macchieAli'],
}
