import { ImageResponse } from 'next/og'
import { OG_SIZE } from '@/components/seo/ogCard'
import { cardBySlug, CHANNEL_COLORS } from '@/lib/scamCards/cards'
import { figureSvg } from '@/lib/scamCards/figures'

// Anteprima su WhatsApp e sui social: la figura della carta e la sua esca
export const alt = 'KUMANI · Carte Antitruffa'
export const size = OG_SIZE
export const contentType = 'image/png'

const clip = (text: string, max: number) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text)

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const card = cardBySlug(slug)
  if (!card) return new ImageResponse(<div style={{ display: 'flex', width: '100%', height: '100%', background: '#171717' }} />, OG_SIZE)
  const figure = `data:image/svg+xml;base64,${Buffer.from(figureSvg(card.no, card.animal, 'og')).toString('base64')}`
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#171717', color: '#ffffff' }}>
        <div style={{ display: 'flex', width: 500, height: '100%', padding: 28, background: 'linear-gradient(145deg, #e7c56a, #c79a3b 55%, #9d7424)' }}>
          <div style={{ display: 'flex', flex: 1, borderRadius: 24, background: CHANNEL_COLORS[card.channel].bg, alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={figure} width={420} height={273} alt="" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, padding: '56px 56px' }}>
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 5, color: '#e7c56a' }}>KUMANI · CARTE ANTITRUFFA</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 60, lineHeight: 1.05, marginBottom: 26 }}>{card.name}</div>
            <div style={{ display: 'flex', borderLeft: '8px solid #c79a3b', paddingLeft: 22, fontSize: 28, lineHeight: 1.3, color: '#f3ecdb' }}>«{clip(card.bait, 110)}»</div>
          </div>
          <div style={{ display: 'flex', fontSize: 26, color: '#e7c56a' }}>{clip(card.move, 70)}</div>
        </div>
      </div>
    ),
    OG_SIZE
  )
}
