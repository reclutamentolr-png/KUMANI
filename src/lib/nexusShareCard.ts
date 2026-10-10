// Immagine finale di KUMANI NEXUS (1080×1350) disegnata su Canvas: la forma
// della griglia del giorno (senza lettere, per non svelare le risposte), il
// tempo e i giorni di fila.
export async function renderNexusShareCard(opts: {
  open: boolean[][]
  date: string
  time: string
  line: string
  footer: string
  site: string
}): Promise<Blob | null> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#171717'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(231,197,106,0.5)'
  ctx.lineWidth = 4
  ctx.strokeRect(36, 36, W - 72, H - 72)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e7c56a'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText('K U M A N I   ·   N E X U S', W / 2, 130)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '36px sans-serif'
  ctx.fillText(opts.date, W / 2, 190)

  // La griglia: caselle dorate dove c'erano lettere
  const size = opts.open.length
  const gap = 10
  const cell = Math.floor((600 - gap * (size - 1)) / size)
  const side = cell * size + gap * (size - 1)
  const x0 = (W - side) / 2
  const y0 = 250
  opts.open.forEach((row, r) =>
    row.forEach((isOpen, c) => {
      ctx.fillStyle = isOpen ? '#e7c56a' : 'rgba(255,255,255,0.07)'
      ctx.beginPath()
      ctx.roundRect(x0 + c * (cell + gap), y0 + r * (cell + gap), cell, cell, 12)
      ctx.fill()
    })
  )

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 110px sans-serif'
  ctx.fillText(opts.time, W / 2, y0 + side + 150)
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '40px sans-serif'
  ctx.fillText(opts.line, W / 2, y0 + side + 220)

  ctx.fillStyle = '#e7c56a'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(opts.footer, W / 2, H - 120)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '32px sans-serif'
  ctx.fillText(opts.site, W / 2, H - 70)

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}
