import localFont from 'next/font/local'
import '../../globals.css'

// Manuale Antitruffa impaginato per il PDF (scripts/manual-pdf.mjs): fuori
// dalle lingue e dal proxy, senza menu, chat o banner. Solo in sviluppo: in
// produzione la pagina risponde 404 e il PDF pronto sta in private/manuale.
const sans = localFont({ src: '../../../fonts/Geist.woff2', variable: '--font-geist-sans', display: 'block' })

export const metadata = { robots: { index: false, follow: false } }

export default async function ManualPrintLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  return (
    <html lang={lang} className={sans.variable}>
      <body className="bg-white font-sans text-[var(--ink)] antialiased">{children}</body>
    </html>
  )
}
