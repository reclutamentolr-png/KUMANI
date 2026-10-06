'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Link2, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { addCvToLinkInBio } from '@/app/actions/ecosystem'

// CV → Link in bio: il link pubblico del CV tra i link del Link in bio
export default function CvToBioButton({ publicUrl }: { publicUrl: string }) {
  const t = useTranslations('ecosystem')
  const [state, setState] = useState<'idle' | 'busy' | 'added' | 'exists' | 'no_access' | 'error'>('idle')

  if (state === 'added' || state === 'exists') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-700">
        <Check className="h-4 w-4" /> {t(state === 'added' ? 'cvToBioDone' : 'cvToBioExists')}
        <Link href="/marketplace/link-in-bio" className="text-[var(--gold)] underline hover:text-[var(--ink)]">
          {t('cvToBioOpen')}
        </Link>
      </span>
    )
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy')
          setState(await addCvToLinkInBio(publicUrl))
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-60"
      >
        {state === 'busy' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4 text-[var(--gold)]" />}
        {t('cvToBioButton')}
      </button>
      {state === 'no_access' && <span className="text-xs text-[var(--muted)]">{t('cvToBioNoAccess')}</span>}
      {state === 'error' && <span className="text-xs text-red-600">{t('cvToBioError')}</span>}
    </span>
  )
}
