import { ImageResponse } from 'next/og'

// Anteprima del link sui social (WhatsApp, Facebook, Telegram...) per
// servizi, guide ed eventi: nero e oro come quella del Manuale Anti-Truffa.
export const OG_SIZE = { width: 1200, height: 630 }

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text)

export function ogCard({ eyebrow, title, subtitle, footer }: { eyebrow?: string; title: string; subtitle?: string; footer?: string }) {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', padding: '10px 22px', borderRadius: 9999, background: 'rgba(199,154,59,0.18)', color: '#e7c56a', fontSize: 26, letterSpacing: 6 }}>
            KUMANI
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: 'rgba(255,255,255,0.7)' }}>{clip(eyebrow ?? '', 40)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 960 }}>
          <div style={{ fontSize: title.length > 40 ? 58 : 72, lineHeight: 1.08, marginBottom: subtitle ? 28 : 0 }}>{clip(title, 80)}</div>
          {subtitle && (
            <div style={{ display: 'flex', borderLeft: '8px solid #c79a3b', paddingLeft: 24, fontSize: 32, lineHeight: 1.3, color: '#e7c56a' }}>
              {clip(subtitle, 150)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: 'rgba(255,255,255,0.6)' }}>{footer ?? 'kumani.io'}</div>
      </div>
    ),
    // Font predefinito (Geist): copre anche il cirillico. L'Inter del
    // progetto è un font variabile, che il generatore non sa leggere.
    OG_SIZE
  )
}
