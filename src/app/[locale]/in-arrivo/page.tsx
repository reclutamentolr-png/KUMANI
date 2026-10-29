import type { Metadata } from 'next'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Briefcase, Dices, Flower2, Palette, PiggyBank, Share2, ShieldCheck, Store, Users, type LucideIcon, AudioLines } from 'lucide-react'
import { SERVICE_GROUPS, type ServiceGroup } from '@/lib/serviceGroups'

// «KUMANI sta arrivando»: la pagina che il proxy mostra a chi non è iscritto
// mentre il pre-lancio è acceso (lib/prelaunch). A lancio fatto il proxy la
// rimanda alla Home. Fuori dai motori di ricerca: si indicizza il sito vero.
// Niente link all'accesso: da lì si arriverebbe alla registrazione; chi ha
// un account va direttamente su /login.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('comingSoon')
  return { title: t('metaTitle'), description: t('subtitle'), robots: { index: false, follow: false } }
}

// Le categorie della pagina Servizi, con la loro icona, più la Community:
// chi aspetta il lancio vede già cosa troverà
const GROUP_ICON: Record<ServiceGroup, LucideIcon> = { security: ShieldCheck, money: PiggyBank, work: Briefcase, business: Store, social: Share2, wellness: Flower2, fun: Dices, audio: AudioLines, kids: Palette }

export default async function ComingSoonPage() {
  const [t, th] = await Promise.all([getTranslations('comingSoon'), getTranslations('hub')])
  const categories = [...SERVICE_GROUPS.map((group) => ({ key: group, label: th(`group_${group}`), Icon: GROUP_ICON[group] })), { key: 'community', label: t('community'), Icon: Users }]
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[var(--ink)] bg-[radial-gradient(circle_at_50%_38%,rgba(199,154,59,0.28),transparent_60%)] px-6 py-16 text-center text-white">
      {/* Medaglione che gira su se stesso, con il riflesso dorato sotto */}
      <div className="coming-soon-stage relative mb-10 h-44 w-44 sm:h-56 sm:w-56">
        <div className="absolute inset-0 rounded-full bg-[var(--gold)]/25 blur-3xl" aria-hidden />
        {/* Un'immagine sola: girando non si vedono mai il retro né due loghi sovrapposti */}
        <div className="coming-soon-coin relative h-full w-full">
          <Image src="/senza_sfondo.png" alt="KUMANI" width={224} height={224} priority className="h-full w-full object-cover" />
        </div>
        <div className="coming-soon-shadow absolute -bottom-8 left-1/2 h-4 w-28 -translate-x-1/2 rounded-full bg-black/60 blur-md" aria-hidden />
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gold-bright)]">{t('eyebrow')}</p>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{t('title')}</h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">{t('subtitle')}</p>

      <ul className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
        {categories.map(({ key, label, Icon }) => (
          <li key={key} className="flex items-center gap-2 rounded-full border border-[var(--gold)]/35 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/90">
            <Icon className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden /> {label}
          </li>
        ))}
      </ul>

      <div className="mt-10 flex items-center gap-2 text-sm text-white/60" aria-hidden>
        <span className="coming-soon-dot h-2 w-2 rounded-full bg-[var(--gold-bright)]" />
        <span className="coming-soon-dot h-2 w-2 rounded-full bg-[var(--gold-bright)] [animation-delay:200ms]" />
        <span className="coming-soon-dot h-2 w-2 rounded-full bg-[var(--gold-bright)] [animation-delay:400ms]" />
      </div>
      <p className="mt-5 font-semibold italic tracking-wide text-[var(--gold-bright)] sm:text-lg">{t('slogan')}</p>
    </main>
  )
}
