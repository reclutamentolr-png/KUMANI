// Figure animate della «Pausa di un minuto»: una per ogni movimento dello
// stretching (spalle, collo, braccia, busto) e del riposo degli occhi (guarda
// lontano, occhi chiusi con il respiro, battito delle palpebre). Solo SVG e
// CSS, niente file da scaricare; con «riduci movimento» la figura resta ferma.
export type PauseArtKey = 'wellnessStretch1' | 'wellnessStretch2' | 'wellnessStretch3' | 'wellnessStretch4' | 'wellnessEyes1' | 'wellnessEyes2' | 'wellnessEyes3'

const INK = '#0f766e'
const FILL = '#ccfbf1'
const SOFT = '#99f6e4'

const CSS = `
.wpa * { transform-box: view-box; }
.wpa-shrug { animation: wpa-shrug 2.4s ease-in-out infinite; }
@keyframes wpa-shrug { 0%, 15%, 85%, 100% { transform: translateY(0); } 40%, 60% { transform: translateY(-9px); } }
.wpa-shrug-body { transform-origin: 100px 152px; animation: wpa-shrug-body 2.4s ease-in-out infinite; }
@keyframes wpa-shrug-body { 0%, 15%, 85%, 100% { transform: scaleY(1); } 40%, 60% { transform: scaleY(1.07); } }
.wpa-tilt { transform-origin: 100px 66px; animation: wpa-tilt 5s ease-in-out infinite; }
@keyframes wpa-tilt { 0%, 100% { transform: rotate(0); } 20%, 35% { transform: rotate(-22deg); } 50% { transform: rotate(0); } 65%, 80% { transform: rotate(22deg); } }
.wpa-reach { animation: wpa-reach 3s ease-in-out infinite; }
@keyframes wpa-reach { 0%, 100% { transform: translateY(0); } 45%, 60% { transform: translateY(-7px); } }
.wpa-grow { transform-origin: 100px 152px; animation: wpa-grow 3s ease-in-out infinite; }
@keyframes wpa-grow { 0%, 100% { transform: scaleY(1); } 45%, 60% { transform: scaleY(1.04); } }
.wpa-twist { transform-origin: 100px 152px; animation: wpa-twist 5s ease-in-out infinite; }
@keyframes wpa-twist { 0%, 100% { transform: none; } 20%, 35% { transform: translateX(-5px) scaleX(0.78); } 50% { transform: none; } 65%, 80% { transform: translateX(5px) scaleX(0.78); } }
.wpa-head-turn { animation: wpa-head-turn 5s ease-in-out infinite; }
@keyframes wpa-head-turn { 0%, 100% { transform: none; } 20%, 35% { transform: translateX(-4px); } 50% { transform: none; } 65%, 80% { transform: translateX(4px); } }
.wpa-gaze { animation: wpa-gaze 1.6s linear infinite; }
@keyframes wpa-gaze { to { stroke-dashoffset: -16; } }
.wpa-focus { transform-origin: 54px 80px; animation: wpa-focus 3s ease-in-out infinite; }
@keyframes wpa-focus { 0%, 100% { transform: scale(1); } 50% { transform: scale(0.8); } }
.wpa-breath { transform-origin: 100px 80px; animation: wpa-breath 8s ease-in-out infinite; }
@keyframes wpa-breath { 0%, 100% { transform: scale(0.82); opacity: 0.45; } 50% { transform: scale(1.12); opacity: 0.9; } }
.wpa-blink { animation: wpa-blink 1.8s ease-in-out infinite; }
.wpa-blink-l { transform-origin: 66px 80px; }
.wpa-blink-r { transform-origin: 134px 80px; }
@keyframes wpa-blink { 0%, 40%, 56%, 100% { transform: scaleY(1); } 48% { transform: scaleY(0.08); } }
.wpa-arrow { animation: wpa-arrow 2.4s ease-in-out infinite; }
@keyframes wpa-arrow { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .wpa * { animation: none !important; } }
`

// Persona vista di fronte (dalla vita in su), in stile illustrazione piatta:
// pelle, capelli, maglietta, braccia con gomito e mani
const SKIN = '#f1c4a1'
const SKIN_SHADE = '#e2a682'
const HAIR = '#3b3330'
const SHIRT = '#14b8a6'
const SHIRT_SHADE = '#0f9488'
const FACE = '#3b3330'

