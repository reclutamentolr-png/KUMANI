import { getTranslations } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Radio } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import WebinarStudio from '@/components/webinar/WebinarStudio'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/translationOverrides'
import { canHostWebinars } from '@/app/actions/webinar'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'webinar' })
  return { title: t('studioTitle'), robots: { index: false, follow: false } }
}

// Regia di chi presenta: anteprima, diretta, persone collegate e chat
export default async function WebinarStudioPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const prefix = locale === 'it' ? '' : `/${locale}`
  if (!user) redirect(`${prefix}/login?next=/app/webinar/${id}`)
  if (!(await canHostWebinars(user.id))) redirect(`${prefix}/dashboard`)

  const db = serviceClient()
  const [{ data: w }, { data: profile }] = await Promise.all([
    db.from('webinars').select('id, host_id, code, title, starts_at, status, channel_key, seats').eq('id', id).maybeSingle(),
    db.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle(),
  ])
  if (!w || w.host_id !== user.id) notFound()
  const t = await getTranslations('webinar')
  const hostName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'KUMANI'

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/app/webinar" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)] shrink-0">
            <ArrowLeft className="h-5 w-5" />
            {t('myWebinars')}
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 font-semibold tracking-wide text-right leading-tight">
            <Radio className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            <span className="truncate">{w.title}</span>
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <WebinarStudio
          webinar={{ id: w.id, code: w.code, title: w.title, startsAt: w.starts_at, status: w.status, channelKey: w.channel_key, seats: w.seats }}
          hostName={hostName}
        />
      </main>
    </div>
  )
}
