// Indirizzo pubblico del sito, usato per link condivisi, QR, email e Stripe.
// Accetta NEXT_PUBLIC_SITE_URL (preferita) o NEXT_PUBLIC_BASE_URL; su Vercel,
// se mancano entrambe, usa il dominio di produzione del progetto invece di
// finire su localhost.
// Online un indirizzo localhost (es. copiato per errore da .env.local nelle
// variabili di Vercel) viene ignorato: rimanderebbe gli utenti, anche dopo il
// pagamento Stripe, a una pagina che non esiste.
const onVercel = Boolean(process.env.VERCEL)
const isLocalhost = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)

export const SITE_URL = (
  [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
  ].find((url) => url && !(onVercel && isLocalhost(url))) || 'http://localhost:3000'
).replace(/\/+$/, '')
