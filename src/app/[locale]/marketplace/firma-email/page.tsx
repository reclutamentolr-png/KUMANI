import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Signature } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import SignatureBuilder from '@/components/firmaEmail/SignatureBuilder'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'
import type { MyProfile } from '@/lib/myProfile'

// Firma Email (Marketing, PRO): generatore di firme email professionali.
// Tutto avviene nel browser; il server legge solo il profilo (nome, email,
// telefono e codice invito) per precompilare il modulo e costruire il link
// alla pagina pubblica del Kumano (Link in Bio). Nessun dato viene salvato.
export default async function FirmaEmailPage() {
  const locale = await getLocale()
  const t = await getTranslations('firmaEmail')
  const tm = await getTranslations('marketplace')
  const tc = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: me } = user ? await supabase.rpc('get_my_profile').maybeSingle<MyProfile>() : { data: null }

  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const prefill = {
    fullName: [text(me?.first_name), text(me?.last_name)].filter(Boolean).join(' '),
    role: text(me?.occupation),
    email: text(me?.email) || user?.email || '',
    phone: text(me?.phone),
  }
  const code = text(me?.referral_code)
  const cardUrl = code ? `${SITE_URL}/${locale}/ref/${encodeURIComponent(code)}/bio` : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {tm('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 text-right font-semibold tracking-wide">
            <Signature className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {tm('firmaEmail')}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <Signature className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>

        <SignatureBuilder prefill={prefill} cardUrl={cardUrl} />

        <p className="mt-6 text-center text-xs leading-5 text-[var(--muted)]">{t('privacyNote')}</p>
      </main>
    </div>
  )
}
