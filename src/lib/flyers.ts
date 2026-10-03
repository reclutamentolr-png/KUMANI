// Volantini dei servizi (Documenti → Doc KUMANI). I testi stanno nei file
// delle lingue (namespace "flyers", correggibili dall'Area Traduttori); qui
// c'è solo come appare ogni volantino: stile, icone e immagine.
//   photo = grande foto in alto (servizi Pro)
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
  { tool: 'menu', style: 'photo', category: 'pro', icon: 'Utensils', points: ['QrCode', 'Languages', 'Wheat'], photo: '/home/cafe.webp' },
  { tool: 'fidelity', style: 'photo', category: 'pro', icon: 'Stamp', points: ['Smartphone', 'Gift', 'Repeat'], photo: '/home/cafe.webp' },
  { tool: 'preventivi', style: 'photo', category: 'pro', icon: 'FileText', points: ['Smartphone', 'FileDown', 'Send'], photo: '/home/artisan.webp' },
  { tool: 'digital-receipt', style: 'photo', category: 'pro', icon: 'Receipt', points: ['Clock', 'BadgeCheck', 'FolderOpen'], photo: '/home/phone.webp' },
  { tool: 'magazzino', style: 'photo', category: 'pro', icon: 'Package', points: ['ScanBarcode', 'BellRing', 'FileSpreadsheet'], photo: '/home/artisan.webp' },
  { tool: 'qr-code-pro', style: 'photo', category: 'pro', icon: 'QrCode', points: ['RefreshCw', 'ChartColumn', 'Store'], photo: '/home/cafe.webp' },
  { tool: 'firma-email', style: 'photo', category: 'pro', icon: 'Mail', points: ['ClipboardPaste', 'Palette', 'IdCard'], photo: '/people.jpg' },
  { tool: 'calcolatrici', style: 'photo', category: 'pro', icon: 'Calculator', points: ['Percent', 'Tag', 'Smartphone'], photo: '/home/phone.webp' },

  // Telefono con la schermata del servizio
  { tool: 'svat', style: 'phone', category: 'security', icon: 'ShieldCheck', points: ['Gauge', 'Building2', 'ListChecks'], shot: 'svat-2' },
  { tool: 'verifoto', style: 'phone', category: 'security', icon: 'Image', points: ['Percent', 'Map', 'Search'], shot: 'verifoto-3' },
  { tool: 'checkmail', style: 'phone', category: 'security', icon: 'MailWarning', points: ['UserSearch', 'Paperclip', 'Lightbulb'], shot: 'checkmail-1' },
  { tool: 'documento-sicuro', style: 'phone', category: 'security', icon: 'IdCard', points: ['Stamp', 'EyeOff', 'Smartphone'], shot: 'documento-sicuro-2' },
  { tool: 'verifica-iban', style: 'phone', category: 'security', icon: 'Landmark', points: ['CircleCheck', 'Globe', 'TriangleAlert'], shot: 'verifica-iban-1' },
  { tool: 'qr-generator', style: 'phone', category: 'marketing', icon: 'QrCode', points: ['Zap', 'Palette', 'Store'], shot: 'qr-generator-3' },
  { tool: 'link-in-bio', style: 'phone', category: 'marketing', icon: 'Link', points: ['Clock', 'Palette', 'Share2'], shot: 'link-in-bio-4' },
  { tool: 'spendly', style: 'phone', category: 'personal', icon: 'PiggyBank', points: ['ChartLine', 'Wallet', 'CalendarDays'], shot: 'spendly-2' },
  { tool: 'findo', style: 'phone', category: 'personal', icon: 'MapPin', points: ['Camera', 'Search', 'House'], shot: 'findo-1' },
  { tool: 'travel', style: 'phone', category: 'personal', icon: 'Plane', points: ['CalendarDays', 'ListChecks', 'Users'], shot: 'travel-1' },
  { tool: 'kumani-cv', style: 'phone', category: 'personal', icon: 'IdCard', points: ['FileText', 'RefreshCw', 'Globe'], shot: 'kumani-cv-1' },
  { tool: 'neurobalance', style: 'phone', category: 'wellness', icon: 'AudioWaveform', points: ['Moon', 'Music', 'TreePine'], shot: 'neurobalance-1' },
  { tool: 'focus', style: 'phone', category: 'wellness', icon: 'Timer', points: ['SlidersHorizontal', 'Bell', 'ChartColumn'], shot: 'focus-1' },
  { tool: 'mandala', style: 'phone', category: 'wellness', icon: 'Flower2', points: ['Pencil', 'Palette', 'Download'], shot: 'mandala-1' },
  { tool: 'affinity', style: 'phone', category: 'svago', icon: 'Sparkles', points: ['Compass', 'Swords', 'HeartHandshake'], shot: 'affinity-2' },
  { tool: 'mosaic', style: 'phone', category: 'svago', icon: 'Grid3x3', points: ['Users', 'CalendarDays', 'Award'], shot: 'mosaic-1' },
  { tool: 'fabula', style: 'phone', category: 'svago', icon: 'Dices', points: ['Dices', 'PenLine', 'BookOpen'], shot: 'fabula-1' },
  { tool: 'convivio', style: 'phone', category: 'community', icon: 'ShoppingBasket', points: ['BadgeCheck', 'Users', 'Handshake'], shot: 'convivio-1' },
  { tool: 'timebank', style: 'phone', category: 'community', icon: 'Clock', points: ['GraduationCap', 'HandHelping', 'ShieldCheck'], shot: 'timebank-1' },
  { tool: 'events', style: 'phone', category: 'community', icon: 'Ticket', points: ['QrCode', 'CalendarCheck', 'Megaphone'], shot: 'events-2' },

  // Chiaro e minimale
  { tool: 'memolife', style: 'light', category: 'personal', icon: 'CalendarDays', points: ['CalendarDays', 'Bell', 'NotebookPen'] },
  { tool: 'life-calendar', style: 'light', category: 'personal', icon: 'CalendarClock', points: ['RefreshCw', 'Bell', 'Car'] },
  { tool: 'aureya', style: 'light', category: 'wellness', icon: 'Ear', points: ['Ear', 'Eye', 'ChartLine'] },
  { tool: 'oxygen', style: 'light', category: 'wellness', icon: 'Wind', points: ['Timer', 'Circle', 'Moon'] },
  { tool: 'antitruffa', style: 'light', category: 'security', icon: 'BookOpen', points: ['MessageSquareWarning', 'Timer', 'Share2'] },
  { tool: 'whatsapp-messages', style: 'light', category: 'marketing', icon: 'MessageCircle', points: ['PenLine', 'Send', 'Lightbulb'] },
  { tool: 'listings', style: 'light', category: 'community', icon: 'ClipboardList', points: ['Camera', 'Search', 'MessageCircle'] },
  { tool: 'veritas', style: 'light', category: 'svago', icon: 'VenetianMask', points: ['Users', 'KeyRound', 'Laugh'] },
  { tool: 'spotlight', style: 'light', category: 'community', icon: 'Star', points: ['PenLine', 'House', 'Users'] },
  { tool: 'trova-lavoro', style: 'light', category: 'lavoro', icon: 'BriefcaseBusiness', points: ['SlidersHorizontal', 'ShieldCheck', 'Bookmark'] },
]

export const flyerKey = (tool: string) => tool.replace(/-/g, '_')
export const getFlyer = (tool: string) => FLYERS.find((f) => f.tool === tool) ?? null

// Dati che servono per disegnare un volantino (preparati dal server)
export type FlyerPlan = { plan: 'free' | 'base' | 'pro'; planPrice: number; passPrice: number | null }
