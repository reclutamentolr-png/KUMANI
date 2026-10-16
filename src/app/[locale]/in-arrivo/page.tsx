import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'

// «KUMANI sta arrivando»: la pagina che il proxy mostra a chi non è iscritto
// mentre il pre-lancio è acceso (lib/prelaunch). A lancio fatto il proxy la
// rimanda alla Home. Fuori dai motori di ricerca: si indicizza il sito vero.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('comingSoon')
  return { title: t('metaTitle'), description: t('subtitle'), robots: { index: false, follow: false } }
}

export default async function ComingSoonPage() {
  const t = await getTranslations('comingSoon')
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--ink)] bg-[radial-gradient(circle_at_50%_38%,rgba(199,154,59,0.28),transparent_60%)] px-6 py-16 text-center text-white">
      {/* Medaglione che gira su se stesso, con il riflesso dorato sotto */}
      <div className="coming-soon-stage relative mb-10 h-44 w-44 sm:h-56 sm:w-56">
        <div className="absolute inset-0 rounded-full bg-[var(--gold)]/25 blur-3xl" aria-hidden />
        {/* Due facce, come una moneta: girando non si vede mai il logo a specchio */}
        <div className="coming-soon-coin relative h-full w-full">
          <Image src="/senza_sfondo.png" alt="KUMANI" width={224} height={224} priority className="coming-soon-face absolute inset-0 h-full w-full object-cover" />
          <Image src="/senza_sfondo.png" alt="" width={224} height={224} priority className="coming-soon-face coming-soon-back absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="coming-soon-shadow absolute -bottom-8 left-1/2 h-4 w-28 -translate-x-1/2 rounded-full bg-black/60 blur-md" aria-hidden />
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gold-bright)]">{t('eyebrow')}</p>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{t('title')}</h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">{t('subtitle')}</p>

      <div className="mt-10 flex items-center gap-2 text-sm text-white/60" aria-hidden>
        <span className="coming-soon-dot h-2 w-2 rounded-full bg-[var(--gold-bright)]" />
        <span className="coming-soon-dot h-2 w-2 rounded-full bg-[var(--gold-bright)] [animation-delay:200ms]" />
        <span className="coming-soon-dot h-2 w-2 rounded-full bg-[var(--gold-bright)] [animation-delay:400ms]" />
      </div>

      <p className="absolute bottom-6 left-0 right-0 text-sm text-white/50">
        {t('member')}{' '}
        <Link href="/login" className="font-semibold text-[var(--gold-bright)] underline-offset-4 hover:underline">
          {t('login')}
        </Link>
      </p>
    </main>
  )
}
