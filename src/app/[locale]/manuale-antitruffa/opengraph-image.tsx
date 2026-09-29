import { ImageResponse } from 'next/og'
import { getGuideContent } from '@/lib/antitruffa/content'

// Anteprima del link sui social (WhatsApp, Facebook, Telegram...): nero e
// oro, con titolo e motto nella lingua della pagina.
export const alt = 'KUMANI'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const g = await getGuideContent(locale)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#171717',
          color: '#ffffff',
          padding: '64px 72px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -120,
            top: -120,
            width: 420,
            height: 420,
            borderRadius: 9999,
            background: 'rgba(199,154,59,0.12)',
            border: '2px solid rgba(199,154,59,0.35)',
          }}
        />
        {/* Amo d'oro, il simbolo del manuale */}
        <svg width="120" height="220" viewBox="0 0 60 110" style={{ position: 'absolute', right: 110, top: 0 }}>
          <path d="M40 0 V78 A18 18 0 0 1 4 78 V64 l10 10" stroke="#e7c56a" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              padding: '10px 22px',
              borderRadius: 9999,
              background: 'rgba(199,154,59,0.18)',
              color: '#e7c56a',
              fontSize: 26,
              letterSpacing: 6,
            }}
          >
            KUMANI
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 900 }}>
          <div style={{ fontSize: 68, lineHeight: 1.08, marginBottom: 28 }}>{g.title}</div>
          <div
            style={{
              display: 'flex',
              borderLeft: '8px solid #c79a3b',
              paddingLeft: 24,
              fontSize: 34,
              lineHeight: 1.3,
              color: '#e7c56a',
            }}
          >
            “{g.motto}”
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.6)' }}>{g.eyebrow}</div>
      </div>
    ),
    // Font predefinito (Geist): copre anche il cirillico. L'Inter del
    // progetto è un font variabile, che il generatore non sa leggere.
    size
  )
}
