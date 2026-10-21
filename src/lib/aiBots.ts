// Robot delle intelligenze artificiali e programmi che copiano i siti.
// Scelta «via di mezzo» (21/10/2026): fuori chi raccoglie i contenuti per
// addestrare le AI e chi scarica il sito intero; dentro i motori di ricerca
// e gli assistenti che citano e linkano KUMANI (Googlebot, Bing,
// ChatGPT Search / ChatGPT-User, PerplexityBot, Claude-SearchBot / Claude-User)
// e le anteprime dei link (WhatsApp, Facebook, Telegram…).

// robots.txt: nomi con cui i robot di addestramento leggono le regole.
// Google-Extended e Applebot-Extended sono solo «permessi» (non robot veri):
// Googlebot e Applebot continuano a indicizzare il sito per le ricerche.
export const AI_TRAINING_ROBOTS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
  'Amazonbot',
  'cohere-ai',
  'cohere-training-data-crawler',
  'Diffbot',
  'ImagesiftBot',
  'Omgilibot',
  'Timpibot',
  'PanguBot',
]

// Proxy: chi si presenta con uno di questi nomi riceve «accesso negato».
// Solo robot veri (non i «permessi» di robots.txt) e programmi che scaricano
// un sito intero. ClaudeBot sì, Claude-SearchBot e Claude-User no.
const BLOCKED_AGENT = /\b(GPTBot|ClaudeBot|anthropic-ai|CCBot|Bytespider|meta-externalagent|Amazonbot|cohere-ai|cohere-training-data-crawler|Diffbot|ImagesiftBot|Omgilibot|Timpibot|PanguBot|HTTrack|WebCopier|WebZIP|Teleport ?Pro|SiteSnagger|SiteSucker|Offline ?Explorer|Wget|Scrapy)\b/i

export function isBlockedAgent(userAgent: string | null | undefined): boolean {
  return !!userAgent && BLOCKED_AGENT.test(userAgent)
}