function Head({ eyesClosed = false }: { eyesClosed?: boolean }) {
  return (
    <g>
      {/* Collo con l'ombra sotto il mento */}
      <path d="M93 54 L93 69 Q100 74 107 69 L107 54 Z" fill={SKIN} />
      <path d="M93 58 Q100 64 107 58 L107 54 L93 54 Z" fill={SKIN_SHADE} />
      {/* Orecchie */}
      <ellipse cx="84.5" cy="44" rx="3.6" ry="5" fill={SKIN_SHADE} />
      <ellipse cx="115.5" cy="44" rx="3.6" ry="5" fill={SKIN_SHADE} />
      {/* Viso */}
      <ellipse cx="100" cy="42" rx="15.5" ry="17.5" fill={SKIN} />
      {/* Capelli */}
      <path d="M84 41 C82 24 92 19 101 19 C112 19 119 26 116 41 C114 34 110 30 104 29 C97 33 89 33 84 41 Z" fill={HAIR} />
      {/* Guance */}
      <circle cx="91" cy="49" r="3" fill="#f59e8b" opacity="0.35" />
      <circle cx="109" cy="49" r="3" fill="#f59e8b" opacity="0.35" />
      {eyesClosed ? (
        <g stroke={FACE} strokeWidth="1.8" strokeLinecap="round" fill="none">
          <path d="M91.5 43.5 q3 2.4 6 0" />
          <path d="M102.5 43.5 q3 2.4 6 0" />
        </g>
      ) : (
        <g fill={FACE}>
          <ellipse cx="94.5" cy="43" rx="1.8" ry="2.2" />
          <ellipse cx="105.5" cy="43" rx="1.8" ry="2.2" />
        </g>
      )}
      <g stroke={FACE} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M91.5 38.5 q3 -1.6 6 0" />
        <path d="M102.5 38.5 q3 -1.6 6 0" />
      </g>
      <path d="M96 52 q4 3 8 0" stroke="#b45c4a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </g>
  )
}

function Torso() {
  return (
    <g>
      <path d="M100 66 C86 66 74 68 69 76 C64 83 63 92 64 101 L67 152 L133 152 L136 101 C137 92 136 83 131 76 C126 68 114 66 100 66 Z" fill={SHIRT} />
      {/* Pieghe e ombra della maglietta */}
      <path d="M100 66 C114 66 126 68 131 76 C136 83 137 92 136 101 L133 152 L118 152 C122 120 124 92 120 70 Z" fill={SHIRT_SHADE} opacity="0.55" />
      {/* Scollo */}
      <path d="M92 67 Q100 77 108 67 Q100 70 92 67 Z" fill={SKIN} />
      <path d="M90 66.5 Q100 80 110 66.5" stroke={SHIRT_SHADE} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </g>
  )
}

// Braccio: manica (spalla-gomito), avambraccio e mano
function Arm({ shoulder, elbow, hand, mirror = false }: { shoulder: [number, number]; elbow: [number, number]; hand: [number, number]; mirror?: boolean }) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={`M${elbow[0]} ${elbow[1]} L${hand[0]} ${hand[1]}`} stroke={SKIN} strokeWidth="9.5" />
      <path d={`M${shoulder[0]} ${shoulder[1]} L${elbow[0]} ${elbow[1]}`} stroke={mirror ? SHIRT_SHADE : SHIRT} strokeWidth="13" />
      <circle cx={hand[0]} cy={hand[1]} r="6" fill={SKIN} />
    </g>
  )
}

const ARMS_DOWN = (
  <g>
    <Arm shoulder={[71, 82]} elbow={[64, 112]} hand={[64, 141]} />
    <Arm shoulder={[129, 82]} elbow={[136, 112]} hand={[136, 141]} mirror />
  </g>
)

function Arrow({ d, className = 'wpa-arrow' }: { d: string; className?: string }) {
  return (
    <g className={className}>
      <path d={d} stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  )
}

function Shoulders() {
  return (
    <>
      <g className="wpa-shrug-body">
        <Torso />
      </g>
      <g className="wpa-shrug">
        {ARMS_DOWN}
        <Head />
      </g>
      <Arrow d="M40 92 V68 M33 75 L40 68 L47 75" />
      <Arrow d="M160 92 V68 M153 75 L160 68 L167 75" />
    </>
  )
}

function Neck() {
  return (
    <>
      <g className="wpa-tilt">
        <Head eyesClosed />
      </g>
      <Torso />
      {ARMS_DOWN}
      <Arrow d="M58 34 Q66 18 80 14" />
      <Arrow d="M142 34 Q134 18 120 14" />
    </>
  )
}

