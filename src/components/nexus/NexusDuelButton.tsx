'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Swords } from 'lucide-react'
import { createNexusDuel } from '@/app/actions/nexusDuel'

// «Sfida un amico»: crea la sfida e apre la sua pagina, con il codice da mandare.
export default function NexusDuelButton({ gridLocale, className }: { gridLocale: string; className?: string }) {
  const t = useTranslations('nexus')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const start = async () => {
    setBusy(true)
    setFailed(false)
    const res = await createNexusDuel(gridLocale).catch(() => ({ error: 'error' }))
    if ('code' in res) {
      router.push(`${locale === 'it' ? '' : `/${locale}`}/marketplace/nexus/duello/${res.code}`)
      return
    }
    setBusy(false)
    setFailed(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className={
          className ??
          'flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-[var(--ink)] px-4 text-base font-extrabold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-60'
        }
      >
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Swords className="h-5 w-5" />} {t('duel_challenge')}
      </button>
      {failed && <p className="text-center text-sm font-semibold text-rose-700">{t('error_save')}</p>}
    </>
  )
}
