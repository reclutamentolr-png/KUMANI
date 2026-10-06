import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  // Non dire a chi visita con quale tecnologia è fatto il sito
  poweredByHeader: false,
  allowedDevOrigins: ['192.168.1.133', 'localhost'],
  experimental: {
    // Foto del menu fino a 2MB: margine per l'overhead multipart
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  async headers() {
    return [
      {
        // Sicurezza su tutte le pagine: niente KUMANI dentro siti altrui
        // (clickjacking), solo HTTPS, nessun "indovina il tipo di file",
        // fotocamera solo per i nostri scanner QR
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(self)' },
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
