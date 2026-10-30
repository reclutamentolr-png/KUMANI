// Volantini dei servizi (Documenti → Doc KUMANI). I testi stanno nei file
// delle lingue (namespace "flyers", correggibili dall'Area Traduttori); qui
// c'è solo come appare ogni volantino: stile, icone e immagine.
//   photo = grande foto in alto (servizi Pro e alcuni servizi dove la foto racconta meglio)
//   phone = schermata vera del servizio dentro un telefono
//   light = chiaro e minimale, punti numerati

export type FlyerStyle = 'photo' | 'phone' | 'light'
export type FlyerCategory = 'marketing' | 'security' | 'personal' | 'wellness' | 'lavoro' | 'svago' | 'audio' | 'community' | 'pro'

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
  { tool: 'offermaker', style: 'phone', category: 'pro', icon: 'Sparkles', points: ['Globe', 'QrCode', 'MessageCircle'], shot: 'offermaker-4' },
  { tool: 'menu', style: 'photo', category: 'pro', icon: 'Utensils', points: ['QrCode', 'Languages', 'Wheat'], photo: '/flyers/photos/menu.webp' },
  { tool: 'fidelity', style: 'photo', category: 'pro', icon: 'Stamp', points: ['Smartphone', 'Gift', 'Repeat'], photo: '/flyers/photos/fidelity.webp' },
  { tool: 'preventivi', style: 'photo', category: 'pro', icon: 'FileText', points: ['Smartphone', 'FileDown', 'Send'], photo: '/flyers/photos/preventivi.webp' },
  { tool: 'digital-receipt', style: 'photo', category: 'pro', icon: 'Receipt', points: ['Clock', 'BadgeCheck', 'FolderOpen'], photo: '/flyers/photos/digital-receipt.webp' },
  { tool: 'clienti', style: 'phone', category: 'pro', icon: 'BookUser', points: ['CalendarCheck', 'Timer', 'Wallet'], shot: 'clienti-1' },
  { tool: 'firma-pdf', style: 'phone', category: 'lavoro', icon: 'PenLine', points: ['PenLine', 'CalendarDays', 'ShieldCheck'], shot: 'firma-pdf-3' },
  { tool: 'hopla', style: 'phone', category: 'personal', icon: 'Smartphone', points: ['Smartphone', 'ShieldCheck', 'FolderOpen'], shot: 'hopla-3' },
  { tool: 'magazzino', style: 'photo', category: 'pro', icon: 'Package', points: ['ScanBarcode', 'BellRing', 'FileSpreadsheet'], photo: '/flyers/photos/magazzino.webp' },
  { tool: 'qr-code-pro', style: 'photo', category: 'pro', icon: 'QrCode', points: ['RefreshCw', 'ChartColumn', 'Store'], photo: '/flyers/photos/qr-code-pro.webp' },
  { tool: 'firma-email', style: 'photo', category: 'pro', icon: 'Mail', points: ['ClipboardPaste', 'Palette', 'IdCard'], photo: '/flyers/photos/firma-email.webp' },
  { tool: 'imago', style: 'photo', category: 'pro', icon: 'Palette', points: ['Grid3x3', 'Palette', 'Smartphone'], photo: '/flyers/photos/imago.webp' },
  { tool: 'forma', style: 'photo', category: 'pro', icon: 'Camera', points: ['Timer', 'SlidersHorizontal', 'ShieldCheck'], photo: '/flyers/photos/forma.webp' },
  { tool: 'tutela', style: 'photo', category: 'security', icon: 'ShieldCheck', points: ['KeyRound', 'TriangleAlert', 'HandHelping'], photo: '/flyers/photos/tutela.webp' },
  { tool: 'diarium', style: 'photo', category: 'pro', icon: 'CalendarDays', points: ['CalendarCheck', 'Lightbulb', 'BellRing'], photo: '/flyers/photos/diarium.webp' },
  { tool: 'captio', style: 'photo', category: 'pro', icon: 'Sparkles', points: ['ListChecks', 'Search', 'Smartphone'], photo: '/flyers/photos/captio.webp' },
  { tool: 'vox', style: 'photo', category: 'pro', icon: 'MessageCircle', points: ['Sparkles', 'Palette', 'ShieldCheck'], photo: '/flyers/photos/vox.webp' },
  { tool: 'lumen', style: 'photo', category: 'pro', icon: 'Camera', points: ['SlidersHorizontal', 'Smartphone', 'ShieldCheck'], photo: '/flyers/photos/lumen.webp' },
  { tool: 'calcolatrici', style: 'photo', category: 'pro', icon: 'Calculator', points: ['Percent', 'Tag', 'Smartphone'], photo: '/flyers/photos/calcolatrici.webp' },

  // Telefono con la schermata del servizio
  { tool: 'svat', style: 'phone', category: 'security', icon: 'ShieldCheck', points: ['Gauge', 'Building2', 'ListChecks'], shot: 'svat-2' },
  { tool: 'verifoto', style: 'phone', category: 'security', icon: 'Image', points: ['Percent', 'Map', 'Search'], shot: 'verifoto-3' },
  { tool: 'checkmail', style: 'phone', category: 'security', icon: 'MailWarning', points: ['UserSearch', 'Paperclip', 'Lightbulb'], shot: 'checkmail-1' },
  { tool: 'documento-sicuro', style: 'phone', category: 'security', icon: 'IdCard', points: ['Stamp', 'EyeOff', 'Smartphone'], shot: 'documento-sicuro-2' },
  { tool: 'verifica-iban', style: 'phone', category: 'security', icon: 'Landmark', points: ['CircleCheck', 'Globe', 'TriangleAlert'], shot: 'verifica-iban-1' },
  { tool: 'rete-antitruffa', style: 'phone', category: 'security', icon: 'Users', points: ['MessageSquareWarning', 'TriangleAlert', 'Search'], shot: 'rete-antitruffa-3' },
  { tool: 'scudo-dati', style: 'phone', category: 'security', icon: 'ShieldCheck', points: ['Mail', 'KeyRound', 'EyeOff'], shot: 'scudo-dati-2' },
  { tool: 'qr-generator', style: 'phone', category: 'marketing', icon: 'QrCode', points: ['Zap', 'Palette', 'Store'], shot: 'qr-generator-3' },
  { tool: 'link-in-bio', style: 'phone', category: 'marketing', icon: 'Link', points: ['Clock', 'Palette', 'Share2'], shot: 'link-in-bio-4' },
  { tool: 'spendly', style: 'phone', category: 'personal', icon: 'PiggyBank', points: ['ChartLine', 'Wallet', 'CalendarDays'], shot: 'spendly-2' },
  { tool: 'fincheck', style: 'phone', category: 'personal', icon: 'Gauge', points: ['ClipboardList', 'ChartColumn', 'ListChecks'], shot: 'fincheck-3' },
  { tool: 'garage', style: 'phone', category: 'personal', icon: 'Car', points: ['Gauge', 'Bell', 'FolderOpen'], shot: 'garage-3' },
  { tool: 'casa', style: 'phone', category: 'personal', icon: 'House', points: ['CalendarClock', 'Zap', 'ShieldCheck'], shot: 'casa-4' },
  { tool: 'sorprese', style: 'phone', category: 'svago', icon: 'Gift', points: ['PartyPopper', 'Route', 'Coins'], shot: 'sorprese-dono' },
  { tool: 'findo', style: 'phone', category: 'personal', icon: 'MapPin', points: ['Camera', 'Search', 'House'], shot: 'findo-1' },
  { tool: 'travel', style: 'photo', category: 'personal', icon: 'Plane', points: ['CalendarDays', 'ListChecks', 'Users'], photo: '/flyers/photos/group-travel.webp' },
  { tool: 'kumani-cv', style: 'phone', category: 'personal', icon: 'IdCard', points: ['FileText', 'RefreshCw', 'Globe'], shot: 'kumani-cv-1' },
  { tool: 'neurobalance', style: 'phone', category: 'wellness', icon: 'AudioWaveform', points: ['Moon', 'Music', 'TreePine'], shot: 'neurobalance-1' },
  { tool: 'focus', style: 'phone', category: 'wellness', icon: 'Timer', points: ['SlidersHorizontal', 'Bell', 'ChartColumn'], shot: 'focus-1' },
  { tool: 'mandala', style: 'phone', category: 'wellness', icon: 'Flower2', points: ['Pencil', 'Palette', 'Download'], shot: 'mandala-1' },
  { tool: 'affinity', style: 'phone', category: 'svago', icon: 'Sparkles', points: ['Compass', 'Swords', 'HeartHandshake'], shot: 'affinity-2' },
  { tool: 'convivium', style: 'phone', category: 'svago', icon: 'PartyPopper', points: ['Send', 'Users', 'Wallet'], shot: 'convivium-invite' },
  { tool: 'mosaic', style: 'phone', category: 'svago', icon: 'Grid3x3', points: ['Users', 'CalendarDays', 'Award'], shot: 'mosaic-1' },
  { tool: 'fabula', style: 'phone', category: 'svago', icon: 'Dices', points: ['Dices', 'PenLine', 'BookOpen'], shot: 'fabula-1' },
  { tool: 'nexus', style: 'phone', category: 'svago', icon: 'Puzzle', points: ['CalendarDays', 'Swords', 'Users'], shot: 'nexus-2' },
  { tool: 'convivio', style: 'phone', category: 'community', icon: 'ShoppingBasket', points: ['BadgeCheck', 'Users', 'Handshake'], shot: 'convivio-1' },
  { tool: 'timebank', style: 'photo', category: 'community', icon: 'Clock', points: ['GraduationCap', 'HandHelping', 'ShieldCheck'], photo: '/flyers/photos/community-help.webp' },
  { tool: 'events', style: 'photo', category: 'community', icon: 'Ticket', points: ['QrCode', 'CalendarCheck', 'Megaphone'], photo: '/flyers/photos/friends-dinner.webp' },

  // Chiaro e minimale
  { tool: 'memolife', style: 'photo', category: 'personal', icon: 'CalendarDays', points: ['CalendarDays', 'Bell', 'NotebookPen'], photo: '/flyers/photos/planner-agenda.webp' },
  { tool: 'life-calendar', style: 'light', category: 'personal', icon: 'CalendarClock', points: ['RefreshCw', 'Bell', 'Car'] },
  { tool: 'aureya', style: 'light', category: 'wellness', icon: 'Ear', points: ['Ear', 'Eye', 'ChartLine'] },
  { tool: 'cronobioma', style: 'phone', category: 'wellness', icon: 'SunMoon', points: ['Clock', 'BookOpen', 'Plane'], shot: 'cronobioma-3' },
  { tool: 'oxygen', style: 'light', category: 'wellness', icon: 'Wind', points: ['Timer', 'Circle', 'Moon'] },
  { tool: 'antitruffa', style: 'light', category: 'security', icon: 'BookOpen', points: ['MessageSquareWarning', 'Timer', 'Share2'] },
  { tool: 'whatsapp-messages', style: 'light', category: 'marketing', icon: 'MessageCircle', points: ['PenLine', 'Send', 'Lightbulb'] },
  { tool: 'listings', style: 'light', category: 'community', icon: 'ClipboardList', points: ['Camera', 'Search', 'MessageCircle'] },
  { tool: 'veritas', style: 'light', category: 'svago', icon: 'VenetianMask', points: ['Users', 'KeyRound', 'Laugh'] },
  { tool: 'spotlight', style: 'light', category: 'community', icon: 'Star', points: ['PenLine', 'House', 'Users'] },
  // Servizi nuovi (ottobre 2026): la schermata della guida «Come si usa»
  { tool: 'vocale-sospetto', style: 'phone', category: 'security', icon: 'Mic', points: ['Mic', 'ShieldAlert', 'Users'], shot: 'vocale-sospetto-3' },
  { tool: 'testo-protetto', style: 'phone', category: 'security', icon: 'ScanText', points: ['Search', 'EyeOff', 'RefreshCw'], shot: 'testo-protetto-2' },
  { tool: 'carte-antitruffa', style: 'phone', category: 'security', icon: 'Album', points: ['BookOpen', 'ListChecks', 'Share2'], shot: 'carte-antitruffa-2' },
  { tool: 'scanner', style: 'phone', category: 'lavoro', icon: 'ScanLine', points: ['Camera', 'Crop', 'Files'], shot: 'scanner-2' },
  { tool: 'fototessera', style: 'phone', category: 'personal', icon: 'ScanFace', points: ['ScanFace', 'Image', 'Printer'], shot: 'fototessera-3' },
  { tool: 'fonometro', style: 'phone', category: 'audio', icon: 'AudioWaveform', points: ['Gauge', 'Clock', 'FileDown'], shot: 'fonometro-2' },
  { tool: 'metronomo', style: 'phone', category: 'audio', icon: 'Drum', points: ['Timer', 'Ear', 'ChartLine'], shot: 'metronomo-1' },
  { tool: 'accordatore', style: 'phone', category: 'audio', icon: 'Guitar', points: ['Gauge', 'Guitar', 'ListChecks'], shot: 'accordatore-4' },
  { tool: 'trova-lavoro', style: 'photo', category: 'lavoro', icon: 'BriefcaseBusiness', points: ['SlidersHorizontal', 'ShieldCheck', 'Bookmark'], photo: '/flyers/photos/job-search.webp' },
  // KUMANI Lavoro e Documento componibile (ottobre 2026): la schermata della guida «Come si usa»
  { tool: 'lettera-presentazione', style: 'phone', category: 'lavoro', icon: 'Mail', points: ['PenLine', 'IdCard', 'FileDown'], shot: 'lettera-presentazione-4' },
  { tool: 'candidature', style: 'phone', category: 'lavoro', icon: 'Send', points: ['BellRing', 'ListChecks', 'CalendarCheck'], shot: 'candidature-2' },
  { tool: 'registro-ore', style: 'phone', category: 'lavoro', icon: 'Clock', points: ['Timer', 'CalendarDays', 'FileDown'], shot: 'registro-ore-4' },
  { tool: 'ricevuta-occasionale', style: 'phone', category: 'lavoro', icon: 'Receipt', points: ['Percent', 'FileDown', 'ChartColumn'], shot: 'ricevuta-occasionale-3' },
  { tool: 'note-spese', style: 'phone', category: 'lavoro', icon: 'Wallet', points: ['Camera', 'Car', 'FileDown'], shot: 'note-spese-2' },
  { tool: 'documento-componibile', style: 'phone', category: 'lavoro', icon: 'FileText', points: ['Puzzle', 'ClipboardList', 'FileDown'], shot: 'documento-componibile-4' },
]

export const flyerKey = (tool: string) => tool.replace(/-/g, '_')
export const getFlyer = (tool: string) => FLYERS.find((f) => f.tool === tool) ?? null

// Dati che servono per disegnare un volantino (preparati dal server)
// 'surprise' = KUMANI Sorpresa: per tutti, si paga ogni sorpresa (planPrice = prezzo più basso)
export type FlyerPlan = { plan: 'free' | 'base' | 'pro' | 'surprise'; planPrice: number; passPrice: number | null }
