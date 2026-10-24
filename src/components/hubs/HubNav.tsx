'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Star,
  Share2,
  Clapperboard,
  Captions,
  Hash,
  Palette,
  Crop,
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
  SunMoon,
  CalendarCheck,
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
  ShieldQuestion,
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
  Plane,
  HeartHandshake,
  PartyPopper,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { addFavorite, removeFavorite } from '@/app/actions/favorites'
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
  social: Share2,
  agenda: CalendarClock,
  casaauto: House,
  viaggi: Plane,
  amicizie: HeartHandshake,
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
  'segnala.test': ShieldQuestion,
  'benessere.sounds': Music,
  'benessere.breathe': Wind,
  'benessere.focus': Timer,
  'benessere.mandala': Flower2,
  'benessere.senses': Eye,
  'benessere.rhythm': SunMoon,
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
  'gestione.tempus': CalendarCheck,
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
  'social.tutela': ShieldCheck,
  'social.captio': Hash,
  'social.lumen': Clapperboard,
  'social.vox': Captions,
  'social.diarium': CalendarDays,
  'social.imago': Palette,
  'social.forma': Crop,
  'agenda.agenda': CalendarDays,
  'agenda.deadlines': CalendarClock,
  'casaauto.home': House,
  'casaauto.car': CarFront,
  'casaauto.findo': PackageSearch,
  'viaggi.trips': Plane,
  'amicizie.convivium': PartyPopper,
  'amicizie.affinity': HeartHandshake,
}

// Barra comune in cima agli strumenti di un servizio unito: a sinistra il
// servizio con la sua icona, poi le schede come pulsanti con icona (quella
// aperta in oro). Le schede del piano che non si ha hanno il lucchetto
// (aprendole si arriva a dove si sbloccano); quelle spente dall'Admin non ci sono.
// Stella «Metti nella Home» del servizio aperto: solo l'icona (vuota o
// piena), nella barra nera in alto accanto al nome del servizio. Solo con
// l'accesso (favorites non null).
function HomeStar({ tool, initial }: { tool: string; initial: boolean }) {
  const t = useTranslations('serviceHubs')
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    const next = !on
    setOn(next)
    setBusy(true)
    const result = next ? await addFavorite(tool) : await removeFavorite(tool)
    setBusy(false)
    if (!result.success) setOn(!next)
  }
  const label = on ? t('homeStarOn') : t('homeStarOff')
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors after:absolute after:-inset-1.5 after:content-[''] ${
        on ? 'text-[var(--gold-bright)]' : 'text-white/70 hover:text-[var(--gold-bright)]'
      }`}
    >
      <Star className="h-5 w-5" fill={on ? 'currentColor' : 'none'} aria-hidden />
    </button>
  )
}

export default function HubNav({ locked, hidden = [], favorites = null }: { locked: string[]; hidden?: string[]; favorites?: string[] | null }) {
  const t = useTranslations('serviceHubs')
  const pathname = usePathname()
  const search = useSearchParams()
  const where = hubOf(pathname, search.toString())
  const scroller = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLElement>(null)
  const [top, setTop] = useState(0)
  // Dove va la stella: il blocco del nome del servizio nella barra nera in alto
  const [starSlot, setStarSlot] = useState<HTMLElement | null>(null)
  // Dal tablet in su la barra scorre: la scheda aperta va sempre in vista
  useEffect(() => {
    const box = scroller.current
    const active = box?.querySelector<HTMLElement>('[aria-current="page"]')
    if (box && active && box.scrollWidth > box.clientWidth) box.scrollLeft = active.offsetLeft - (box.clientWidth - active.offsetWidth) / 2
  }, [where?.hub, where?.tab])
  // La barra resta fissa sotto l'intestazione dello strumento (alta quanto
  // serve: sul telefono il titolo può andare a capo; sull'iPhone l'intestazione
  // stessa si ferma sotto la barra di stato, e se ne tiene conto). Il bordo inferiore va
  // in --hub-bottom, per le anteprime che seguono lo scorrimento della pagina.
  useEffect(() => {
    const nav = bar.current
    if (!nav) return
    const prev = nav.previousElementSibling
    const header = prev instanceof HTMLElement && prev.matches('header.sticky') ? prev : document.querySelector<HTMLElement>('header.sticky')
    // Nome del servizio: l'ultimo elemento della riga dell'intestazione
    const row = header?.firstElementChild
    const slot = row && row.lastElementChild instanceof HTMLElement && row.childElementCount > 1 ? row.lastElementChild : null
    setStarSlot(slot)
    const update = () => {
      const h = header ? header.offsetHeight + (parseFloat(getComputedStyle(header).top) || 0) : 0
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
    // Anche cambiando scheda: la barra nera della pagina nuova riceve la stella
  }, [where?.hub, pathname])
  if (!where) return null
  const Icon = HUB_ICON[where.hub]
  // Servizio della scheda aperta (per la stella «Nella Home»)
  const currentTool = HUB_TABS[where.hub].find((tab) => tab.key === where.tab)?.tool
  return (
    <nav
      ref={bar}
      aria-label={t(`${where.hub}.title`)}
      style={{ top }}
      className="sticky z-10 border-b border-[var(--gold)]/20 bg-[#0f0f0f] text-white print:hidden"
    >
      {/* Una riga sola che scorre di lato, anche sul telefono (schede strette: più spazio per il servizio) */}
      <div ref={scroller} className="relative mx-auto flex max-w-5xl items-center gap-3 overflow-x-auto px-3 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6 sm:py-2.5 lg:px-8">
        <span className="hidden shrink-0 items-center gap-2 pr-1 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--gold)]/15 text-[var(--gold-bright)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="hidden text-sm font-extrabold tracking-wide text-[var(--gold-bright)] sm:inline">{t(`${where.hub}.title`)}</span>
        </span>
        <span className="hidden h-6 w-px shrink-0 bg-white/15 sm:block" aria-hidden />
        <div className="flex flex-none flex-nowrap gap-1.5 sm:gap-2">
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
                  className={`flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold sm:min-h-10 sm:gap-1.5 sm:px-3.5 sm:text-sm transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow-[0_0_18px_rgba(233,200,90,0.35)]'
                      : isLocked
                        ? 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white/80'
                        : 'bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  {t(`${where.hub}.tab_${tab.key}`)}
                  {isLocked && <Lock className="h-3.5 w-3.5" aria-label={t('locked')} />}
                </Link>
              )
            })}
        </div>
        {/* Senza la barra nera sopra (caso raro) la stella resta in fondo alla riga */}
        {favorites && currentTool && !locked.includes(currentTool) && !starSlot && <HomeStar key={currentTool} tool={currentTool} initial={favorites.includes(currentTool)} />}
      </div>
      {favorites && currentTool && !locked.includes(currentTool) && starSlot && createPortal(<HomeStar key={currentTool} tool={currentTool} initial={favorites.includes(currentTool)} />, starSlot)}
    </nav>
  )
}
