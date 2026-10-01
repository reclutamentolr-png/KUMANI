import type { BioSceneKey } from '@/lib/linkInBioThemes'

// Sfondi illustrati dei temi speciali di Link in Bio, disegnati in SVG:
// leggeri, nitidi a ogni misura e senza immagini esterne. Sulla pagina sono
// ancorati in basso (xMidYMax slice) così il paesaggio resta sotto la card.

// Stelle in posizioni fisse (stesse sul server e sul client)
const STARS = (() => {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 80 }, () => ({ x: rand() * 400, y: rand() * 470, r: rand() * 1.1 + 0.3, o: rand() * 0.6 + 0.3 }))
})()

function Stars({ maxY = 470 }: { maxY?: number }) {
  return (
    <g fill="#fff">
      {STARS.filter((s) => s.y < maxY).map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
      ))}
    </g>
  )
}

// Abete stilizzato: tre livelli di rami
function pine(x: number, base: number, h: number) {
  const w = h * 0.42
  const tier = (top: number, bottom: number, half: number) => `M${x} ${top} L${x + half} ${bottom} L${x - half} ${bottom} Z`
  return [
    tier(base - h, base - h * 0.45, w * 0.32),
    tier(base - h * 0.75, base - h * 0.2, w * 0.42),
    tier(base - h * 0.5, base, w * 0.5),
    `M${x - 1.5} ${base} h3 v6 h-3 Z`,
  ].join(' ')
}

// Uccello in volo (gabbiano stilizzato)
function bird(x: number, y: number, s: number) {
  return `M${x - 6 * s} ${y} q${3 * s} ${-4 * s} ${6 * s} 0 q${3 * s} ${-4 * s} ${6 * s} 0`
}

// Giraffa vista di profilo, piedi a (0,0), alta circa 160
const GIRAFFE =
  'M-38 -68 L10 -76 L32 -146 L33 -156 L36 -147 L48 -142 L48 -136 L36 -138 L18 -68 L18 -48 L16 0 L12 0 L11 -46 L7 -46 L6 0 L2 0 L2 -46 L-22 -48 L-24 0 L-28 0 L-30 -50 L-34 -52 L-36 0 L-40 0 L-42 -60 Z'

function Aurora() {
  return (
    <>
      <defs>
        <linearGradient id="bs-au-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#020617" />
          <stop offset="0.55" stopColor="#0a2540" />
          <stop offset="1" stopColor="#0c4a5c" />
        </linearGradient>
        <linearGradient id="bs-au-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.5" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient id="bs-au-curtain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" stopOpacity="0.55" />
          <stop offset="1" stopColor="#6ee7b7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bs-au-lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e3b4f" />
          <stop offset="1" stopColor="#020a14" />
        </linearGradient>
        <filter id="bs-au-blur" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <rect width="400" height="800" fill="url(#bs-au-sky)" />
      <Stars />
      <g filter="url(#bs-au-blur)">
        <path d="M-40 380 C 60 290, 160 450, 260 340 S 420 290, 460 360" stroke="url(#bs-au-band)" strokeWidth="70" fill="none" opacity="0.6" />
        <path d="M-40 470 C 80 400, 180 510, 300 430 S 430 410, 460 450" stroke="url(#bs-au-band)" strokeWidth="40" fill="none" opacity="0.45" />
        <rect x="60" y="360" width="40" height="200" fill="url(#bs-au-curtain)" />
        <rect x="150" y="380" width="30" height="180" fill="url(#bs-au-curtain)" />
        <rect x="250" y="330" width="45" height="230" fill="url(#bs-au-curtain)" />
        <rect x="330" y="320" width="30" height="220" fill="url(#bs-au-curtain)" />
      </g>
      <path d="M0 600 L45 540 L80 565 L135 485 L185 555 L230 520 L275 560 L330 495 L370 535 L400 515 L400 620 L0 620 Z" fill="#0b2238" />
      <path d="M135 485 L150 506 L141 503 L135 512 L128 502 L121 505 Z M330 495 L343 512 L335 510 L330 517 L324 509 L318 511 Z" fill="#cbd5e1" opacity="0.7" />
      <rect y="600" width="400" height="200" fill="url(#bs-au-lake)" />
      <g filter="url(#bs-au-blur)" opacity="0.35">
        <path d="M-40 680 C 80 650, 180 700, 300 665 S 430 660, 460 680" stroke="url(#bs-au-band)" strokeWidth="30" fill="none" />
      </g>
      <g fill="#020b16">
        <path d="M0 632 C 50 626, 100 640, 128 662 C 150 690, 120 740, 90 800 L0 800 Z M400 628 C 350 624, 300 640, 276 664 C 256 692, 284 745, 312 800 L400 800 Z" />
        <path d={[pine(12, 660, 130), pine(42, 650, 100), pine(70, 668, 80), pine(100, 672, 55), pine(300, 668, 65), pine(330, 655, 95), pine(362, 650, 125), pine(392, 660, 105)].join(' ')} />
      </g>
    </>
  )
}

