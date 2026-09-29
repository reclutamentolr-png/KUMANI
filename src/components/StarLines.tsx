// Geometria della stella a 5 punte usata dalla matrice (MatrixTree) e dalla
// mini guida animata (SpilloverExplainer): il titolare al centro, i 5 posti
// sulle punte, a partire dall'alto e in senso orario (1 in alto, 2 a destra,
// 3 in basso a destra, 4 in basso a sinistra, 5 a sinistra).
// Coordinate in percentuale di un riquadro largo 100 e alto BOX_HEIGHT.
export const BOX_HEIGHT = 108
export const STAR_CENTER = { x: 50, y: 46 }
const RADIUS = { x: 40, y: 37 }

export const STAR_POINTS = Array.from({ length: 5 }, (_, index) => {
  const angle = ((-90 + index * 72) * Math.PI) / 180
  return {
    left: STAR_CENTER.x + RADIUS.x * Math.cos(angle),
    top: STAR_CENTER.y + RADIUS.y * Math.sin(angle),
  }
})

// Stesse coordinate nell'unità del disegno SVG (asse verticale alto BOX_HEIGHT)
const toSvg = (point: { left: number; top: number }) => ({ x: point.left, y: (point.top / 100) * BOX_HEIGHT })
const SVG_CENTER = toSvg({ left: STAR_CENTER.x, top: STAR_CENTER.y })
const SVG_POINTS = STAR_POINTS.map(toSvg)
// Stella a cinque punte: ogni punta si collega alla seconda successiva
const STAR_PATH = [0, 2, 4, 1, 3, 0].map((i, step) => `${step === 0 ? 'M' : 'L'}${SVG_POINTS[i].x},${SVG_POINTS[i].y}`).join(' ')

// Sfondo della stella: contorno a cinque punte e raggi dal centro. I raggi
// indicati in `activeRays` sono più marcati (posti occupati nella guida).
export default function StarLines({ activeRays }: { activeRays?: boolean[] }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${BOX_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
      <path
        d={STAR_PATH}
        fill="var(--gold)"
        fillOpacity={0.06}
        stroke="var(--gold)"
        strokeOpacity={0.35}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
      {SVG_POINTS.map((point, index) => {
        const active = activeRays ? activeRays[index] : true
        return (
          <line
            key={index}
            x1={SVG_CENTER.x}
            y1={SVG_CENTER.y}
            x2={point.x}
            y2={point.y}
            stroke="var(--gold)"
            strokeOpacity={active ? 0.6 : 0.25}
            strokeWidth={active && activeRays ? 1.5 : 1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            style={{ transition: 'stroke-opacity 500ms' }}
          />
        )
      })}
    </svg>
  )
}
