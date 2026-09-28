import { MOSAIC_LUT, type MosaicTile } from '@/lib/mosaic'

// Card del Mosaic (1080×1350) disegnata su Canvas: l'opera, il titolo della
// stagione e i crediti. Con "highlight" le tessere di chi condivide restano
// piene e le altre si attenuano.
export async function renderMosaicShareCard(opts: {
  title: string
  width: number
  height: number
  tiles: MosaicTile[]
  highlight: boolean
  createdBy: string
  myLine: string | null
  site: string
}): Promise<Blob | null> {
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#1b1b1b')
  bg.addColorStop(1, '#111111')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(231,197,106,0.5)'
  ctx.lineWidth = 4
  ctx.strokeRect(36, 36, W - 72, H - 72)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e7c56a'
  ctx.font = 'bold 40px sans-serif'
  ctx.fillText('K U M A N I   ·   M O S A I C', W / 2, 125)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 60px sans-serif'
  ctx.fillText(opts.title.length > 28 ? `${opts.title.slice(0, 27)}…` : opts.title, W / 2, 205)

  // L'opera, centrata in un riquadro di 880 px
  const box = 880
  const cell = Math.min(box / opts.width, box / opts.height)
  const artW = cell * opts.width
  const artH = cell * opts.height
  const left = (W - artW) / 2
  const top = 250 + (box - artH) / 2
  ctx.fillStyle = '#262626'
  ctx.fillRect(left, top, artW, artH)

  const hasMine = opts.highlight && opts.tiles.some((tile) => tile.mine)
  const draw = (tile: MosaicTile) => {
    const [r, g, b] = MOSAIC_LUT[tile.color]
    ctx.fillStyle = `rgb(${r},${g},${b})`
    // Arrotondamento esterno: niente righe sottili tra una tessera e l'altra
    ctx.fillRect(Math.floor(left + tile.x * cell), Math.floor(top + tile.y * cell), Math.ceil(cell), Math.ceil(cell))
  }
  ctx.globalAlpha = hasMine ? 0.3 : 1
  opts.tiles.filter((tile) => !hasMine || !tile.mine).forEach(draw)
  ctx.globalAlpha = 1
  if (hasMine) {
    const mine = opts.tiles.filter((tile) => tile.mine)
    mine.forEach(draw)
    if (cell >= 8) {
      ctx.strokeStyle = '#e7c56a'
      ctx.lineWidth = 2
      mine.forEach((tile) => ctx.strokeRect(left + tile.x * cell + 1, top + tile.y * cell + 1, cell - 2, cell - 2))
    }
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 42px sans-serif'
  ctx.fillText(opts.createdBy, W / 2, 1195)
  if (opts.myLine) {
    ctx.fillStyle = '#e7c56a'
    ctx.font = '34px sans-serif'
    ctx.fillText(opts.myLine, W / 2, 1248)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '28px sans-serif'
  ctx.fillText(opts.site, W / 2, 1296)

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}
