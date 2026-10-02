import { SITE_URL } from '@/lib/siteUrl'
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kumani - Mani che ti danno una mano",
    template: "%s | Kumani",
  },
  description:
    "Kumani è la community di strumenti professionali per chi lavora in proprio: QR code dinamici, link in bio, verifica anti-truffa e altro ancora, tutti collegati nell'Ecosistema KUMANI. Prezzo onesto, regole pubbliche, zero promesse vuote.",
  keywords: [
    "strumenti professionali",
    "ecosistema digitale",
    "QR code dinamico",
    "link in bio",
    "business digitale",
    "kumani",
  ],
  authors: [{ name: "Kumani Team" }],
  creator: "Kumani",
  publisher: "Kumani",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "it_IT",
    url: siteUrl,
    siteName: "Kumani",
    title: "Kumani - Mani che ti danno una mano",
    description:
      "Strumenti professionali, un prezzo onesto e una community che presta mani invece di vendere sogni.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Kumani",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kumani - Mani che ti danno una mano",
    description: "Strumenti professionali per chi lavora in proprio. Prezzo onesto, regole pubbliche.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-icon.png',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Kumani',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
  const messages = await getMessages();
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