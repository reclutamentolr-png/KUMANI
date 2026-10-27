import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

// Percorsi delle pagine pubbliche con dati personali (vedi headers sotto)
const PRIVATE_PAGES = [
  '/biglietto/:path*',
  '/cv/:path*',
  '/ref/:path*',
  '/c/:path*',
  '/ricevute/:path*',
  '/preventivo/:path*',
  '/hopla/:path*',
  '/webinar/:path*',
  '/f/:path*',
  '/sorpresa/:path*',
  '/regalo/:path*',
  '/prova/:path*',
  '/viaggi/invito/:path*',
  '/convivio/:path+',
  '/convivium/:path*',
  '/affinity/duo/:path*',
  '/veritas/:path+',
  '/nexus/:path+',
  '/offerte/:path*',
  '/m/:path*',
  '/shop/:slug/ordine/:path*',
  '/events/pass/:path*',
  '/spotlight',
]

const nextConfig: NextConfig = {
  // Non dire a chi visita con quale tecnologia è fatto il sito
  poweredByHeader: false,
  // pdfjs legge i PDF anche sul server (cron scam-feeds): non va impacchettato
  serverExternalPackages: ['pdfjs-dist'],
  allowedDevOrigins: ['192.168.1.133', 'localhost'],
  // PDF del Manuale Antitruffa (scripts/manual-pdf.mjs): fuori da public, li
  // consegna /api/antitruffa/manuale contando i download
  outputFileTracingIncludes: {
    '/api/antitruffa/manuale': ['./private/manuale/**'],
  },
  experimental: {
    // Foto del menu fino a 2MB: margine per l'overhead multipart
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  // Sicurezza: file che cercano solo gli hacker (.php, .env, .git…) non
  // esistono su KUMANI. Il proxy non vede i percorsi con il punto, quindi
  // passano da qui: si registra il tentativo (Admin → Sicurezza) e si
  // risponde «non trovato».
  // I servizi stavano sotto /marketplace, ora sotto /app: i vecchi link (QR,
  // messaggi, notifiche, Google) portano per sempre al nuovo indirizzo.
  // Vale prima del proxy; la parte ?… dell'indirizzo resta.
  async redirects() {
    const locale = ':locale(it|fr|en|es|pt|de|ru)';
    return [
      { source: '/marketplace', destination: '/app', permanent: true },
      { source: '/marketplace/:path*', destination: '/app/:path*', permanent: true },
      { source: `/${locale}/marketplace`, destination: '/:locale/app', permanent: true },
      { source: `/${locale}/marketplace/:path*`, destination: '/:locale/app/:path*', permanent: true },
      // Landing Page: da kumani.io/p/<nome> a kumani.io/page/<nome> (i link
      // già condivisi continuano a funzionare)
      { source: '/p/:path*', destination: '/page/:path*', permanent: true },
      { source: `/${locale}/p/:path*`, destination: '/:locale/page/:path*', permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/:probe(.*\\.(?:php\\d?|phtml|asp|aspx|jsp|cgi|sql|bak|old|swp|ini|cfg|log|sh|env)(?:/.*)?)', destination: '/api/security/probe?p=:probe' },
        { source: '/:probe((?:.*/)?\\.(?:env|git|svn|hg|aws|ssh|docker|vscode|idea|htaccess|htpasswd|DS_Store)(?:[./].*)?)', destination: '/api/security/probe?p=:probe' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        // Sicurezza su tutte le pagine: niente KUMANI dentro siti altrui
        // (clickjacking), solo HTTPS, nessun "indovina il tipo di file",
        // fotocamera solo per i nostri scanner QR, microfono solo per i vocali
        // registrati nelle sorprese (sempre dal nostro sito)
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // niente plugin (object) e niente <base> verso altri siti
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'" },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(self)' },
        ],
      },
      {
        // Fuori dal dominio definitivo (anteprime e indirizzo *.vercel.app,
        // localhost) niente Google. Vale per ogni richiesta, anche per le
        // pagine pubbliche preparate in anticipo, che non leggono l'indirizzo.
        source: '/:path*',
        missing: [{ type: 'host', value: '(?:www\\.)?kumani\\.io' }],
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      // Admin, accesso e API: mai nei motori di ricerca. Non sono elencate in
      // robots.txt (lì sarebbero una mappa per chi cerca dove attaccare)
      {
        source: '/:locale(it|en|fr|es|pt|de|ru)?/:area(admin|auth|api)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
      // Pagine con dati personali (CV, link di invito e Link in Bio, ricevute,
      // preventivi, tessere fedeltà, sorprese, regali, inviti a viaggi e gruppi,
      // giochi con i nomi dei partecipanti, Kumano del giorno…): visibili solo a
      // chi ha il link, mai nei motori di ricerca, nelle loro copie o tra le immagini
      ...PRIVATE_PAGES.map((path) => ({
        source: `/:locale(it|en|fr|es|pt|de|ru)?${path}`,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet, noimageindex' }],
      })),
      {
        // Service worker delle notifiche push: sempre la versione più recente
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
