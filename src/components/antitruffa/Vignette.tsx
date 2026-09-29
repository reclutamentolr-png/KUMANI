import type { ReactNode } from 'react'
import type { VignetteId } from '@/lib/antitruffa/types'

// Vignette esclusive del manuale anti-truffa: nero e oro, senza testo
// (valgono in ogni lingua). Il motivo ricorrente è l'amo d'oro: il
// truffatore "pesca" dati e soldi.
const GOLD = 'var(--gold)'
const BRIGHT = 'var(--gold-bright)'
const SOFT = 'rgba(255,255,255,0.18)'
const LINE = 'rgba(255,255,255,0.55)'

// Amo che scende dall'alto fino a (x, y)
function Hook({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={BRIGHT} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x} 0 V${y + 14} A10 10 0 0 1 ${x - 20} ${y + 14} V${y + 5} l6 6`} />
      <circle cx={x} cy={y - 4} r="2.5" fill={BRIGHT} />
    </g>
  )
}

// Maschera del truffatore
function Mask({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-22 -6 C-22 -16 -8 -14 0 -8 C8 -14 22 -16 22 -6 C22 6 12 10 0 4 C-12 10 -22 6 -22 -6 Z" fill={GOLD} />
      <ellipse cx="-10" cy="-4" rx="5" ry="3.2" fill="var(--ink)" />
      <ellipse cx="10" cy="-4" rx="5" ry="3.2" fill="var(--ink)" />
    </g>
  )
}

function Lines({ x, y, w, n = 3, gap = 9 }: { x: number; y: number; w: number; n?: number; gap?: number }) {
  return (
    <g stroke={LINE} strokeWidth="3" strokeLinecap="round">
      {Array.from({ length: n }, (_, i) => (
        <line key={i} x1={x} y1={y + i * gap} x2={x + (i === n - 1 ? w * 0.6 : w)} y2={y + i * gap} />
      ))}
    </g>
  )
}

function Alert({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 -13 L13 10 H-13 Z" fill={GOLD} />
      <rect x="-1.5" y="-5" width="3" height="8" rx="1.5" fill="var(--ink)" />
      <circle cx="0" cy="6.5" r="1.8" fill="var(--ink)" />
    </g>
  )
}

const SCENES: Record<VignetteId, ReactNode> = {
  // Telefono con SMS e link che nasconde un amo
  sms: (
    <>
      <rect x="84" y="18" width="72" height="116" rx="12" fill="none" stroke={LINE} strokeWidth="3" />
      <rect x="110" y="24" width="20" height="4" rx="2" fill={SOFT} />
      <path d="M94 42 h52 a6 6 0 0 1 6 6 v28 a6 6 0 0 1 -6 6 h-40 l-10 8 v-8 h-2 a6 6 0 0 1 -6 -6 v-28 a6 6 0 0 1 6 -6 Z" fill={SOFT} />
      <Lines x={100} y={52} w={40} n={2} />
      <rect x="100" y="68" width="30" height="7" rx="3.5" fill={GOLD} />
      <Hook x={196} y={60} />
      <path d="M131 71 C160 71 170 90 176 78" stroke={GOLD} strokeWidth="2" strokeDasharray="3 4" fill="none" />
      <Alert x={52} y={50} />
    </>
  ),
  // Busta con logo "ufficiale" e amo che esce
  email: (
    <>
      <rect x="50" y="42" width="130" height="84" rx="8" fill={SOFT} stroke={LINE} strokeWidth="3" />
      <path d="M52 46 L115 92 L178 46" fill="none" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="115" cy="104" r="11" fill={GOLD} />
      <path d="M110 104 l4 4 l7 -8" stroke="var(--ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <Mask x={64} y={30} s={0.9} />
      <Hook x={200} y={78} />
    </>
  ),
  // Due fumetti di chat: il "familiare" è una maschera
  whatsapp: (
    <>
      <path d="M36 34 h92 a10 10 0 0 1 10 10 v30 a10 10 0 0 1 -10 10 h-70 l-14 12 v-12 h-8 a10 10 0 0 1 -10 -10 v-30 a10 10 0 0 1 10 -10 Z" fill={SOFT} />
      <Lines x={50} y={50} w={70} n={2} gap={12} />
      <path d="M204 76 h-72 a10 10 0 0 0 -10 10 v24 a10 10 0 0 0 10 10 h54 l14 12 v-12 h4 a10 10 0 0 0 10 -10 v-24 a10 10 0 0 0 -10 -10 Z" fill={GOLD} opacity="0.9" />
      <text x="163" y="106" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink)">€ ?</text>
      <Mask x={196} y={40} s={1} />
    </>
  ),
  // Cornetta con onde sonore e voce "clonata"
  call: (
    <>
      <path d="M70 40 c-10 0 -16 8 -14 18 c6 34 32 60 66 66 c10 2 18 -4 18 -14 v-12 l-22 -8 l-10 10 c-14 -6 -24 -16 -30 -30 l10 -10 l-8 -22 Z" fill={GOLD} />
      <g stroke={LINE} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M150 50 a22 22 0 0 1 0 30" />
        <path d="M162 40 a36 36 0 0 1 0 50" />
      </g>
      <g stroke={BRIGHT} strokeWidth="3" strokeLinecap="round">
        {[0, 1, 2, 3, 4, 5, 6].map(i => {
          const h = [8, 18, 30, 14, 24, 10, 6][i]
          return <line key={i} x1={186 + i * 7} y1={66 - h / 2} x2={186 + i * 7} y2={66 + h / 2} />
        })}
      </g>
      <Mask x={210} y={112} s={0.8} />
    </>
  ),
  // Parcometro con adesivo QR incollato sopra
  qr: (
    <>
      <rect x="92" y="22" width="56" height="84" rx="8" fill={SOFT} stroke={LINE} strokeWidth="3" />
      <rect x="112" y="106" width="16" height="30" fill={SOFT} />
      <rect x="102" y="34" width="36" height="14" rx="3" fill="none" stroke={LINE} strokeWidth="2" />
      <g transform="translate(104 56) rotate(-6)">
        <rect width="34" height="34" rx="3" fill={GOLD} />
        {[[4, 4], [22, 4], [4, 22]].map(([a, b], i) => (
          <rect key={i} x={a} y={b} width="8" height="8" fill="var(--ink)" />
        ))}
        <rect x="15" y="15" width="4" height="4" fill="var(--ink)" />
        <rect x="23" y="23" width="6" height="4" fill="var(--ink)" />
        <path d="M34 26 L26 34 L34 34 Z" fill={BRIGHT} />
      </g>
      <Hook x={186} y={70} />
      <Alert x={56} y={60} />
    </>
  ),
  // Borsa della spesa con sconto esagerato e scatola vuota
  shop: (
    <>
      <path d="M60 58 h70 l-6 72 h-58 Z" fill={SOFT} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 58 v-10 a17 17 0 0 1 34 0 v10" fill="none" stroke={LINE} strokeWidth="3" />
      <g transform="translate(150 40) rotate(12)">
        <path d="M0 0 h50 l12 16 l-12 16 h-50 Z" fill={GOLD} />
        <circle cx="50" cy="16" r="3" fill="var(--ink)" />
        <text x="22" y="22" textAnchor="middle" fontSize="15" fontWeight="800" fill="var(--ink)">-80%</text>
      </g>
      <path d="M150 96 l26 -10 l26 10 v30 l-26 10 l-26 -10 Z" fill="none" stroke={LINE} strokeWidth="3" strokeDasharray="5 5" />
      <text x="176" y="120" textAnchor="middle" fontSize="18" fontWeight="700" fill={BRIGHT}>?</text>
    </>
  ),
  // Grafico che sale, dietro un volto finto (deepfake)
  invest: (
    <>
      <rect x="40" y="30" width="110" height="80" rx="8" fill={SOFT} />
      <polyline points="50,96 72,84 90,88 110,64 128,70 142,42" fill="none" stroke={GOLD} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M134 40 l10 0 l0 10" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
      <circle cx="186" cy="58" r="22" fill="none" stroke={LINE} strokeWidth="3" />
      <path d="M160 108 c4 -18 14 -24 26 -24 s22 6 26 24" fill="none" stroke={LINE} strokeWidth="3" />
      <Mask x={186} y={58} s={0.95} />
      <g fill={BRIGHT}>
        <ellipse cx="80" cy="128" rx="10" ry="4" />
        <ellipse cx="102" cy="124" rx="10" ry="4" opacity="0.7" />
      </g>
      <ellipse cx="124" cy="130" rx="18" ry="5" fill="#000" stroke={GOLD} strokeWidth="2" />
    </>
  ),
  // Cuore preso all'amo
  romance: (
    <>
      <path d="M120 128 C70 96 56 72 64 54 C72 36 98 36 120 58 C142 36 168 36 176 54 C184 72 170 96 120 128 Z" fill={GOLD} />
      <path d="M100 58 c-8 0 -14 6 -14 12" stroke="var(--ink)" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.4" />
      <Hook x={138} y={40} />
      <Mask x={200} y={32} s={0.8} />
    </>
  ),
  // "Like" pagati che diventano una trappola
  job: (
    <>
      <path d="M52 76 h14 v44 h-14 Z" fill={GOLD} />
      <path d="M70 118 v-40 l20 -30 c6 -6 14 -2 12 8 l-4 16 h24 c8 0 12 6 10 12 l-8 28 c-2 6 -6 8 -12 8 Z" fill={GOLD} />
      <g fill={BRIGHT}>
        <circle cx="160" cy="44" r="10" />
        <circle cx="180" cy="36" r="10" opacity="0.7" />
      </g>
      <path d="M146 96 h64 l-8 32 h-48 Z" fill="none" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <g stroke={BRIGHT} strokeWidth="3" strokeLinecap="round">
        <line x1="156" y1="96" x2="162" y2="84" />
        <line x1="170" y1="96" x2="170" y2="82" />
        <line x1="184" y1="96" x2="178" y2="84" />
        <line x1="198" y1="96" x2="192" y2="84" />
      </g>
      <path d="M170 60 v14 m-6 -6 l6 6 l6 -6" stroke={LINE} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  // Webcam che osserva e lucchetto
  blackmail: (
    <>
      <rect x="44" y="30" width="120" height="78" rx="8" fill={SOFT} stroke={LINE} strokeWidth="3" />
      <path d="M84 118 h40 l6 12 h-52 Z" fill={SOFT} />
      <circle cx="104" cy="22" r="6" fill={GOLD} />
      <path d="M72 70 C84 52 124 52 136 70 C124 88 84 88 72 70 Z" fill="none" stroke={GOLD} strokeWidth="3" />
      <circle cx="104" cy="70" r="9" fill={GOLD} />
      <g transform="translate(196 78)">
        <path d="M-12 -6 v-8 a12 12 0 0 1 24 0 v8" fill="none" stroke={BRIGHT} strokeWidth="4" />
        <rect x="-18" y="-6" width="36" height="30" rx="5" fill={BRIGHT} />
        <text x="0" y="16" textAnchor="middle" fontSize="16" fontWeight="800" fill="var(--ink)">₿</text>
      </g>
    </>
  ),
  // Documento d'identità "pescato"
  identity: (
    <>
      <g transform="rotate(-8 110 88)">
        <rect x="52" y="54" width="120" height="72" rx="8" fill={SOFT} stroke={LINE} strokeWidth="3" />
        <circle cx="82" cy="82" r="12" fill={GOLD} />
        <path d="M64 114 c2 -12 10 -16 18 -16 s16 4 18 16" fill={GOLD} />
        <Lines x={112} y={78} w={46} n={3} gap={11} />
      </g>
      <Hook x={180} y={32} />
      <path d="M160 60 C150 58 150 52 152 48" stroke={BRIGHT} strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  // Fattura con IBAN sostituito
  invoice: (
    <>
      <path d="M62 20 h72 l20 20 v94 h-92 Z" fill={SOFT} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M134 20 v20 h20" fill="none" stroke={LINE} strokeWidth="3" />
      <Lines x={74} y={52} w={62} n={3} gap={10} />
      <rect x="72" y="92" width="70" height="12" rx="3" fill="none" stroke={LINE} strokeWidth="2" strokeDasharray="4 3" />
      <rect x="72" y="110" width="70" height="12" rx="3" fill={GOLD} />
      <g stroke={BRIGHT} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M170 78 h30 m-8 -8 l8 8 l-8 8" />
        <path d="M200 102 h-30 m8 -8 l-8 8 l8 8" />
      </g>
      <Mask x={186} y={126} s={0.8} />
    </>
  ),
}

export default function Vignette({ id, className }: { id: VignetteId; className?: string }) {
  return (
    <svg
      viewBox="0 0 240 150"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="240" height="150" rx="18" fill="var(--ink)" />
      <circle cx="220" cy="10" r="46" fill={GOLD} opacity="0.08" />
      {SCENES[id]}
    </svg>
  )
}
