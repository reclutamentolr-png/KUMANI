import 'server-only'
import { unstable_cache } from 'next/cache'
import { getMessages } from 'next-intl/server'
import { getCatalog } from '@/lib/catalog-server'
import { formatOpenDate, getPlansGate } from '@/lib/plansGate'
import { CONTACT_INFO } from '@/lib/contactInfo'

// Chiedi a KUMI: quello che KUMI sa, preso dai testi di KUMANI (catalogo dei
// servizi accesi con piani e prezzi, presentazione, «Chi siamo», FAQ della
// pagina Contatti) più le risposte insegnate dallo Staff. Per ogni domanda si
// scelgono solo i pezzi utili: all'IA arrivano pochi testi, quindi costa poco.

export type Chunk = { id: string; title: string; text: string; href?: string }
export type KumiLink = { href: string; label: string }

const flatten = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? v.map(flatten).join(' ') : v && typeof v === 'object' ? Object.values(v).map(flatten).join(' ') : ''
// Toglie i segnaposto dei testi ({count}, <b>…) che non servono a KUMI
const clean = (s: string) => s.replace(/\{[^}]*\}/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

const PLAN_LABEL: Record<string, Record<'free' | 'base' | 'pro', string>> = {
  it: { free: 'incluso nel piano Free (gratis)', base: 'nel piano Plus', pro: 'nel piano Pro' },
  en: { free: 'included in the Free plan', base: 'in the Plus plan', pro: 'in the Pro plan' },
  fr: { free: 'inclus dans le plan Free (gratuit)', base: 'dans le plan Plus', pro: 'dans le plan Pro' },
  es: { free: 'incluido en el plan Free (gratis)', base: 'en el plan Plus', pro: 'en el plan Pro' },
  pt: { free: 'incluído no plano Free (grátis)', base: 'no plano Plus', pro: 'no plano Pro' },
  de: { free: 'im Free-Plan enthalten (kostenlos)', base: 'im Plus-Plan', pro: 'im Pro-Plan' },
  ru: { free: 'входит в бесплатный план Free', base: 'в плане Plus', pro: 'в плане Pro' },
}

// Testi uguali per tutti, rifatti al massimo ogni ora
const baseChunks = unstable_cache(
  async (locale: string): Promise<{ chunks: Chunk[]; core: string }> => {
    const [messages, catalog, gate] = await Promise.all([getMessages({ locale }) as Promise<Record<string, unknown>>, getCatalog(locale), getPlansGate()])
    const chunks: Chunk[] = []
    const plan = PLAN_LABEL[locale] ?? PLAN_LABEL.en

    // Servizi accesi (come nel catalogo pubblico)
    for (const group of catalog.groups)
      for (const item of group.items) {
        const parts = [
          `${item.title} (${group.label}) — ${item.priceNote ?? plan[item.plan]}${item.passPrice ? `; Pass ${item.passPrice}` : ''}.`,
          item.purpose,
          ...item.points.map((p) => `${p.title}${p.text ? `: ${p.text}` : ''}`),
          ...item.steps.map((s) => `${s.title}: ${s.text}`),
        ]
        chunks.push({ id: `svc:${item.toolName}`, title: item.title, text: clean(parts.join(' ')), href: item.guideHref ?? '/catalogo' })
      }

    // Presentazione del progetto: una diapositiva per pezzo
    const deck = (messages.deckTexts ?? {}) as Record<string, unknown>
    for (const [key, value] of Object.entries(deck)) {
      if (['docTitle', 'sec', 'hook1', 'hook2', 'hook3'].includes(key)) continue
      const text = clean(flatten(value))
      if (text.length > 40) chunks.push({ id: `deck:${key}`, title: clean(flatten((value as Record<string, unknown>)?.title ?? key)), text })
    }

    // Chi siamo
    const about = clean(flatten(messages.aboutPage))
    if (about) chunks.push({ id: 'about', title: 'KUMANI', text: about, href: '/chi-siamo' })

    // Domande frequenti della pagina Contatti
    const contact = (messages.contactPage ?? {}) as Record<string, string>
    for (let i = 1; contact[`faq${i}Q`]; i++) chunks.push({ id: `faq:${i}`, title: contact[`faq${i}Q`], text: clean(`${contact[`faq${i}Q`]} ${contact[`faq${i}A`] ?? ''}`), href: '/contact' })

    // Fatti di base: sempre inviati a KUMI
    const date = gate.closed ? formatOpenDate(locale, gate.openDate) : null
    const { company } = CONTACT_INFO
    const core = [
      `KUMANI (kumani.io): ${catalog.total} services with ${catalog.tools} tools in one app, for private people, families and the self-employed, plus a community that helps each other. Available in 7 languages (Italian, English, French, Spanish, Portuguese, German, Russian). It works in the browser and can be installed as an app on the phone.`,
      `Plans: Free (free forever, the services marked Free), Plus ${catalog.basePrice} per year, Pro ${catalog.proPrice} per year for professionals. Some services can also be bought alone with a Pass.`,
      date
        ? `Paid plans are not open yet: they open on ${date} (${gate.openDate}). Until then everyone can sign up and use KUMANI for free (Free services, community, personal invite link); subscriptions, Passes and gifts can be bought from that day.`
        : 'Paid plans are open: Plus and Pro can be activated from the account.',
      'Signing up is free at kumani.io/register with email and password. Everyone signs up themselves.',
      company.name ? `KUMANI is run by ${company.name}${company.vatNumber ? ` (VAT ${company.vatNumber})` : ''}${company.email ? `, contact ${company.email}` : ''}. Support: ${CONTACT_INFO.supportEmail ?? 'support@kumani.io'} and the contact form at kumani.io/contact.` : '',
    ]
      .filter(Boolean)
      .join('\n')
    return { chunks, core }
  },
  ['kumi-chat-knowledge'],
  { revalidate: 3600 }
)

