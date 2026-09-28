import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import VeritasRoom from '@/components/veritas/VeritasRoom'
import { getVeritasRoom } from '@/app/actions/veritas'
import { createClient } from '@/lib/supabase/server'
import { isRoomCode } from '@/lib/veritas'
import { ServiceStopped } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Stanza di Veritas (/veritas/<codice>): pubblica, si gioca anche senza account.
export default async function VeritasRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  if (!(await isToolOnline('veritas'))) return <ServiceStopped />
  const code = rawCode.toUpperCase()
  const t = await getTranslations('veritas')
  const info = isRoomCode(code) ? await getVeritasRoom(code) : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let defaultNickname = ''
  if (user) {
    const { data } = await supabase.from('profiles').select('first_name').eq('id', user.id).maybeSingle()
    defaultNickname = data?.first_name ?? ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--ink-soft)] to-[var(--ink)] px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <Link href={user ? '/marketplace/veritas' : '/'} className="mb-6 flex items-center justify-center gap-2">
          <Logo size={36} className="h-9 w-9" />
          <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">VERITAS</span>
        </Link>
        {info ? (
          <VeritasRoom code={code} info={info} isLoggedIn={!!user} defaultNickname={defaultNickname} />
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <p className="text-white/80">{t('roomNotFound')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