function Notte() {
  const geese = [
    [205, 440, 1.6], [230, 426, 1.45], [254, 413, 1.3], [230, 456, 1.45], [254, 471, 1.3],
    [330, 398, 1.1], [350, 389, 1],
  ]
  return (
    <>
      <defs>
        <linearGradient id="bs-nt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#030712" />
          <stop offset="0.5" stopColor="#0f172a" />
          <stop offset="0.75" stopColor="#1e1b4b" />
        </linearGradient>
        <radialGradient id="bs-nt-moon" cx="0.4" cy="0.4" r="0.7">
          <stop offset="0" stopColor="#fffbeb" />
          <stop offset="0.6" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="bs-nt-glow">
          <stop offset="0" stopColor="#fbbf24" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bs-nt-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151b3d" />
          <stop offset="1" stopColor="#02040a" />
        </linearGradient>
      </defs>
      <rect width="400" height="800" fill="url(#bs-nt-sky)" />
      <Stars maxY={520} />
      <circle cx="290" cy="470" r="150" fill="url(#bs-nt-glow)" />
      <circle cx="290" cy="470" r="54" fill="url(#bs-nt-moon)" />
      <g fill="#d97706" opacity="0.18">
        <circle cx="273" cy="455" r="9" />
        <circle cx="305" cy="489" r="6" />
        <circle cx="299" cy="449" r="4" />
      </g>
      <g stroke="#0b1020" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {geese.map(([x, y, s], i) => (
          <path key={i} d={bird(x, y, s)} />
        ))}
      </g>
      <path d="M0 560 C 70 520, 140 545, 210 565 S 330 520, 400 545 L400 610 L0 610 Z" fill="#141c3c" />
      <path d="M0 585 C 90 560, 170 590, 250 585 S 360 570, 400 580 L400 610 L0 610 Z" fill="#0b1029" />
      <rect y="605" width="400" height="195" fill="url(#bs-nt-water)" />
      <g fill="#fcd34d">
        {[
          [290, 615, 70, 0.55], [290, 630, 56, 0.5], [290, 646, 64, 0.42], [290, 663, 44, 0.4], [290, 681, 52, 0.32],
          [290, 700, 34, 0.3], [290, 720, 40, 0.22], [290, 742, 24, 0.2], [290, 765, 30, 0.14],
        ].map(([x, y, w, o], i) => (
          <rect key={i} x={x - w / 2 + (i % 2 ? 6 : -6)} y={y} width={w} height="2.4" rx="1.2" opacity={o} />
        ))}
      </g>
      <g stroke="#02040a" strokeLinecap="round" fill="none">
        {[[10, 800, 18, 640], [24, 800, 30, 660], [36, 800, 28, 690], [48, 800, 62, 650], [60, 800, 58, 700], [366, 800, 360, 670], [380, 800, 392, 650], [392, 800, 386, 690]].map(
          ([x1, y1, x2, y2], i) => (
            <path key={i} d={`M${x1} ${y1} Q${x1} ${(y1 + y2) / 2} ${x2} ${y2}`} strokeWidth="2.5" />
          )
        )}
      </g>
      <g fill="#02040a">
        <ellipse cx="18" cy="652" rx="3.5" ry="13" />
        <ellipse cx="62" cy="662" rx="3.5" ry="12" />
        <ellipse cx="392" cy="662" rx="3.5" ry="12" />
      </g>
    </>
  )
}

