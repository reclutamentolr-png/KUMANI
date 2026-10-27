'use client'

import Kumi from '@/components/kids/Kumi'

// Disegno della rete come il polpo KUMI (al posto della stella): la testa è il
// titolare, i 5 tentacoli sono i 5 posti. Due in alto, due ai lati e uno in
// basso, come i tentacoli di KUMI. Un posto occupato ha il tentacolo lungo fino
// alla persona, un posto libero un tentacolo corto e una traccia tratteggiata.
// Usato dalla rete (MatrixTree) e dalla mini guida animata (SpilloverExplainer).
// Coordinate in percentuale di un riquadro con proporzioni NET_W × NET_H.

const NET_W = 600
const NET_H = 720
export const NET_ASPECT = `${NET_W} / ${NET_H}`

// Fondo del corpo di KUMI e grandezza della testa (KUMI è disegnato in 400 × 440)
const BODY = { x: 300, y: 300 }
const HEAD_SCALE = 0.85

// Angolo (gradi) e distanza di ogni posto dal corpo, in senso orario da quello
// in alto a sinistra
const SLOTS = [
  { angle: -148, rx: 235, ry: 200 },
  { angle: -32, rx: 235, ry: 200 },
  { angle: 30, rx: 235, ry: 250 },
  { angle: 90, rx: 0, ry: 300 },
  { angle: 150, rx: 235, ry: 250 },
]
// Dove ogni tentacolo si attacca al corpo (nascosto dietro la testa)
const ROOTS = [
  { x: -34, y: -60 },
  { x: 34, y: -60 },
  { x: 36, y: -18 },
  { x: 0, y: -10 },
  { x: -36, y: -18 },
]
// Il tentacolo corto di un posto libero arriva a questa parte del percorso
const BUD = 0.3

type Point = { x: number; y: number }

const ends: Point[] = SLOTS.map(({ angle, rx, ry }) => {
  const rad = (angle * Math.PI) / 180
  return { x: BODY.x + rx * Math.cos(rad), y: BODY.y + ry * Math.sin(rad) }
})

export const NET_POINTS = ends.map((p) => ({ left: (p.x / NET_W) * 100, top: (p.y / NET_H) * 100 }))
// La testa di KUMI e, sopra la corona, il nome del titolare
const headTop = BODY.y + 12 - 298 * HEAD_SCALE
export const NET_HEAD = {
  left: ((BODY.x - 200 * HEAD_SCALE) / NET_W) * 100,
  top: (headTop / NET_H) * 100,
  width: ((400 * HEAD_SCALE) / NET_W) * 100,
}
export const NET_OWNER = { left: 50, top: ((headTop + 40 * HEAD_SCALE) / NET_H) * 100 }

const bezier = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}
const fmt = (p: Point) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`

type Tentacle = { root: Point; body: string; suckers: { x: number; y: number; r: number }[]; trail: string }

// Tentacolo a S che si assottiglia verso la punta, con le ventose sul lato chiaro
function buildTentacle(index: number, grown: boolean): Tentacle {
  const root = { x: BODY.x + ROOTS[index].x, y: BODY.y + ROOTS[index].y }
  const end = ends[index]
  const dx = end.x - root.x
  const dy = end.y - root.y
  const length = Math.hypot(dx, dy)
  const normal = { x: -dy / length, y: dx / length }
  const wave = (index % 2 ? 1 : -1) * length * 0.22
  const c1 = { x: root.x + dx * 0.33 + normal.x * wave, y: root.y + dy * 0.33 + normal.y * wave }
  const c2 = { x: root.x + dx * 0.66 - normal.x * wave, y: root.y + dy * 0.66 - normal.y * wave }
  const tMax = grown ? 1 : BUD
  const steps = 48
  const left: Point[] = []
  const right: Point[] = []
  const suckers: Tentacle['suckers'] = []
  let tipWidth = 0
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * tMax
    const p = bezier(root, c1, c2, end, t)
    const q = bezier(root, c1, c2, end, Math.min(1, t + 0.01))
    const d = Math.hypot(q.x - p.x, q.y - p.y) || 1
    const n = { x: -(q.y - p.y) / d, y: (q.x - p.x) / d }
    const along = t / tMax
    const width = grown ? 19 * (1 - t) + 4 * t : 19 * (1 - along) + 6 * along
    left.push({ x: p.x + n.x * width, y: p.y + n.y * width })
    right.push({ x: p.x - n.x * width, y: p.y - n.y * width })
    tipWidth = width
    if (k > 3 && k % 4 === 0 && (!grown || k < steps - 4)) {
      suckers.push({ x: p.x - n.x * width * 0.45, y: p.y - n.y * width * 0.45, r: Math.max(2.2, width * 0.42) })
    }
  }
  const back = right.slice().reverse()
  const body = `M${left.map(fmt).join(' L')} A${tipWidth.toFixed(1)} ${tipWidth.toFixed(1)} 0 0 1 ${fmt(back[0])} L${back.map(fmt).join(' L')} Z`
  let trail = ''
  if (!grown) {
    const rest = Array.from({ length: 31 }, (_, k) => bezier(root, c1, c2, end, BUD + 0.02 + (k / 30) * (1 - BUD - 0.02)))
    trail = `M${rest.map(fmt).join(' L')}`
  }
  return { root, body, suckers, trail }
}

const GROWN = SLOTS.map((_, index) => buildTentacle(index, true))
const BUDS = SLOTS.map((_, index) => buildTentacle(index, false))

function TentacleShape({ tentacle, animate }: { tentacle: Tentacle; animate: boolean }) {
  return (
    <g
      className={animate ? 'animate-tentacleGrow' : undefined}
      style={animate ? { transformOrigin: `${tentacle.root.x}px ${tentacle.root.y}px` } : undefined}
    >
      <path d={tentacle.body} fill="#1E1E24" />
      {tentacle.suckers.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r={s.r} fill="#E8C76A" stroke="#7A5A12" strokeWidth={1} />
          <circle cx={s.x} cy={s.y} r={s.r * 0.45} fill="#C99A2E" />
        </g>
      ))}
    </g>
  )
}

// Tentacoli e testa di KUMI. `grown`: posti occupati; `fresh`: tentacoli appena
// cresciuti, che si allungano con un'animazione.
export default function KumiTentacles({ grown, fresh }: { grown: boolean[]; fresh?: boolean[] }) {
  return (
    <>
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${NET_W} ${NET_H}`} aria-hidden="true">
        {SLOTS.map((_, index) =>
          grown[index] ? (
            <TentacleShape key={`${index}-grown`} tentacle={GROWN[index]} animate={Boolean(fresh?.[index])} />
          ) : (
            <g key={`${index}-bud`}>
              <path d={BUDS[index].trail} fill="none" stroke="var(--gold)" strokeOpacity={0.45} strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" />
              <TentacleShape tentacle={BUDS[index]} animate={false} />
            </g>
          ),
        )}
      </svg>
      <div className="pointer-events-none absolute" style={{ left: `${NET_HEAD.left}%`, top: `${NET_HEAD.top}%`, width: `${NET_HEAD.width}%` }}>
        <Kumi className="no-arms block h-auto w-full" />
      </div>
    </>
  )
}
