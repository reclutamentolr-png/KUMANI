// Card di Kumani Fabula (1080×1350) disegnata su Canvas: i sei dadi, il
// titolo, l'inizio della storia e l'invito a leggere le altre voci.
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
      if (lines.length === maxLines) break
    } else line = test
  }
  if (lines.length < maxLines && line) lines.push(line)
  const used = lines.join(' ').length
  if (used < text.replace(/\s+/g, ' ').trim().length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:!?]?$/, '')}…`
  return lines
}

export async function renderFabulaShareCard(opts: {
  emoji: string[]
  title: string | null
  body: string
  author: string
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
  ctx.fillText('K U M A N I   ·   F A B U L A', W / 2, 125)

  // I sei dadi
  const box = 128
  const gap = 18
  const startX = (W - (box * 6 + gap * 5)) / 2
  opts.emoji.forEach((emoji, i) => {
    const x = startX + i * (box + gap)
    ctx.fillStyle = 'rgba(231,197,106,0.12)'
    ctx.strokeStyle = 'rgba(231,197,106,0.55)'
    ctx.lineWidth = 3
    ctx.beginPath()
    // roundRect manca nei browser più vecchi: lì il dado è quadrato
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, 190, box, box, 22)
    else ctx.rect(x, 190, box, box)
    ctx.fill()
    ctx.stroke()
    ctx.font = '72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(emoji, x + box / 2, 190 + box / 2 + 26)
  })

  let y = 420
  if (opts.title) {
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 56px serif'
    for (const line of wrap(ctx, opts.title, W - 200, 2)) {
      ctx.fillText(line, W / 2, y)
      y += 66
    }
    y += 20
  }
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.font = 'italic 40px serif'
  // Tante righe quante ne stanno sopra la firma dell'autore
  const maxLines = Math.max(3, Math.floor((H - 260 - y) / 56))
  for (const line of wrap(ctx, `“${opts.body}”`, W - 200, maxLines)) {
    ctx.fillText(line, W / 2, y)
    y += 56
  }

  ctx.fillStyle = '#e7c56a'
  ctx.font = '34px sans-serif'
  ctx.fillText(`— ${opts.author}`, W / 2, H - 205)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(opts.footer, W / 2, H - 140)
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '28px sans-serif'
  ctx.fillText(opts.site, W / 2, H - 90)

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}
