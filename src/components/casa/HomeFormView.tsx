'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { createHome, updateHome } from '@/app/actions/casa'
import { HOME_KINDS, emptyHomeForm, type CasaHome, type HomeForm } from '@/lib/casa'
import { defaultLocale } from '../../../i18n'
import { input, label, primaryBtn } from '@/components/casa/shared'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

export default function HomeFormView({ home }: { home?: CasaHome }) {
  const t = useTranslations('casa')
  const router = useRouter()
  const locale = useLocale()
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<HomeForm>(
    home ? { name: home.name, kind: home.kind, address: home.address ?? '', notes: home.notes ?? '' } : emptyHomeForm()
  )
  const set = <K extends keyof HomeForm>(key: K, value: HomeForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = home ? await updateHome(home.id, form) : await createHome(form)
      if (!result.success) {
        setError(t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError'))
        return
      }
      const id = home ? home.id : (result.data as { id: string }).id
      router.push(`${prefix}/marketplace/casa/${id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <label className={label} htmlFor="home-name">
          {t('homeName')}
        </label>
        <input id="home-name" className={input} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={60} placeholder={t('homeNamePlaceholder')} required />
      </div>
      <div>
        <span className={label}>{t('homeKind')}</span>
        <div className="flex flex-wrap gap-2">
          {HOME_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => set('kind', kind)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                form.kind === kind ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-gray-700 hover:border-[var(--gold)]'
              }`}
            >
              {t(`homeKind_${kind}`)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={label} htmlFor="home-address">
          {t('homeAddress')}
        </label>
        <input id="home-address" className={input} value={form.address} onChange={(e) => set('address', e.target.value)} maxLength={160} placeholder={t('homeAddressPlaceholder')} />
      </div>
      <div>
        <label className={label} htmlFor="home-notes">
          {t('notes')}
        </label>
        <textarea id="home-notes" className={`${input} min-h-[90px]`} value={form.notes} onChange={(e) => set('notes', e.target.value)} maxLength={1000} placeholder={t('homeNotesPlaceholder')} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} fallbackHref={home ? `/marketplace/casa/${home.id}` : '/marketplace/casa'} />
        <button type="submit" disabled={isPending} className={`${primaryBtn} flex-1 sm:flex-none`}>
          {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />} {home ? t('saveChanges') : t('createHome')}
        </button>
      </div>
    </form>
  )
}
