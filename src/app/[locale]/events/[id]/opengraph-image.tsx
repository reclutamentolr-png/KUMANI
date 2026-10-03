import { getTranslations } from 'next-intl/server'
import { getEvent } from '@/app/actions/events'
import { formatEventDate } from '@/lib/events'
import { ogCard, OG_SIZE } from '@/components/seo/ogCard'

export const alt = 'KUMANI Events'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const event = await getEvent(id)
  if (!event) return ogCard({ eyebrow: 'Events', title: 'KUMANI Events' })
  const t = await getTranslations({ locale, namespace: 'events' })
  const where = event.mode === 'online' ? t('mode_online') : event.city ?? ''
  return ogCard({ eyebrow: 'Events', title: event.title, subtitle: [formatEventDate(event.starts_at, event.timezone, locale), where].filter(Boolean).join(' · ') })
}
