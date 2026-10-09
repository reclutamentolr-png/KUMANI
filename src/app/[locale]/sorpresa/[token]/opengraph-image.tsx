import { ImageResponse } from 'next/og'
import { getTranslations } from 'next-intl/server'
import { createElement } from 'react'
import { OG_SIZE } from '@/components/seo/ogCard'
import { surpriseShareInfo } from '@/lib/surpriseServer'
import { OCCASION_ICON_PATHS } from '@/lib/occasionIconPaths'
import { THEME_STYLE } from '@/lib/surprise'

// Anteprima del link di una sorpresa (WhatsApp, Telegram, email…): colori e
// icona dell'occasione, per chi è e da parte di chi. Niente del contenuto.
export const alt = 'KUMANI'
export const size = OG_SIZE
export const contentType = 'image/png'

// Sfondo scuro di ogni tema (stessi colori della pagina della sorpresa)
const BG: Record<string, [string, string]> = {
  gold: ['#2b2110', '#0f0c06'],
  rose: ['#5c1630', '#24060f'],
  sky: ['#123a6b', '#071528'],
  green: ['#14452e', '#061a10'],
  night: ['#231c45', '#0a0816'],
  coral: ['#6b2614', '#1f0904'],
  ruby: ['#5a0d14', '#1a0204'],
  lilac: ['#4a2660', '#170a1f'],
  teal: ['#0d4a4d', '#031618'],
  silver: ['#363b44', '#0e1013'],
}
const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text)

export default async function Image({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  const info = await surpriseShareInfo(token)
  const t = await getTranslations({ locale, namespace: 'surprise' })
  const occasion = info?.occasion ?? 'generic'
  const theme = info?.theme ?? 'gold'
  const accent = THEME_STYLE[theme].accent
  const [c1, c2] = BG[theme] ?? BG.gold
  const paths = OCCASION_ICON_PATHS[occasion] ?? OCCASION_ICON_PATHS.generic
  const name = info?.recipient_name?.trim() || ''
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: `linear-gradient(160deg, ${c1}, ${c2})`, color: '#fff', position: 'relative', fontFamily: 'sans-serif' }}>
        <div style={{ position: 'absolute', left: -140, top: -140, width: 480, height: 480, borderRadius: 9999, background: accent, opacity: 0.25, display: 'flex' }} />
        <div style={{ position: 'absolute', right: -160, bottom: -180, width: 560, height: 560, borderRadius: 9999, background: accent, opacity: 0.18, display: 'flex' }} />
        {/* Pacco regalo */}
        <div style={{ position: 'absolute', right: 110, top: 150, width: 300, height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 300, height: 80, borderRadius: 22, background: accent, display: 'flex', justifyContent: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
            <div style={{ width: 44, height: 80, background: 'rgba(255,255,255,0.85)', display: 'flex' }} />
          </div>
          <div style={{ marginTop: 12, width: 260, height: 190, borderRadius: 22, background: accent, opacity: 0.92, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 108, top: 0, width: 44, height: 190, background: 'rgba(255,255,255,0.8)', display: 'flex' }} />
            <svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              {paths.map(([tag, attrs], i) => createElement(tag, { ...attrs, key: i }))}
            </svg>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px', width: 720 }}>
          <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>{t(`occasionTitle_${occasion}`)}</div>
          <div style={{ display: 'flex', fontSize: name.length > 14 ? 76 : 104, fontWeight: 700, lineHeight: 1.05, marginTop: 14 }}>{clip(name || '…', 26)}</div>
          {info?.sender_name && <div style={{ display: 'flex', fontSize: 36, marginTop: 18, color: 'rgba(255,255,255,0.85)' }}>{clip(t('viewFrom', { name: info.sender_name }), 40)}</div>}
          <div style={{ display: 'flex', marginTop: 44, alignSelf: 'flex-start', padding: '14px 30px', borderRadius: 9999, background: '#fff', color: accent, fontSize: 30, fontWeight: 700 }}>{t('ogCta')}</div>
        </div>
        <div style={{ position: 'absolute', left: 80, bottom: 40, display: 'flex', fontSize: 22, letterSpacing: 6, color: 'rgba(255,255,255,0.55)' }}>KUMANI</div>
      </div>
    ),
    OG_SIZE
  )
}
