// Manuale "Come difendersi dalle truffe online" (KUMANI, Sicurezza e
// Verifica, gratis per tutti i Kumani). Stessa struttura in ogni lingua:
// i testi stanno in src/lib/antitruffa/content/<lingua>.ts.

// Vignette disegnate (src/components/antitruffa/Vignette.tsx)
export type VignetteId = 'sms' | 'email' | 'whatsapp' | 'call' | 'qr' | 'shop' | 'invest' | 'romance' | 'job' | 'blackmail' | 'identity' | 'invoice' | 'door'

// Tipo di messaggio d'esempio (cambia la grafica: fumetto SMS, email, chat...)
// door = conversazione alla porta; notice = avviso affisso (Comune, Carabinieri)
export type ExampleKind = 'sms' | 'email' | 'chat' | 'call' | 'ad' | 'popup' | 'door' | 'notice'

export type Scam = {
  id: string
  title: string
  // Come funziona: 2-3 frasi concrete
  how: string
  example?: { kind: ExampleKind; from: string; text: string }
  // Segnali d'allarme e cosa fare: frasi brevi
  flags: string[]
  todo: string[]
  // Facoltativo: come l'intelligenza artificiale rende la truffa più credibile
  ai?: string
  vignette?: VignetteId
}

export type Chapter = {
  id: string
  title: string
  intro: string
  // Facoltativo: lo schema che si ripete in tutte le truffe del capitolo
  pattern?: { title: string; text: string }
  scams: Scam[]
  // Facoltativo: scheda da stampare (es. da attaccare vicino alla porta)
  poster?: { title: string; lines: string[]; note: string }
}

export type Contact = { name: string; detail: string; url?: string; phone?: string }

export type GuideContent = {
  // Intestazione
  eyebrow: string
  title: string
  motto: string
  lead: string
  giftNote: string
  stats: { value: string; label: string }[]
  statsSource: string
  // Test da fare prima di cliccare
  tenSeconds: { title: string; intro: string; items: string[] }
  // Regole d'oro (difese di base)
  rules: { title: string; items: { title: string; text: string }[] }
  chapters: Chapter[]
  // Sei stato truffato?
  victim: { title: string; intro: string; steps: { title: string; text: string }[] }
  contacts: { title: string; intro: string; items: Contact[]; note?: string }
  whyReport: { title: string; items: string[] }
  // Testi dell'interfaccia
  ui: {
    toc: string
    print: string
    howItWorks: string
    example: string
    flags: string
    todo: string
    ai: string
    checkmailTitle: string
    checkmailText: string
    checkmailCta: string
    updated: string
    disclaimer: string
    copyright: string
  }
}
