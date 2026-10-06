import { Geist, Geist_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { CLIENT_NAMESPACES } from '@/i18n/clientNamespaces.generated'
import { getEnabledLocales } from '@/lib/enabledLocales'
import { EnabledLocalesProvider } from '@/components/EnabledLocalesProvider'
import { NeurobalanceAudioProvider } from '@/components/NeurobalanceAudioProvider'
import FloatingAudioPlayer from '@/components/FloatingAudioPlayer'
import '@/app/globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// <html> e <body> di tutto il sito: usati dal layout della lingua
// (src/app/[locale]/layout.tsx) e dalla pagina /billing, che sta fuori dalle
// lingue. La lingua arriva dal chiamante, mai letta dalla richiesta: così le
// pagine pubbliche possono essere preparate in anticipo.
export default async function AppShell({ locale, children }: { locale: string; children: React.ReactNode }) {
  // Al browser vanno solo i testi usati dai componenti con useTranslations
  // (elenco generato da scripts/client-namespaces.mjs): gli altri servono
  // solo sul server
  const [allMessages, enabledLocales] = await Promise.all([getMessages({ locale }), getEnabledLocales()])
  const messages = Object.fromEntries(CLIENT_NAMESPACES.filter((key) => key in allMessages).map((key) => [key, allMessages[key]]))

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`min-h-full flex flex-col bg-gray-50 ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <EnabledLocalesProvider locales={enabledLocales}>
            <NeurobalanceAudioProvider>
              {children}
              <FloatingAudioPlayer />
            </NeurobalanceAudioProvider>
          </EnabledLocalesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
