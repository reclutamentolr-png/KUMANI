import { SITE_URL } from '@/lib/siteUrl'

// Link pubblico del manuale (anteprima per chi non è iscritto), con il
// codice invito di chi condivide. L'italiano non ha prefisso di lingua.
export function guideShareUrl(locale: string, referralCode?: string | null) {
  const path = `${locale === 'it' ? '' : `/${locale}`}/manuale-antitruffa`
  return `${SITE_URL}${path}${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`
}
