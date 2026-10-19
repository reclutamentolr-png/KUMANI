// Cappello di Babbo Natale da appoggiare in diagonale su un logo rotondo
// (Admin → Natale). Va dentro un contenitore position: relative grande come
// il logo: il cappello sporge in alto a destra e non prende i clic.
export default function SantaHat({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 84"
      className={`pointer-events-none absolute -right-[16%] -top-[30%] w-[76%] rotate-[20deg] drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)] ${className}`}
    >
      {/* Corpo rosso, con la punta che ricade a destra */}
      <path d="M12 62 C 14 36, 34 12, 62 10 C 80 9, 92 18, 95 34 L 88 37 C 85 28, 79 23, 71 24 C 70 38, 76 50, 84 62 Z" fill="#c8102e" />
      <path d="M62 10 C 80 9, 92 18, 95 34 L 88 37 C 85 28, 79 23, 71 24 C 66 18, 64 14, 62 10 Z" fill="#9e0b22" />
      <path d="M22 58 C 26 38, 40 20, 58 15" fill="none" stroke="#ff6b7d" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      {/* Bordo di pelliccia */}
      <rect x="4" y="56" width="88" height="20" rx="10" fill="#fbf7ef" />
      <rect x="4" y="66" width="88" height="10" rx="5" fill="#e7dfcf" opacity="0.7" />
      {/* Pon pon */}
      <circle cx="92" cy="38" r="10" fill="#fbf7ef" />
      <circle cx="95" cy="41" r="5" fill="#e7dfcf" opacity="0.7" />
    </svg>
  )
}
