'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Smartphone,
  Link2,
  MessageCircle,
  QrCode,
  ShieldCheck,
  ScanEye,
  MailSearch,
  Hourglass,
  Warehouse,
  Grid3x3,
  Dices,
  Brain,
  CalendarClock,
  PackageSearch,
  FileCheck2,
  Waves,
  Tag,
  FileSpreadsheet,
  FileUser,
  Megaphone,
  Briefcase,
  Stethoscope,
  PiggyBank,
  Flower2,
  Star,
  Stamp,
  Wand2,
  UtensilsCrossed,
  HeartHandshake,
  VenetianMask,
  HandPlatter,
  Plane,
  PartyPopper,
  Info,
  X,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react'

type Category = 'marketing' | 'security' | 'personal' | 'wellness' | 'lavoro' | 'svago' | 'community'

type Tool = {
  icon: LucideIcon
  title: string
  desc: string
  category: Category
}

const CATEGORY_ORDER: Category[] = ['marketing', 'security', 'personal', 'wellness', 'lavoro', 'svago', 'community']

const CATEGORY_ICON: Record<Category, LucideIcon> = {
  marketing: Megaphone,
  security: ShieldCheck,
  personal: CalendarClock,
  wellness: Waves,
  lavoro: Briefcase,
  svago: VenetianMask,
  community: Tag,
}

