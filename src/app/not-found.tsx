import Link from 'next/link'

// Indirizzo inesistente fuori dalle lingue (es. un file che non c'è): il
// layout di partenza è "passante", quindi qui servono <html> e <body>.
// Sotto le lingue vale la 404 tradotta di [locale]/not-found.tsx.
export default function RootNotFound() {
  return (
    <html lang="it">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#171717', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <p style={{ fontSize: 56, fontWeight: 700, color: '#e0b552', margin: 0 }}>404</p>
          <h1 style={{ fontSize: 22 }}>Pagina non trovata · Page not found</h1>
          <Link href="/" style={{ display: 'inline-block', marginTop: 24, padding: '12px 24px', borderRadius: 12, background: '#c79a3b', color: '#171717', fontWeight: 700, textDecoration: 'none' }}>
            KUMANI
          </Link>
        </div>
      </body>
    </html>
  )
}
