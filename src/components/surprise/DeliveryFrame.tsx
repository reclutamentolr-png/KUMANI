import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'

// Cornice delle pagine del buono (verifica dal QR e pagina di chi consegna)
export default function DeliveryFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1d1a14] to-[#0f0e0c] px-4 py-8 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-6 inline-flex items-center gap-2">
          <Logo size={36} className="h-9 w-9" />
          <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI</span>
        </Link>
        {children}
      </div>
    </div>
  )
}
