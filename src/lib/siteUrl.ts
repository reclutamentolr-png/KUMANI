// Indirizzo pubblico del sito, usato per link condivisi, QR, email e Stripe.
// Accetta NEXT_PUBLIC_SITE_URL (preferita) o NEXT_PUBLIC_BASE_URL; su Vercel,
// se mancano entrambe, usa il dominio di produzione del progetto invece di
// finire su localhost.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:3000'
).replace(/\/+$/, '')
