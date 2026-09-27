import { SITE_URL } from '@/lib/siteUrl'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import QRCode from 'qrcode'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import PrintButton from '@/components/admin/PrintButton'
import { createClient } from '@/lib/supabase/server'
import { loadMenuData } from '@/lib/menu-server'

// Cartoncini da tavolo: 4 per foglio A4 (da ritagliare), con QR del menù e
// l'invito a scansionare in tutte le lingue attive del menù.
export default async function MenuTentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { menu } = await loadMenuData(supabase, user.id)
  if (!menu) redirect(`/${locale}/marketplace/menu`)

  const tb = await getTranslations('menuBuilder')
  const site = SITE_URL
  const qr = await QRCode.toDataURL(`${site}/m/${menu.token}`, { width: 480, margin: 1 })
  const invitations = await Promise.all(
    [menu.default_locale, ...menu.languages.filter((l) => l !== menu.default_locale)].map(async (l) => {
      const t = await getTranslations({ locale: l, namespace: 'menuPublic' })
      return { lang: l, text: t('scanForMenu') }
    })
  )

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-4 print:hidden">
        <Link href="/marketplace/menu" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
          ← {tb('backToBuilder')}
        </Link>
        <PrintButton label={tb('print')} />
        <p className="w-full text-xs text-gray-500">{tb('tentHint')}</p>
      </div>

      <div className="mx-auto grid max-w-[210mm] grid-cols-2 gap-[6mm] bg-white p-[8mm] shadow print:shadow-none">
        {[0, 1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex h-[132mm] flex-col items-center justify-between rounded-xl border-2 border-dashed border-gray-300 bg-[#141311] p-5 text-center text-[#f4efe3] print:rounded-none [print-color-adjust:exact]"
          >
            <div>
              <div className="flex items-center justify-center gap-2">
                <Logo size={24} className="h-6 w-6" />
                <span className="text-[10px] font-bold tracking-[0.3em] text-[#e7c56a]">MENU</span>
              </div>
              <p className="mt-2 font-serif text-xl font-bold leading-tight">{menu.restaurant_name}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" className="h-[52mm] w-[52mm] rounded-lg bg-white p-1.5" />
            <ul className="space-y-0.5">
              {invitations.map(({ lang, text }, i) => (
                <li key={lang} lang={lang} className={i === 0 ? 'text-sm font-bold text-[#e7c56a]' : 'text-[10px] text-[#f4efe3]/75'}>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
