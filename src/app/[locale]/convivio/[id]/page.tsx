import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { MapPin, Package, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { ProgressBar } from '@/components/convivio/ConvivioCardItem'
import { createClient } from '@/lib/supabase/server'
import { formatEuro, savingPercent, type ConvivioPublic } from '@/lib/convivio'

// Anteprima pubblica di una Kordata (link condiviso su WhatsApp): si vede
// cosa si compra e a che punto è; per aderire serve l'account KUMANI (con il
// codice invito del capocordata già inserito).
export default async function ConvivioPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { id } = await params
  const { ref } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const t = await getTranslations('convivio')
  const locale = await getLocale()
  const supabase = await createClient()
  const [{ data }, { data: auth }] = await Promise.all([supabase.rpc('convivio_public', { p_group: id }), supabase.auth.getUser()])
  const card = data as ConvivioPublic | null
  if (!card) notFound()
  // Chi ha condiviso il link (?ref=): l'amico si iscrive con il suo codice;
  // senza, con quello del capocordata.
  type Inviter = { first_name: string; last_name: string; referral_code: string }
  let inviter: Inviter | null = null
  const code = typeof ref === 'string' ? ref.trim().toUpperCase() : ''
  if (/^[A-Z0-9-]{3,32}$/.test(code)) {
    const { data: found } = await supabase.rpc('get_public_profile_by_referral', { p_referral_code: code })
    inviter = ((found as Inviter[] | null) ?? [])[0] ?? null
  }
  const sponsor = inviter?.referral_code ?? card.leader_referral
  const saving = savingPercent(card)
  const open = card.status === 'open'

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-10 text-white">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo size={40} className="h-10 w-10" />
          <span className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">KORDATA</span>
        </Link>
        <div className="rounded-3xl border border-[var(--gold)]/25 bg-white/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('publicEyebrow', { name: inviter?.first_name || card.leader_name || '' })}</p>
          <h1 className="mt-2 text-2xl font-bold">{card.title}</h1>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-white/70">
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" /> {card.supplier_name}
            </span>
            {card.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {card.city}
              </span>
            )}
          </p>
          <div className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold text-[var(--gold-bright)]">{formatEuro(card.group_price, locale)}</span>
            {card.unit_label && <span className="text-sm text-white/60">/ {card.unit_label}</span>}
            {card.retail_price && saving ? (
              <>
                <span className="text-sm text-white/40 line-through">{formatEuro(card.retail_price, locale)}</span>
                <span className="rounded bg-emerald-500/20 px-2 text-sm font-bold text-emerald-300">-{saving}%</span>
              </>
            ) : null}
          </div>
          <div className="mt-4">
            <ProgressBar people={card.people} min={card.min_participants} max={card.max_participants} />
            <p className="mt-1.5 flex items-center gap-1 text-sm text-white/70">
              <Users className="h-4 w-4" /> {t('peopleOfMin', { people: card.people, min: card.min_participants })}
            </p>
          </div>
          {card.description && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/80">{card.description}</p>}

          {open ? (
            auth.user ? (
              <Link
                href={`/marketplace/convivio/${card.id}`}
                className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
              >
                {t('joinButton')}
              </Link>
            ) : (
              <>
                <Link
                  href={sponsor ? `/register?sponsor=${encodeURIComponent(sponsor)}` : '/register'}
                  className="mt-6 flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
                >
                  {t('registerToJoin')}
                </Link>
                <Link href="/login" className="mt-3 block text-center text-sm text-white/70 hover:text-white">
                  {t('alreadyMember')}
                </Link>
              </>
            )
          ) : (
            <p className="mt-6 rounded-xl bg-white/10 px-4 py-3 text-center text-sm">{t(`status_${card.status}`)}</p>
          )}
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-white/40">{t('paymentsNotice')}</p>
      </div>
    </div>
  )
}
