// Color palette for the PUBLIC "link in bio" landing page only — the
// dashboard/editor chrome around it keeps the app's own styling. This is a
// separate concept from the brand's gold/ink (--gold/--ink) system: each
// Kumano picks one of these to theme their own personal page.

export type BioThemeKey =
  | 'nero'
  | 'bianco'
  | 'oro'
  | 'rosso'
  | 'rosa'
  | 'arancione'
  | 'giallo'
  | 'verde'
  | 'azzurro'
  | 'blu'
  | 'viola'
  | 'grigio'
  // Temi speciali con sfondo illustrato: ognuno si sblocca a parte con i
  // KU (Gestione KU → linkinbio_theme_<chiave>).
  | 'aurora'
  | 'notte'
  | 'tramonto'

export type BioSceneKey = 'aurora' | 'notte' | 'tramonto'

export interface BioThemeStyle {
  key: BioThemeKey
  label: string
  // Sfondo illustrato (components/BioThemeScene) sopra a pageBg
  scene?: BioSceneKey
  swatchClass: string
  pageBg: string
  cardBg: string
  avatarBg: string
  avatarText: string
  nameText: string
  secondaryText: string
  linkBg: string
  linkText: string
  linkIconBg: string
  linkIconText: string
  footerText: string
}

export const BIO_THEMES: Record<BioThemeKey, BioThemeStyle> = {
  aurora: {
    key: 'aurora',
    label: 'Aurora boreale',
    scene: 'aurora',
    swatchClass: 'bg-gradient-to-br from-emerald-400 via-cyan-500 to-violet-600',
    pageBg: 'bg-gradient-to-b from-slate-950 via-sky-950 to-cyan-900',
    cardBg: 'bg-slate-950/35 backdrop-blur-md border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-cyan-700',
    nameText: 'text-white',
    secondaryText: 'text-white/80',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-emerald-400 to-violet-600',
    linkIconText: 'text-white',
    footerText: 'text-white/60',
  },
  notte: {
    key: 'notte',
    label: 'Luna sul lago',
    scene: 'notte',
    swatchClass: 'bg-gradient-to-br from-slate-950 via-slate-800 to-amber-500',
    pageBg: 'bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950',
    cardBg: 'bg-slate-950/55 backdrop-blur-md border border-amber-300/40',
    avatarBg: 'bg-gradient-to-br from-amber-300 to-amber-600',
    avatarText: 'text-slate-950',
    nameText: 'text-amber-200',
    secondaryText: 'text-slate-300',
    linkBg: 'bg-slate-800 hover:bg-slate-700 border border-amber-400/40',
    linkText: 'text-amber-100',
    linkIconBg: 'bg-gradient-to-br from-amber-300 to-amber-600',
    linkIconText: 'text-slate-950',
    footerText: 'text-slate-500',
  },
  tramonto: {
    key: 'tramonto',
    label: 'Savana al tramonto',
    scene: 'tramonto',
    swatchClass: 'bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-700',
    pageBg: 'bg-gradient-to-b from-violet-950 via-pink-700 to-orange-500',
    cardBg: 'bg-black/30 backdrop-blur-md border border-white/25',
    avatarBg: 'bg-white',
    avatarText: 'text-rose-600',
    nameText: 'text-white',
    secondaryText: 'text-white/80',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-amber-400 to-indigo-700',
    linkIconText: 'text-white',
    footerText: 'text-white/60',
  },
  nero: {
    key: 'nero',
    label: 'Nero',
    swatchClass: 'bg-black',
    pageBg: 'bg-gradient-to-br from-neutral-900 via-black to-neutral-800',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-black',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-neutral-700 to-black',
    linkIconText: 'text-white',
    footerText: 'text-white/50',
  },
  bianco: {
    key: 'bianco',
    label: 'Bianco',
    swatchClass: 'bg-white border border-gray-300',
    pageBg: 'bg-gradient-to-br from-gray-50 via-white to-gray-100',
    cardBg: 'bg-white border border-gray-200 shadow-xl',
    avatarBg: 'bg-gray-900',
    avatarText: 'text-white',
    nameText: 'text-gray-900',
    secondaryText: 'text-gray-600',
    linkBg: 'bg-gray-50 hover:bg-gray-100 border border-gray-200',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-gray-700 to-gray-900',
    linkIconText: 'text-white',
    footerText: 'text-gray-400',
  },
  oro: {
    key: 'oro',
    label: 'Oro',
    swatchClass: 'bg-gradient-to-br from-yellow-500 to-yellow-800',
    pageBg: 'bg-gradient-to-br from-neutral-900 via-neutral-800 to-yellow-700',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-yellow-400/30',
    avatarBg: 'bg-yellow-500',
    avatarText: 'text-black',
    nameText: 'text-white',
    secondaryText: 'text-yellow-100/80',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-yellow-500 to-yellow-800',
    linkIconText: 'text-white',
    footerText: 'text-yellow-100/50',
  },
  rosso: {
    key: 'rosso',
    label: 'Rosso',
    swatchClass: 'bg-red-600',
    pageBg: 'bg-gradient-to-br from-red-600 via-red-700 to-rose-900',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-red-600',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-red-500 to-rose-700',
    linkIconText: 'text-white',
    footerText: 'text-white/50',
  },
  rosa: {
    key: 'rosa',
    label: 'Rosa',
    swatchClass: 'bg-pink-500',
    pageBg: 'bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-pink-600',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-pink-500 to-orange-400',
    linkIconText: 'text-white',
    footerText: 'text-white/60',
  },
  arancione: {
    key: 'arancione',
    label: 'Arancione',
    swatchClass: 'bg-orange-500',
    pageBg: 'bg-gradient-to-br from-orange-500 via-amber-500 to-orange-700',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-orange-600',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-orange-500 to-amber-600',
    linkIconText: 'text-white',
    footerText: 'text-white/60',
  },
  giallo: {
    key: 'giallo',
    label: 'Giallo',
    swatchClass: 'bg-yellow-400',
    pageBg: 'bg-gradient-to-br from-yellow-200 via-yellow-300 to-amber-300',
    cardBg: 'bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl',
    avatarBg: 'bg-gray-900',
    avatarText: 'text-yellow-300',
    nameText: 'text-gray-900',
    secondaryText: 'text-gray-700',
    linkBg: 'bg-white/90 hover:bg-white border border-white/60',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-amber-400 to-yellow-500',
    linkIconText: 'text-white',
    footerText: 'text-gray-600',
  },
  verde: {
    key: 'verde',
    label: 'Verde',
    swatchClass: 'bg-green-600',
    pageBg: 'bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-green-600',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-green-500 to-emerald-700',
    linkIconText: 'text-white',
    footerText: 'text-white/60',
  },
  azzurro: {
    key: 'azzurro',
    label: 'Azzurro',
    swatchClass: 'bg-sky-500',
    pageBg: 'bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-500',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-sky-600',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-sky-500 to-blue-600',
    linkIconText: 'text-white',
    footerText: 'text-white/60',
  },
  blu: {
    key: 'blu',
    label: 'Blu',
    swatchClass: 'bg-blue-700',
    pageBg: 'bg-gradient-to-br from-blue-600 via-blue-800 to-indigo-900',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-blue-700',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-blue-600 to-indigo-800',
    linkIconText: 'text-white',
    footerText: 'text-white/50',
  },
  viola: {
    key: 'viola',
    label: 'Viola',
    swatchClass: 'bg-purple-600',
    pageBg: 'bg-gradient-to-br from-purple-600 via-violet-700 to-fuchsia-800',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-purple-600',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-purple-600 to-fuchsia-700',
    linkIconText: 'text-white',
    footerText: 'text-white/60',
  },
  grigio: {
    key: 'grigio',
    label: 'Grigio',
    swatchClass: 'bg-slate-500',
    pageBg: 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900',
    cardBg: 'bg-white/10 backdrop-blur-xl border border-white/20',
    avatarBg: 'bg-white',
    avatarText: 'text-slate-700',
    nameText: 'text-white',
    secondaryText: 'text-white/70',
    linkBg: 'bg-white/90 hover:bg-white border border-white/50',
    linkText: 'text-gray-900',
    linkIconBg: 'bg-gradient-to-br from-slate-600 to-slate-800',
    linkIconText: 'text-white',
    footerText: 'text-white/50',
  },
}

export const ALL_BIO_THEME_KEYS: BioThemeKey[] = [
  'nero', 'bianco', 'oro', 'rosso', 'rosa', 'arancione',
  'giallo', 'verde', 'azzurro', 'blu', 'viola', 'grigio',
  'aurora', 'notte', 'tramonto',
]

// Richiedono lo sblocco KU del singolo tema (o il vecchio pacchetto).
export const PREMIUM_BIO_THEME_KEYS: BioThemeKey[] = ['aurora', 'notte', 'tramonto']

// 'gradient-1' is the DB column's old, unused default from before this
// palette existed — never written by any real UI, so any row still on it
// (or any other unrecognized/legacy value) falls back to the original
// pink/rose/orange look this feature always had.
export const DEFAULT_BIO_THEME: BioThemeKey = 'rosa'

export function resolveBioTheme(key: string | null | undefined): BioThemeStyle {
  return BIO_THEMES[key as BioThemeKey] || BIO_THEMES[DEFAULT_BIO_THEME]
}