// ── Scelta dei pezzi utili ────────────────────────────────────────────────
const STOP = new Set(
  'come cosa cose sono puoi posso fare dove quando quanto quale quali della delle degli dello nella nelle con per una uno che non mi ti si il lo la le gli dei del kumani the and for you your can what how does with this that are from comment pour avec vous est que les des une como para con que los las una qué cómo para com que uma não para wie was der die das und mit ist ein eine für как что это для или'.split(' ')
)
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9Ѐ-ӿ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
// Parole utili della domanda, accorciate (prime 5 lettere: «truffe» e «truffa» coincidono)
const terms = (s: string) => [...new Set(normalize(s).split(' ').filter((w) => w.length >= 3 && !STOP.has(w)).map((w) => w.slice(0, 5)))]

function score(chunk: Chunk, words: string[]) {
  const text = ' ' + normalize(chunk.text) + ' '
  const title = ' ' + normalize(chunk.title) + ' '
  let s = 0
  for (const w of words) {
    if (title.includes(' ' + w)) s += 3
    if (text.includes(' ' + w)) s += 1
  }
  return s
}

export type Pick = { core: string; chunks: Chunk[] }

export async function pickKnowledge(locale: string, question: string, staff: Chunk[]): Promise<Pick> {
  const { chunks, core } = await baseChunks(locale)
  const words = terms(question)
  const ranked = [...staff.map((c) => ({ c, s: score(c, words) * 2 })), ...chunks.map((c) => ({ c, s: score(c, words) }))]
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
  // Al massimo ~9.000 caratteri di testi (circa 3.000 token)
  const picked: Chunk[] = []
  let size = 0
  for (const { c } of ranked) {
    if (picked.length >= 8) break
    const text = c.text.slice(0, 1800)
    if (size + text.length > 9000) continue
    picked.push({ ...c, text })
    size += text.length
  }
  // Nessun pezzo trovato: la presentazione generale aiuta a rispondere lo stesso
  if (!picked.length) for (const id of ['deck:s1', 'deck:s2', 'about']) {
    const c = chunks.find((x) => x.id === id)
    if (c) picked.push({ ...c, text: c.text.slice(0, 1800) })
  }
  return { core, chunks: picked }
}