// Raggruppa gli strumenti del marketplace per categoria (stessa suddivisione
// di src/lib/marketplaceTools.ts). Ogni categoria è chiusa di default: si
// apre solo cliccandoci sopra, mostrando gli strumenti come tessere
// compatte. Il bottone "i" cerchiato su ogni tessera apre un popup con la
// descrizione completa dello strumento, che prima stava scritta per intero
// sulla card (ora tolta per lasciare più spazio a icona e titolo).
export default function HomeToolsGrid() {
  const t = useTranslations('landingHome')
  const tc = useTranslations('marketplace')
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  // Ogni categoria è chiusa finché non ci si clicca sopra, come l'accordion
  // della dashboard (CategoryToolsAccordion) — evita di mostrare tutti gli
  // strumenti aperti insieme.
  const [openCategories, setOpenCategories] = useState<Set<Category>>(new Set())

  const toggleCategory = (category: Category) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const tools: Tool[] = [
    { icon: Smartphone, title: t('toolQrTitle'), desc: t('toolQrDescription'), category: 'marketing' },
    { icon: Link2, title: t('toolLinkBioTitle'), desc: t('toolLinkBioDescription'), category: 'marketing' },
    { icon: MessageCircle, title: t('toolWhatsappTitle'), desc: t('toolWhatsappDescription'), category: 'marketing' },
    { icon: QrCode, title: t('toolQrProTitle'), desc: t('toolQrProDescription'), category: 'marketing' },
    { icon: Stamp, title: tc('fidelity'), desc: tc('fidelityDescription'), category: 'marketing' },
    { icon: Wand2, title: t('toolOffermakerTitle'), desc: t('toolOffermakerDescription'), category: 'marketing' },
    { icon: UtensilsCrossed, title: tc('menu'), desc: tc('menuDescription'), category: 'marketing' },
    { icon: ShieldCheck, title: t('toolSvatTitle'), desc: t('toolSvatDescription'), category: 'security' },
    { icon: ScanEye, title: tc('verifoto'), desc: tc('verifotoDescription'), category: 'security' },
    { icon: MailSearch, title: tc('checkmail'), desc: tc('checkmailDescription'), category: 'security' },
    { icon: Brain, title: t('toolMemolifeTitle'), desc: t('toolMemolifeDescription'), category: 'personal' },
    { icon: CalendarClock, title: t('toolLifeCalendarTitle'), desc: t('toolLifeCalendarDescription'), category: 'personal' },
    { icon: PackageSearch, title: t('toolFindoTitle'), desc: t('toolFindoDescription'), category: 'personal' },
    { icon: FileCheck2, title: t('toolDigitalReceiptTitle'), desc: t('toolDigitalReceiptDescription'), category: 'lavoro' },
    { icon: PiggyBank, title: tc('spendly'), desc: tc('spendlyDescription'), category: 'personal' },
    { icon: Plane, title: tc('travel'), desc: tc('travelDescription'), category: 'personal' },
    { icon: Flower2, title: tc('mandala'), desc: tc('mandalaDescription'), category: 'wellness' },
    { icon: Waves, title: t('toolNeurobalanceTitle'), desc: t('toolNeurobalanceDescription'), category: 'wellness' },
    { icon: Stethoscope, title: tc('aureya'), desc: tc('aureyaDescription'), category: 'wellness' },
    { icon: FileSpreadsheet, title: tc('preventivi'), desc: tc('preventiviDescription'), category: 'lavoro' },
    { icon: Warehouse, title: tc('magazzino'), desc: tc('magazzinoDescription'), category: 'lavoro' },
    { icon: FileUser, title: tc('kumaniCv'), desc: tc('kumaniCvDescription'), category: 'personal' },
    { icon: HeartHandshake, title: tc('affinity'), desc: tc('affinityDescription'), category: 'svago' },
    { icon: VenetianMask, title: tc('veritas'), desc: tc('veritasDescription'), category: 'svago' },
    { icon: Grid3x3, title: tc('mosaic'), desc: tc('mosaicDescription'), category: 'svago' },
    { icon: Dices, title: tc('fabula'), desc: tc('fabulaDescription'), category: 'svago' },
    { icon: Tag, title: t('toolListingsTitle'), desc: t('toolListingsDescription'), category: 'community' },
    { icon: Star, title: tc('kumanoDelGiorno'), desc: tc('kumanoDelGiornoDescription'), category: 'community' },
    { icon: HandPlatter, title: tc('convivio'), desc: tc('convivioDescription'), category: 'community' },
    { icon: PartyPopper, title: tc('events'), desc: tc('eventsDescription'), category: 'community' },
    { icon: Hourglass, title: tc('timebank'), desc: tc('timebankDescription'), category: 'community' },
  ]

  const CATEGORY_LABEL: Record<Category, string> = {
    marketing: tc('categoryMarketing'),
    security: tc('categorySecurity'),
    personal: tc('categoryPersonal'),
    wellness: tc('categoryWellness'),
    lavoro: tc('categoryLavoro'),
    svago: tc('categorySvago'),
    community: tc('categoryCommunity'),
  }

  return (
    <>
      <div className="space-y-8">
        {CATEGORY_ORDER.map((category) => {
          const categoryTools = tools.filter((tool) => tool.category === category)
          if (categoryTools.length === 0) return null
          const CategoryIcon = CATEGORY_ICON[category]
          const isOpen = openCategories.has(category)

          return (
            <div key={category} className="rounded-xl border border-[var(--gold)]/15 bg-white/[0.02] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
                    <CategoryIcon className="h-4.5 w-4.5 text-[var(--ink)]" strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white truncate">{CATEGORY_LABEL[category]}</h3>
                    <p className="text-xs text-gray-400">{t('clickToSeeServices')}</p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3 p-4 pt-0">
                  {categoryTools.map((tool, index) => (
                    <div
                      key={index}
                      className="relative flex flex-col items-center justify-center text-center gap-1.5 py-4 px-2 rounded-xl bg-white/[0.03] border border-[var(--gold)]/15 hover:border-[var(--gold)]/50 hover:bg-white/[0.06] transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveTool(tool)}
                        className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-[var(--gold)] hover:text-[var(--ink)] transition-colors"
                        aria-label={tool.title}
                      >
                        <Info className="w-4.5 h-4.5" />
                      </button>
                      <tool.icon className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--gold-bright)]" strokeWidth={1.6} />
                      <span className="text-xs sm:text-sm font-bold text-white leading-tight">{tool.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {activeTool && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveTool(null)}
        >
          <div
            className="relative bg-[var(--ink-soft)] border border-[var(--gold)]/30 rounded-2xl max-w-md w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveTool(null)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              aria-label="Chiudi"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center mb-4">
              <activeTool.icon className="w-7 h-7 text-[var(--ink)]" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2 pr-8">{activeTool.title}</h3>
            <p className="text-gray-300 text-sm leading-relaxed">{activeTool.desc}</p>
          </div>
        </div>
      )}
    </>
  )
}
