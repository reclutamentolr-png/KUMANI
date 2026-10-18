// Dopo aver aperto un pannello (es. «In cosa possiamo darti una mano?»): la
// pagina scorre quanto basta per vederlo tutto, senza far sparire più del
// necessario quello che sta sopra. Se è già tutto a vista non si muove.
// root: il contenitore; si cerca il pannello visibile con [data-reveal-panel]
// (ce ne può essere uno per il telefono e uno per il computer).
export function revealPanel(root: HTMLElement | null, topGap = 96, bottomGap = 24) {
  if (!root || typeof window === 'undefined') return
  // Due fotogrammi: il pannello appena aperto è già nella pagina
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const panel = [...root.querySelectorAll<HTMLElement>('[data-reveal-panel]')].find((el) => el.offsetParent !== null)
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      const viewport = window.innerHeight
      let delta = 0
      // Il fondo è fuori schermo: si scende quanto basta, senza che l'inizio
      // del pannello finisca sotto le barre in alto
      if (rect.bottom > viewport - bottomGap) delta = Math.min(rect.bottom - (viewport - bottomGap), rect.top - topGap)
      // L'inizio è sopra lo schermo: si risale fino a lui
      else if (rect.top < topGap) delta = rect.top - topGap
      if (Math.abs(delta) < 8) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      window.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' })
    })
  )
}
