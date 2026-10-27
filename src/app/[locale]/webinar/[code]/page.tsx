import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { X } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import WebinarViewer from '@/components/webinar/WebinarViewer'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/translationOverrides'
import { WEBINAR_CODE_RE, hostLabel } from '@/lib/webinar'

// Pagina del link d'invito: si entra anche senza account, scrivendo il nome.
// Il codice nel link è la chiave; mai su Google (PRIVATE_PAGES).
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'webinar' })
  return { title: t('name'), robots: { index: false, follow: false } }
}

export default async function WebinarGuestPage({ params }: { params: Promise<{ locale: string; code: string }> }) {
  const { locale, code } = await params
  if (!WEBINAR_CODE_RE.test(code)) notFound()
  const db = serviceClient()
  const { data: w } = await db.from('webinars').select('code, title, description, starts_at, status, host_id, host_title').eq('code', code).maybeSingle()
  if (!w) notFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ data: host }, { data: me }] = await Promise.all([
    db.from('profiles').select('first_name, last_name').eq('id', w.host_id).maybeSingle(),
    user ? db.from('profiles').select('first_name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const t = await getTranslations('webinar')
  const hostName = hostLabel([host?.first_name, host?.last_name].filter(Boolean).join(' ') || 'KUMANI', w.host_title as string | null)
  const when = new Date(w.starts_at).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

  return (
    <div className="min-h-screen bg-[var(--ink)] text-white">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-5">
        <Logo size={34} className="h-[34px] w-[34px]" />
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)]">{t('name')}</p>
        {/* Uscita sempre a portata: chi è iscritto torna alla sua Home, gli altri al sito */}
        <Link
          href={user ? '/dashboard' : '/'}
          className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 px-3 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
        >
          <X className="h-4 w-4" aria-hidden />
          {t('exitPage')}
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-5">
        {w.status !== 'live' && (
          <div className="mb-6">
            <p className="text-sm text-white/70">{t('invitedBy', { host: hostName })}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">{w.title}</h1>
            <p className="mt-1 text-sm text-white/75">{when}</p>
            {w.description && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/80">{w.description}</p>}
          </div>
        )}
        <WebinarViewer
          code={w.code}
          title={w.title}
          hostName={hostName}
          startsAt={w.starts_at}
          initialStatus={w.status}
          suggestedName={me?.first_name ?? ''}
        />
        <p className="mt-8 text-center text-xs leading-5 text-white/55">
          {t('privacyNote')}{' '}
          <Link href="/privacy" className="font-bold text-[var(--gold-bright)] underline-offset-2 hover:underline">
            {t('privacyLink')}
          </Link>
        </p>
      </main>
    </div>
  )
}
