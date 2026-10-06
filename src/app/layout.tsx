import { SITE_URL } from '@/lib/siteUrl'
import { CLIENT_NAMESPACES } from '@/i18n/clientNamespaces.generated';
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { isIndexableHost } from '@/lib/seo';
import { getEnabledLocales } from '@/lib/enabledLocales';
import { EnabledLocalesProvider } from '@/components/EnabledLocalesProvider';
import { NeurobalanceAudioProvider } from '@/components/NeurobalanceAudioProvider';
import FloatingAudioPlayer from '@/components/FloatingAudioPlayer';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const siteUrl = SITE_URL;

// Titolo, descrizione e anteprima social nella lingua della pagina; Google
// indicizza solo il dominio definitivo (vedi src/lib/seo.ts)
export async function generateMetadata(): Promise<Metadata> {
  const [locale, t, indexable] = await Promise.all([getLocale(), getTranslations('seo'), isIndexableHost()])
  const title = t('siteTitle')
  const description = t('siteDescription')
  return {
    metadataBase: new URL(siteUrl),
    title: { default: title, template: "%s | KUMANI" },
    description,
    authors: [{ name: "KUMANI" }],
    creator: "KUMANI",
    publisher: "KUMANI",
    formatDetection: { email: false, address: false, telephone: false },
    openGraph: {
      type: "website",
      locale: OG_LOCALES[locale] ?? "it_IT",
      url: siteUrl,
      siteName: "KUMANI",
      title,
      description,
      images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "KUMANI" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-image.jpg"] },
    robots: indexable
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } }
      : { index: false, follow: false },
    icons: {
      icon: [
        { url: '/icon.png', type: 'image/png' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: '/apple-icon.png',
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'KUMANI' },
    other: { 'mobile-web-app-capable': 'yes' },
  };
}

const OG_LOCALES: Record<string, string> = { it: "it_IT", en: "en_GB", fr: "fr_FR", es: "es_ES", pt: "pt_PT", de: "de_DE", ru: "ru_RU" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // iPhone: la pagina usa tutto lo schermo e i margini sicuri (env(safe-area-*))
  // tengono il menu in basso sopra la barretta di sistema
  viewportFit: "cover",
  // Zoom libero: chi vede poco può ingrandire (accessibilità)
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#171717" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  const locale = await getLocale();
  // Al browser vanno solo i testi usati dai componenti con useTranslations
  // (elenco generato da scripts/client-namespaces.mjs): gli altri servono
  // solo sul server
  const allMessages = await getMessages();
  const messages = Object.fromEntries(CLIENT_NAMESPACES.filter((key) => key in allMessages).map((key) => [key, allMessages[key]]));
  const enabledLocales = await getEnabledLocales();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`min-h-full flex flex-col bg-gray-50 ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <EnabledLocalesProvider locales={enabledLocales}>
            <NeurobalanceAudioProvider>
              {children}
              <FloatingAudioPlayer />
            </NeurobalanceAudioProvider>
          </EnabledLocalesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}