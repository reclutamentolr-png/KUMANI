import { redirect } from 'next/navigation'

// Vecchio indirizzo delle sfide: ora sono pubbliche in /nexus/<codice>
export default async function OldNexusDuelPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params
  redirect(`${locale === 'it' ? '' : `/${locale}`}/nexus/${encodeURIComponent(code)}`)
}
