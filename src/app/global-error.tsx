'use client'

// Errore nel layout principale: sostituisce tutta la pagina, quindi niente
// traduzioni né stili globali. Testo breve in italiano e inglese.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#171717', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 16 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24 }}>Qualcosa è andato storto</h1>
          <p style={{ opacity: 0.7 }}>Something went wrong. Riprova tra qualche istante.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 24, padding: '12px 24px', borderRadius: 12, border: 0, background: '#c79a3b', color: '#171717', fontWeight: 700, cursor: 'pointer' }}
          >
            Riprova / Try again
          </button>
          {error.digest && <p style={{ marginTop: 24, fontSize: 12, opacity: 0.3 }}>{error.digest}</p>}
        </div>
      </body>
    </html>
  )
}
