// Angolo Bambini: quello che i giochi chiedono al contenitore (KidsCorner):
// codice del genitore, album, salvataggio e condivisione, avvisi.

export type ShareTarget = {
  drawingId: string
  title: string
  png: Blob
  // Versione senza colori da stampare e colorare a mano (solo per i disegni)
  blankSvg?: string
}

export type KidsActions = {
  askParent: (purpose: 'share' | 'manage', then: () => void) => void
  // Immagine del disegno con il nome del bambino e la data sotto
  makePng: (svg: string, title: string) => Promise<Blob>
  // Lo stesso per un disegno a mano libera
  makeCanvasPng: (canvas: HTMLCanvasElement, title: string) => Promise<Blob>
  saveToAlbum: (item: { drawingId: string; png: Blob }) => Promise<void>
  openShare: (target: ShareTarget) => void
  toast: (message: string) => void
}
