import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import AppHeader from '@/components/nav/AppHeader'
import Link from '@/components/LocalizedLink'
import { getSessionUser, preloadSession } from '@/lib/session'
import { isHeading, personalize, textsFor } from '@/lib/communications'
import { emailBodyToText } from '@/lib/emailBlocks'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('notifications')
  return { title: t('messageTitle'), robots: { index: false, follow: false } }
}

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Un messaggio dello Staff a tutti gli iscritti (Admin → Comunicazioni): si
// apre dalla notifica sul telefono e dalla campanella. Solo dopo l'invio e
// solo per chi ha un account; aprendolo l'avviso risulta letto.
export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  preloadSession()
  const [locale, t, user] = await Promise.all([getLocale(), getTranslations('notifications'), getSessionUser()])
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/messaggio/${id}`)}`)
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const s = db()
  const { data: c } = await s.from('staff_communications').select('id, push_title, push_body, email_subject, email_preheader, email_body, translations, push_sent_at, email_sent_at, email_layout').eq('id', id).maybeSingle()
  if (!c || (!c.push_sent_at && !c.email_sent_at)) notFound()
  const { data: me } = await s.from('profiles').select('first_name').eq('id', user.id).maybeSingle()
  await s.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).eq('kind', `communication:${id}`).is('read_at', null)

  const raw = (me?.first_name ?? '').trim().split(/\s+/)[0] ?? ''
  const name = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : ''
  // Nella lingua della pagina (traduzione, poi inglese, poi italiano)
  const tx = textsFor(c, locale)
  const title = personalize(tx.email_subject || tx.push_title || '', name)
  const fullBody = personalize(tx.email_body || tx.push_body || '', name)
  // Email con grafica (titoli, elenchi, pulsanti): qui come testo, con i titoli in evidenza
  const body = tx.email_body && c.email_layout && c.email_layout !== 'classic' ? emailBodyToText(fullBody) : fullBody
  const sentAt = new Date(c.push_sent_at ?? c.email_sent_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      <AppHeader title={t('messageTitle')} icon={<Megaphone className="h-5 w-5" />} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/avvisi" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-4 w-4" /> {t('messageBack')}
        </Link>
        <article className="rounded-3xl border border-[var(--gold)]/25 bg-white p-6 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">{t('messageFrom', { date: sentAt })}</p>
          <h1 className="mt-2 text-2xl font-bold text-[var(--ink)]">{title}</h1>
          <div className="mt-5 space-y-4 text-[15px] leading-relaxed text-[var(--ink)]/90">
            {body
              .trim()
              .split(/\n{2,}/)
              .map((para, i) => (
                <p key={i}>
                  {para.split('\n').map((line, k) => {
                    const heading = isHeading(line)
                    return (
                      <span key={k}>
                        {k > 0 && <br />}
                        {heading ? <strong className="tracking-wide text-[#8a6a1f]">{line}</strong> : line}
                      </span>
                    )
                  })}
                </p>
              ))}
          </div>
        </article>
      </main>
    </div>
  )
}
