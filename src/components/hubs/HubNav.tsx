'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  AtSign,
  BadgeCheck,
  BookOpenCheck,
  BookUser,
  Briefcase,
  BriefcaseBusiness,
  Calculator,
  CalendarClock,
  CalendarDays,
  Camera,
  CarFront,
  Dices,
  Eye,
  FileLock2,
  FileText,
  FileUser,
  Flower2,
  Globe,
  Grid3x3,
  HeartPulse,
  House,
  Landmark,
  Link2,
  Lock,
  MailSearch,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  Music,
  PackageSearch,
  PanelsTopLeft,
  PhoneCall,
  PiggyBank,
  Puzzle,
  QrCode,
  Receipt,
  ScanSearch,
  ShieldCheck,
  ShieldUser,
  ShoppingBag,
  Signature,
  Stamp,
  Store,
  Tag,
  Timer,
  Users,
  UtensilsCrossed,
  VenetianMask,
  Wallet,
  Warehouse,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { HUB_TABS, hubOf, type ServiceHub } from '@/lib/serviceHubs'

const HUB_ICON: Record<ServiceHub, LucideIcon> = {
  controlla: ScanSearch,
  proteggi: ShieldCheck,
  segnala: Megaphone,
  benessere: Flower2,
  giochi: Dices,
  qr: QrCode,
  spendly: PiggyBank,
  lavoro: Briefcase,
  gestione: BookUser,
  ufficio: Signature,
  negozio: Store,
  vetrina: PanelsTopLeft,
  agenda: CalendarClock,
  casaauto: House,
}

// Icona di ogni scheda («servizio.scheda»)
const TAB_ICON: Record<string, LucideIcon> = {
  'controlla.all': ScanSearch,
  'controlla.site': Globe,
  'controlla.email': MailSearch,
  'controlla.photo': Camera,
  'controlla.iban': Landmark,
  'controlla.phone': PhoneCall,
  'proteggi.data': ShieldUser,
  'proteggi.documents': FileLock2,
  'segnala.network': Users,
  'segnala.manual': BookOpenCheck,
  'benessere.sounds': Music,
  'benessere.breathe': Wind,
  'benessere.focus': Timer,
  'benessere.mandala': Flower2,
  'benessere.senses': Eye,
  'giochi.crossword': Grid3x3,
  'giochi.veritas': VenetianMask,
  'giochi.fabula': Dices,
  'giochi.mosaic': Puzzle,
  'qr.invite': QrCode,
  'qr.pro': BadgeCheck,
  'spendly.accounts': Wallet,
  'spendly.checkup': HeartPulse,
  'spendly.shared': Users,
  'lavoro.jobs': BriefcaseBusiness,
  'lavoro.cv': FileUser,
  'gestione.clients': BookUser,
  'gestione.quotes': FileText,
  'gestione.receipts': Receipt,
  'gestione.warehouse': Warehouse,
  'gestione.calculators': Calculator,
  'ufficio.pdf': Signature,
  'ufficio.email': AtSign,
  'ufficio.hopla': MonitorSmartphone,
  'negozio.shop': ShoppingBag,
  'negozio.menu': UtensilsCrossed,
  'negozio.card': Stamp,
  'negozio.offers': Tag,
  'vetrina.bio': Link2,
  'vetrina.landing': PanelsTopLeft,
  'vetrina.whatsapp': MessageCircle,
  'agenda.agenda': CalendarDays,
  'agenda.deadlines': CalendarClock,
  'casaauto.home': House,
  'casaauto.car': CarFront,
  'casaauto.findo': PackageSearch,
}

// Barra comune in cima agli strumenti di un servizio unito: a sinistra il
// servizio con la sua icona, poi le schede come pulsanti con icona (quella
// aperta in oro). Le schede del piano che non si ha hanno il lucchetto
// (aprendole si arriva a dove si sbloccano); quelle spente dall'Admin non ci sono.
export default function HubNav({ locked, hidden = [] }: { locked: string[]; hidden?: string[] }) {
  const t = useTranslations('serviceHubs')
  const pathname = usePathname()
  const search = useSearchParams()
  const where = hubOf(pathname, search.toString())
  const scroller = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLElement>(null)
  const [top, setTop] = useState(0)
  // Sul telefono la barra scorre: la scheda aperta va sempre in vista
  useEffect(() => {
    const box = scroller.current
    const active = box?.querySelector<HTMLElement>('[aria-current="page"]')
    if (box && active) box.scrollLeft = active.offsetLeft - (box.clientWidth - active.offsetWidth) / 2
  }, [where?.hub, where?.tab])
  // La barra resta fissa sotto l'intestazione dello strumento (alta quanto
  // serve: sul telefono il titolo può andare a capo). Il suo bordo inferiore va
  // in --hub-bottom, per le anteprime che seguono lo scorrimento della pagina.
  useEffect(() => {
    const nav = bar.current
    if (!nav) return
    const prev = nav.previousElementSibling
    const header = prev instanceof HTMLElement && prev.matches('header.sticky') ? prev : document.querySelector<HTMLElement>('header.sticky')
    const update = () => {
      const h = header?.offsetHeight ?? 0
      setTop(h)
      document.documentElement.style.setProperty('--hub-bottom', `${h + nav.offsetHeight}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    if (header) observer.observe(header)
    observer.observe(nav)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--hub-bottom')
    }
  }, [where?.hub])
  if (!where) return null
  const Icon = HUB_ICON[where.hub]
  return (
    <nav
      ref={bar}
      aria-label={t(`${where.hub}.title`)}
      style={{ top }}
      className="sticky z-10 border-b border-[var(--gold)]/20 bg-[#0f0f0f] text-white print:hidden"
    >
      <div ref={scroller} className="relative mx-auto flex max-w-5xl items-center gap-3 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 lg:px-8">
        <span className="flex shrink-0 items-center gap-2 pr-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)]/15 text-[var(--gold-bright)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="hidden text-sm font-extrabold tracking-wide text-[var(--gold-bright)] sm:inline">{t(`${where.hub}.title`)}</span>
        </span>
        <span className="hidden h-6 w-px shrink-0 bg-white/15 sm:block" aria-hidden />
        <div className="flex gap-2">
          {HUB_TABS[where.hub]
            .filter((tab) => !tab.tool || !hidden.includes(tab.tool))
            .map((tab) => {
              const active = tab.key === where.tab
              const isLocked = !!tab.tool && locked.includes(tab.tool)
              const TabIcon = TAB_ICON[`${where.hub}.${tab.key}`] ?? Icon
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow-[0_0_18px_rgba(233,200,90,0.35)]'
                      : isLocked
                        ? 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80'
                        : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <TabIcon className="h-4 w-4" aria-hidden />
                  {t(`${where.hub}.tab_${tab.key}`)}
                  {isLocked && <Lock className="h-3.5 w-3.5" aria-label={t('locked')} />}
                </Link>
              )
            })}
        </div>
      </div>
    </nav>
  )
}
