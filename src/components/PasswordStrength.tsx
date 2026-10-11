'use client'

import { useTranslations } from 'next-intl'

// Robustezza della password mentre si scrive: solo un consiglio, non blocca.
// Il minimo obbligatorio (8 caratteri) lo controllano il modulo e Supabase.
const COMMON = /^(password|passw0rd|qwerty|qwertz|azerty|12345678|123456789|1234567890|11111111|00000000|iloveyou|kumani|abc12345|admin123|letmein)/i

export function passwordScore(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 8) return 0
  let points = 0
  if (password.length >= 12) points++
  if (password.length >= 16) points++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++
  if (/\d/.test(password)) points++
  if (/[^A-Za-z0-9]/.test(password)) points++
  if (COMMON.test(password) || /^(.)\1+$/.test(password)) points = 0
  return points >= 4 ? 3 : points >= 2 ? 2 : 1
}

export default function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations('auth')
  if (!password) return null
  const score = passwordScore(password)
  const level = score === 0 ? 'short' : score === 1 ? 'weak' : score === 2 ? 'medium' : 'strong'
  const tone = { short: 'bg-red-500', weak: 'bg-orange-500', medium: 'bg-amber-400', strong: 'bg-emerald-500' }[level]
  const text = { short: 'text-red-700', weak: 'text-orange-700', medium: 'text-amber-800', strong: 'text-emerald-700' }[level]
  const filled = level === 'short' ? 0 : score

  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= filled ? tone : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className={`mt-1 text-xs font-semibold ${text}`}>
        {t(`pwStrength_${level}`)}
        {level !== 'strong' && <span className="font-normal text-gray-500"> · {t('pwStrengthHint')}</span>}
      </p>
    </div>
  )
}