function Arms() {
  return (
    <>
      <g className="wpa-grow">
        <Torso />
      </g>
      <g className="wpa-reach">
        <g transform="translate(0 8)">
          <Head />
        </g>
        <Arm shoulder={[72, 82]} elbow={[63, 48]} hand={[95, 13]} />
        <Arm shoulder={[128, 82]} elbow={[137, 48]} hand={[105, 13]} mirror />
      </g>
      <Arrow d="M168 40 V12 M161 19 L168 12 L175 19" />
    </>
  )
}

function Twist() {
  return (
    <>
      <g className="wpa-twist">
        <Torso />
        {ARMS_DOWN}
      </g>
      <g className="wpa-head-turn">
        <Head />
      </g>
      {/* Freccia curva sopra la testa: rotazione del busto */}
      <Arrow d="M56 26 Q100 4 144 26 M136 18 L144 26 L134 29 M64 18 L56 26 L66 29" />
    </>
  )
}

// Occhio a mandorla con sopracciglio, ciglia e iride (spostata verso dove guarda)
function Eye({ cx, look = 0, className }: { cx: number; look?: number; className?: string }) {
  return (
    <g className={className}>
      <path d={`M${cx - 22} 66 Q${cx} 52 ${cx + 22} 64`} stroke={HAIR} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d={`M${cx - 24} 80 Q${cx} 60 ${cx + 24} 80 Q${cx} 100 ${cx - 24} 80 Z`} fill="#fff" stroke={FACE} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={cx + look} cy="80" r="9.5" fill="#7c5a3c" />
      <circle cx={cx + look} cy="80" r="4.5" fill="#1f1a17" />
      <circle cx={cx + look + 3} cy="77" r="2" fill="#fff" />
      <path d={`M${cx - 24} 80 Q${cx} 60 ${cx + 24} 80`} stroke={FACE} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </g>
  )
}

function LookFar() {
  return (
    <>
      <g className="wpa-focus">
        <Eye cx={46} look={8} />
      </g>
      {/* Lo sguardo che va lontano */}
      <path className="wpa-gaze" d="M76 80 H120" stroke={INK} strokeWidth="2.5" strokeDasharray="5 3" strokeLinecap="round" />
      <text x="98" y="72" textAnchor="middle" fontSize="11" fontWeight="700" fill={INK} fontFamily="system-ui, sans-serif">6 m</text>
      {/* Finestra con il paesaggio lontano */}
      <rect x="124" y="40" width="62" height="80" rx="6" fill="#f0fdfa" stroke={INK} strokeWidth="3" />
      <path d="M155 40 V120 M124 80 H186" stroke={INK} strokeWidth="2" opacity="0.35" />
      <circle cx="171" cy="56" r="6" fill="#fde68a" stroke="#d97706" strokeWidth="2" />
      <path d="M126 112 L142 92 L152 104 L164 86 L184 112 Z" fill={SOFT} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </>
  )
}

function ClosedEyes() {
  return (
    <>
      <circle className="wpa-breath" cx="100" cy="80" r="58" fill={FILL} />
      <g stroke={FACE} strokeLinecap="round" fill="none">
        <path d="M46 62 Q66 52 86 60" stroke={HAIR} strokeWidth="4" />
        <path d="M114 60 Q134 52 154 62" stroke={HAIR} strokeWidth="4" />
        <path d="M46 78 Q66 94 86 78" strokeWidth="3.5" />
        <path d="M114 78 Q134 94 154 78" strokeWidth="3.5" />
        <path d="M52 86 l-4 6 M66 90 v7 M80 86 l4 6" strokeWidth="2.5" />
        <path d="M120 86 l-4 6 M134 90 v7 M148 86 l4 6" strokeWidth="2.5" />
      </g>
    </>
  )
}

function Blink() {
  return (
    <>
      <g className="wpa-blink wpa-blink-l">
        <Eye cx={66} />
      </g>
      <g className="wpa-blink wpa-blink-r">
        <Eye cx={134} />
      </g>
    </>
  )
}

const ART: Record<PauseArtKey, () => React.ReactElement> = {
  wellnessStretch1: Shoulders,
  wellnessStretch2: Neck,
  wellnessStretch3: Arms,
  wellnessStretch4: Twist,
  wellnessEyes1: LookFar,
  wellnessEyes2: ClosedEyes,
  wellnessEyes3: Blink,
}

export default function WellnessPauseArt({ step }: { step: PauseArtKey }) {
  const Art = ART[step]
  return (
    <svg viewBox="0 0 200 160" className="wpa h-40 w-auto max-w-full" role="img" aria-hidden>
      <style>{CSS}</style>
      <Art />
    </svg>
  )
}
