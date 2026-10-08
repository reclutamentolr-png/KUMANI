// Volantini dei servizi (Documenti → Doc KUMANI). I testi stanno nei file
// delle lingue (namespace "flyers", correggibili dall'Area Traduttori); qui
// c'è solo come appare ogni volantino: stile, icone e immagine.
//   photo = grande foto in alto (servizi Pro e alcuni servizi dove la foto racconta meglio)
//   phone = schermata vera del servizio dentro un telefono
//   light = chiaro e minimale, punti numerati

export type FlyerStyle = 'photo' | 'phone' | 'light'
export type FlyerCategory = 'marketing' | 'security' | 'personal' | 'wellness' | 'lavoro' | 'svago' | 'community' | 'pro'

export type FlyerConfig = {
  tool: string
  style: FlyerStyle
  category: FlyerCategory
  icon: string // nome dell'icona lucide (vedi FlyerCanvas)
  points: [string, string, string]
  photo?: string // percorso in /public
  shot?: string // schermata in /public/guides/<it|en>/<shot>.webp
}

export const FLYERS: FlyerConfig[] = [
  // Pro: foto
  { tool: 'landing-page', style: 'phone', category: 'pro', icon: 'Store', points: ['Sparkles', 'Palette', 'MessageCircle'], shot: 'landing-page-5' },
  { tool: 'menu', style: 'photo', category: 'pro', icon: 'Utensils', points: ['QrCode', 'Languages', 'Wheat'], photo: '/flyers/photos/menu.webp' },
  { tool: 'fidelity', style: 'photo', category: 'pro', icon: 'Stamp', points: ['Smartphone', 'Gift', 'Repeat'], photo: '/flyers/photos/fidelity.webp' },
  { tool: 'preventivi', style: 'photo', category: 'pro', icon: 'FileText', points: ['Smartphone', 'FileDown', 'Send'], photo: '/flyers/photos/preventivi.webp' },
  { tool: 'digital-receipt', style: 'photo', category: 'pro', icon: 'Receipt', points: ['Clock', 'BadgeCheck', 'FolderOpen'], photo: '/flyers/photos/digital-receipt.webp' },
  { tool: 'magazzino', style: 'photo', category: 'pro', icon: 'Package', points: ['ScanBarcode', 'BellRing', 'FileSpreadsheet'], photo: '/flyers/photos/magazzino.webp' },
  { tool: 'qr-code-pro', style: 'photo', category: 'pro', icon: 'QrCode', points: ['RefreshCw', 'ChartColumn', 'Store'], photo: '/flyers/photos/qr-code-pro.webp' },
  { tool: 'firma-email', style: 'photo', category: 'pro', icon: 'Mail', points: ['ClipboardPaste', 'Palette', 'IdCard'], photo: '/flyers/photos/firma-email.webp' },
  { tool: 'calcolatrici', style: 'photo', category: 'pro', icon: 'Calculator', points: ['Percent', 'Tag', 'Smartphone'], photo: '/flyers/photos/calcolatrici.webp' },

  // Telefono con la schermata del servizio
  { tool: 'svat', style: 'phone', category: 'security', icon: 'ShieldCheck', points: ['Gauge', 'Building2', 'ListChecks'], shot: 'svat-2' },
  { tool: 'verifoto', style: 'phone', category: 'security', icon: 'Image', points: ['Percent', 'Map', 'Search'], shot: 'verifoto-3' },
  { tool: 'checkmail', style: 'phone', category: 'security', icon: 'MailWarning', points: ['UserSearch', 'Paperclip', 'Lightbulb'], shot: 'checkmail-1' },
  { tool: 'documento-sicuro', style: 'phone', category: 'security', icon: 'IdCard', points: ['Stamp', 'EyeOff', 'Smartphone'], shot: 'documento-sicuro-2' },
  { tool: 'verifica-iban', style: 'phone', category: 'security', icon: 'Landmark', points: ['CircleCheck', 'Globe', 'TriangleAlert'], shot: 'verifica-iban-1' },
  { tool: 'qr-generator', style: 'phone', category: 'marketing', icon: 'QrCode', points: ['Zap', 'Palette', 'Store'], shot: 'qr-generator-3' },
  { tool: 'link-in-bio', style: 'phone', category: 'marketing', icon: 'Link', points: ['Clock', 'Palette', 'Share2'], shot: 'link-in-bio-4' },
  { tool: 'spendly', style: 'phone', category: 'personal', icon: 'PiggyBank', points: ['ChartLine', 'Wallet', 'CalendarDays'], shot: 'spendly-2' },
  { tool: 'fincheck', style: 'phone', category: 'personal', icon: 'Gauge', points: ['ClipboardList', 'ChartColumn', 'ListChecks'], shot: 'fincheck-3' },
  { tool: 'garage', style: 'phone', category: 'personal', icon: 'Car', points: ['Gauge', 'Bell', 'FolderOpen'], shot: 'garage-3' },
  { tool: 'casa', style: 'phone', category: 'personal', icon: 'House', points: ['CalendarClock', 'Zap', 'ShieldCheck'], shot: 'casa-4' },
  { tool: 'findo', style: 'phone', category: 'personal', icon: 'MapPin', points: ['Camera', 'Search', 'House'], shot: 'findo-1' },
  { tool: 'travel', style: 'photo', category: 'personal', icon: 'Plane', points: ['CalendarDays', 'ListChecks', 'Users'], photo: '/flyers/photos/group-travel.webp' },
  { tool: 'kumani-cv', style: 'phone', category: 'personal', icon: 'IdCard', points: ['FileText', 'RefreshCw', 'Globe'], shot: 'kumani-cv-1' },
  { tool: 'neurobalance', style: 'phone', category: 'wellness', icon: 'AudioWaveform', points: ['Moon', 'Music', 'TreePine'], shot: 'neurobalance-1' },
  { tool: 'focus', style: 'phone', category: 'wellness', icon: 'Timer', points: ['SlidersHorizontal', 'Bell', 'ChartColumn'], shot: 'focus-1' },
  { tool: 'mandala', style: 'phone', category: 'wellness', icon: 'Flower2', points: ['Pencil', 'Palette', 'Download'], shot: 'mandala-1' },
  { tool: 'affinity', style: 'phone', category: 'svago', icon: 'Sparkles', points: ['Compass', 'Swords', 'HeartHandshake'], shot: 'affinity-2' },
  { tool: 'mosaic', style: 'phone', category: 'svago', icon: 'Grid3x3', points: ['Users', 'CalendarDays', 'Award'], shot: 'mosaic-1' },
  { tool: 'fabula', style: 'phone', category: 'svago', icon: 'Dices', points: ['Dices', 'PenLine', 'BookOpen'], shot: 'fabula-1' },
  { tool: 'convivio', style: 'phone', category: 'community', icon: 'ShoppingBasket', points: ['BadgeCheck', 'Users', 'Handshake'], shot: 'convivio-1' },
  { tool: 'timebank', style: 'photo', category: 'community', icon: 'Clock', points: ['GraduationCap', 'HandHelping', 'ShieldCheck'], photo: '/flyers/photos/community-help.webp' },
  { tool: 'events', style: 'photo', category: 'community', icon: 'Ticket', points: ['QrCode', 'CalendarCheck', 'Megaphone'], photo: '/flyers/photos/friends-dinner.webp' },

  // Chiaro e minimale
  { tool: 'memolife', style: 'photo', category: 'personal', icon: 'CalendarDays', points: ['CalendarDays', 'Bell', 'NotebookPen'], photo: '/flyers/photos/planner-agenda.webp' },
  { tool: 'life-calendar', style: 'light', category: 'personal', icon: 'CalendarClock', points: ['RefreshCw', 'Bell', 'Car'] },
  { tool: 'aureya', style: 'light', category: 'wellness', icon: 'Ear', points: ['Ear', 'Eye', 'ChartLine'] },
  { tool: 'oxygen', style: 'light', category: 'wellness', icon: 'Wind', points: ['Timer', 'Circle', 'Moon'] },
  { tool: 'antitruffa', style: 'light', category: 'security', icon: 'BookOpen', points: ['MessageSquareWarning', 'Timer', 'Share2'] },
  { tool: 'whatsapp-messages', style: 'light', category: 'marketing', icon: 'MessageCircle', points: ['PenLine', 'Send', 'Lightbulb'] },
  { tool: 'listings', style: 'light', category: 'community', icon: 'ClipboardList', points: ['Camera', 'Search', 'MessageCircle'] },
  { tool: 'veritas', style: 'light', category: 'svago', icon: 'VenetianMask', points: ['Users', 'KeyRound', 'Laugh'] },
  { tool: 'spotlight', style: 'light', category: 'community', icon: 'Star', points: ['PenLine', 'House', 'Users'] },
  { tool: 'trova-lavoro', style: 'photo', category: 'lavoro', icon: 'BriefcaseBusiness', points: ['SlidersHorizontal', 'ShieldCheck', 'Bookmark'], photo: '/flyers/photos/job-search.webp' },
]

export const flyerKey = (tool: string) => tool.replace(/-/g, '_')
export const getFlyer = (tool: string) => FLYERS.find((f) => f.tool === tool) ?? null

// Dati che servono per disegnare un volantino (preparati dal server)
export type FlyerPlan = { plan: 'free' | 'base' | 'pro'; planPrice: number; passPrice: number | null }
