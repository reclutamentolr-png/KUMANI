// Angolo Bambini: formato dei disegni da colorare e animare.
//
// Ogni disegno è un SVG (viewBox 0 0 400 440) scritto a mano, senza IA:
// - le parti da colorare hanno class="f" e data-r="<parte>" (più forme possono
//   avere la stessa parte: si colorano insieme);
// - le righe che non si colorano hanno class="stroke", gli occhi class="ink",
//   i riflessi degli occhi class="hl";
// - i gruppi che si muovono hanno data-role (ruolo nell'animazione) e
//   data-o="x y" (il perno, in coordinate del disegno).
// Le animazioni sono movimenti preparati per ruolo (src/lib/kids/moves.css):
// il disegno colorato dal bambino è lo stesso che si muove.

export type DrawingCategory = 'animali' | 'mare' | 'mezzi' | 'fantasia' | 'natura'

// 1 = 3-4 anni (poche parti grandi), 2 = 5-6 anni, 3 = 7-8 anni (più dettagli)
export type DrawingLevel = 1 | 2 | 3

export type Drawing = {
  id: string
  category: DrawingCategory
  level: DrawingLevel
  // Quanto spesso proporlo a un bambino o a una bambina (1 = uguale per
  // tutti). Nessun disegno è escluso: cambia solo la probabilità.
  weight: { boy: number; girl: number }
  // Parti della figura (non dello sfondo): quando sono tutte colorate la
  // figura «si sveglia» e fa i complimenti al bambino
  figure: string[]
  // Contenuto dell'SVG, senza il tag <svg>
  svg: string
}

// Ruoli dei gruppi animati (data-role)
export const ROLES = [
  'figure', // tutta la figura (perno: in basso al centro, tra i piedi o le ruote)
  'head', // testa (perno: il collo)
  'eyes', // occhi (perno: centro degli occhi; si chiudono per dormire e sbattono)
  'armL', // braccio/zampa a sinistra dell'immagine, appeso in giù (perno: spalla)
  'armR', // braccio/zampa a destra dell'immagine, appeso in giù (perno: spalla)
  'wingL', // ala a sinistra (perno: attacco al corpo)
  'wingR', // ala a destra
  'tail', // coda (perno: attacco al corpo)
  'ears', // orecchie che si muovono insieme (perno: base)
  'wheel', // ruota o elica (perno: centro), anche più di una
  'flame', // fiamma, fumo o scia (perno: attacco)
  'sun', // raggi del sole che girano (perno: centro del sole)
  'cloud', // nuvola che si sposta
  'plant', // fiore, erba o alga che ondeggia (perno: base)
  'water', // onde o bolle che salgono e scendono
  'zzz', // le «z» del sonno (nessun perno)
] as const
export type Role = (typeof ROLES)[number]
