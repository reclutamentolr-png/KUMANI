// Ghirlanda di Natale appesa sotto la barra nera (Admin → Natale): rami di
// abete con lucine oro e rosse che si accendono a turno. È un disegno SVG
// ripetuto come sfondo (niente immagini da scaricare) e non prende i clic;
// con «riduci movimento» le luci restano ferme. Il contenitore deve avere
// position: relative.
const branch = (lights: string) => `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='26' viewBox='0 0 120 26'>
<path d='M0 3 Q60 17 120 3' fill='none' stroke='%23163d24' stroke-width='9' stroke-linecap='round'/>
<path d='M0 3 Q60 17 120 3' fill='none' stroke='%232f7a47' stroke-width='7' stroke-dasharray='2 2' stroke-linecap='round'/>
<path d='M0 2 Q60 15 120 2' fill='none' stroke='%2346a065' stroke-width='3' stroke-dasharray='1 3' stroke-linecap='round'/>
<circle cx='40' cy='9.6' r='1.6' fill='%23c8102e'/><circle cx='43' cy='10.2' r='1.4' fill='%23e23a4f'/>
<circle cx='80' cy='9.6' r='1.6' fill='%23c8102e'/><circle cx='77' cy='10.2' r='1.4' fill='%23e23a4f'/>
${lights}
</svg>`

const bulb = (x: number, y: number, color: string, glow: string, begin: string, animated: boolean) => `
<rect x='${x - 1.5}' y='${y}' width='3' height='3' rx='0.8' fill='%23a3894a'/>
<ellipse cx='${x}' cy='${y + 7.5}' rx='3.4' ry='4.8' fill='${glow}' opacity='0.35'>${animated ? `<animate attributeName='opacity' values='0.15;0.6;0.15' dur='2.4s' begin='${begin}' repeatCount='indefinite'/>` : ''}</ellipse>
<ellipse cx='${x}' cy='${y + 7.5}' rx='2.4' ry='3.6' fill='${color}'>${animated ? `<animate attributeName='opacity' values='0.55;1;0.55' dur='2.4s' begin='${begin}' repeatCount='indefinite'/>` : ''}</ellipse>`

const lights = (animated: boolean) =>
  bulb(20, 6, '%23f6d77a', '%23ffe9a8', '0s', animated) + bulb(60, 9, '%23e23a4f', '%23ff8a96', '0.8s', animated) + bulb(100, 6, '%23f6d77a', '%23ffe9a8', '1.6s', animated)

const svgUrl = (svg: string) => `url("data:image/svg+xml;utf8,${svg.replace(/\n/g, '').replace(/"/g, "'")}")`

const ANIMATED = svgUrl(branch(lights(true)))
const STILL = svgUrl(branch(lights(false)))

export default function ChristmasGarland() {
  const style = { backgroundRepeat: 'repeat-x', backgroundSize: '120px 26px' } as const
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full z-20 h-[26px] print:hidden">
      <div className="h-full w-full motion-reduce:hidden" style={{ ...style, backgroundImage: ANIMATED }} />
      <div className="hidden h-full w-full motion-reduce:block" style={{ ...style, backgroundImage: STILL }} />
    </div>
  )
}
