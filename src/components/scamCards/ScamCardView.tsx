'use client'

import { useTranslations } from 'next-intl'
import { CHANNEL_COLORS, type ScamCard } from '@/lib/scamCards/cards'
import { figureSvg } from '@/lib/scamCards/figures'
import s from './ScamCard.module.css'

// Una carta, fronte e retro (flipped = retro). Le figure sono SVG scritti da
// noi in figures.ts, mai testo dell'utente.
export default function ScamCardView({
  card,
  width = 250,
  flipped = false,
  missing = false,
  rarity,
  finder,
  uid,
}: {
  card: ScamCard
  width?: number
  flipped?: boolean
  missing?: boolean
  rarity?: string | null
  // Carta rara: chi ha scoperto la truffa (solo il nome) e quando
  finder?: string | null
  uid: string
}) {
  const t = useTranslations('scamCards')
  const colors = CHANNEL_COLORS[card.channel]
  const num = `${String(card.no).padStart(2, '0')}/20`
  const rarityClass = rarity === 'catturata' ? s.catturata : rarity === 'rara' ? s.rara : rarity === 'mese' ? s.mese : ''
  return (
    <div className={`${s.card} ${flipped ? s.flipped : ''} ${missing ? s.missing : rarityClass}`} style={{ ['--w' as string]: `${width}px` }}>
      <div className={s.face} aria-hidden={flipped}>
        <div className={s.inner}>
          <div className={s.top}>
            <span className={s.name}>{card.name}</span>
            <span className={s.num}>{num}</span>
          </div>
          <div className={s.art} style={{ background: colors.bg }}>
            <span className="contents" dangerouslySetInnerHTML={{ __html: figureSvg(card.no, card.animal, uid) }} />
            <span className={s.chan}>{t(`channel_${card.channel}`)}</span>
            <span className={s.danger} aria-label={t('dangerAria', { level: card.danger })}>
              {'●'.repeat(card.danger)}
              <span className={s.off}>{'●'.repeat(5 - card.danger)}</span>
            </span>
          </div>
          <div className={s.body}>
            <span className={s.label}>{t('bait')}</span>
            <div className={s.bait}>«{card.bait}»</div>
            <div className={s.move}>
              <b>{t('move')}</b> {card.move}
            </div>
            {rarity === 'rara' && finder && <span className={s.finder}>{finder}</span>}
          </div>
          <div className={s.foot}>
            <span className={s.brand}>KUMANI</span>
            <span>{t('deckName')}</span>
          </div>
        </div>
      </div>
      <div className={`${s.face} ${s.back}`} aria-hidden={!flipped}>
        <div className={s.inner}>
          <div className={s.top}>
            <span className={s.name}>{card.name}</span>
            <span className={s.num}>{num}</span>
          </div>
          <div className={s.body}>
            <span className={s.label}>{t('signs')}</span>
            <ul className={s.list}>
              {card.signs.map((sign) => (
                <li key={sign}>{sign}</li>
              ))}
            </ul>
            <span className={s.label}>{t('defense')}</span>
            <div className={s.defense}>{card.defense}</div>
          </div>
          <div className={s.foot}>
            <span className={s.brand}>KUMANI</span>
            <span>{t('deckName')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
