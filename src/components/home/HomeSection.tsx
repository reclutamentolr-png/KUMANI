import Image from 'next/image'
import type { SectionBg } from '@/lib/homeLayouts'

// Sfondo delle sezioni della homepage secondo il layout scelto dall'Admin.
// Le sezioni chiare (home-light) adattano da sole i colori dei testi pensati
// per il fondo scuro (vedi globals.css).
const VARIANT: Record<NonNullable<SectionBg['variant']>, string> = {
  plain: '',
  shade: 'bg-black/20',
  dots: 'bg-[#1a1916] home-tex-dots',
  lines: 'home-tex-lines',
  glow: 'home-glow',
  radial: 'bg-[radial-gradient(ellipse_at_70%_0%,#3a2e17_0%,var(--ink)_60%)]',
  cream: 'bg-[var(--background)]',
  paper: 'bg-[var(--paper)]',
  cta: 'bg-gradient-to-r from-[var(--ink)] via-[var(--ink-soft)] to-[var(--ink)] border-y border-[var(--gold)]/25',
}

export function bgClasses(bg: SectionBg) {
  return `${bg.tone === 'light' ? 'home-light' : ''} ${VARIANT[bg.variant ?? 'plain']}`
}

export default function HomeSection({
  bg,
  className = '',
  priority = false,
  children,
}: {
  bg: SectionBg
  className?: string
  priority?: boolean
  children: React.ReactNode
}) {
  return (
    <section className={`relative overflow-hidden ${bgClasses(bg)} ${className}`}>
      {bg.image && (
        <>
          <Image src={bg.image} alt="" fill priority={priority} sizes="100vw" className="object-cover" />
          <div
            aria-hidden
            className={`absolute inset-0 bg-gradient-to-b ${
              bg.overlay === 'soft'
                ? 'from-[rgba(15,13,10,0.55)] via-[rgba(15,13,10,0.45)] to-[rgba(15,13,10,0.8)]'
                : 'from-[rgba(15,13,10,0.86)] via-[rgba(15,13,10,0.8)] to-[rgba(15,13,10,0.92)]'
            }`}
          />
        </>
      )}
      <div className="relative">{children}</div>
    </section>
  )
}