function Tramonto() {
  return (
    <>
      <defs>
        <linearGradient id="bs-tr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2e1065" />
          <stop offset="0.38" stopColor="#be185d" />
          <stop offset="0.62" stopColor="#f97316" />
          <stop offset="0.76" stopColor="#fcd34d" />
        </linearGradient>
        <radialGradient id="bs-tr-sun">
          <stop offset="0" stopColor="#fffbeb" />
          <stop offset="0.7" stopColor="#fde68a" />
          <stop offset="1" stopColor="#fbbf24" />
        </radialGradient>
        <radialGradient id="bs-tr-glow">
          <stop offset="0" stopColor="#fff7ed" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fb923c" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bs-tr-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a0c1c" />
          <stop offset="1" stopColor="#0d0309" />
        </linearGradient>
      </defs>
      <rect width="400" height="800" fill="url(#bs-tr-sky)" />
      <circle cx="170" cy="575" r="190" fill="url(#bs-tr-glow)" />
      <circle cx="170" cy="575" r="78" fill="url(#bs-tr-sun)" />
      <path d="M0 585 C 60 565, 110 575, 170 582 S 300 560, 400 578 L400 620 L0 620 Z" fill="#9a3412" opacity="0.55" />
      <path d="M0 605 C 50 598, 110 604, 170 600 S 300 596, 400 602 L400 800 L0 800 Z" fill="url(#bs-tr-ground)" />
      <g fill="#2a0c1c">
        <path d="M315 606 L322 606 L319 540 L352 486 L347 484 L317 528 L309 488 L303 489 L313 540 Z" />
        <ellipse cx="330" cy="478" rx="78" ry="14" />
        <ellipse cx="296" cy="486" rx="40" ry="9" />
        <ellipse cx="368" cy="485" rx="38" ry="9" />
        <ellipse cx="334" cy="466" rx="48" ry="10" />
        <g transform="translate(70 606) scale(0.62)">
          <path d={GIRAFFE} />
        </g>
        <g transform="translate(128 606) scale(0.44)">
          <path d={GIRAFFE} />
        </g>
      </g>
      <path d="M-34 -64 Q-50 -40 -46 -18" transform="translate(70 606) scale(0.62)" stroke="#2a0c1c" strokeWidth="3" fill="none" />
      <g stroke="#2a0c1c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {[[90, 300, 1.1], [112, 288, 0.9], [130, 310, 0.8], [246, 350, 0.9], [262, 340, 0.7]].map(([x, y, s], i) => (
          <path key={i} d={bird(x, y, s)} />
        ))}
      </g>
    </>
  )
}

// crop: inquadra la fascia dell'orizzonte, per riquadri bassi e larghi
export default function BioThemeScene({ scene, crop = false, className = '' }: { scene: BioSceneKey; crop?: boolean; className?: string }) {
  return (
    <svg
      viewBox={crop ? '0 330 400 340' : '0 0 400 800'}
      preserveAspectRatio={crop ? 'xMidYMid slice' : 'xMidYMax slice'}
      aria-hidden="true"
      className={className}
    >
      {scene === 'aurora' ? <Aurora /> : scene === 'notte' ? <Notte /> : <Tramonto />}
    </svg>
  )
}
