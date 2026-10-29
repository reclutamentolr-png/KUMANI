import type { ActivationResult } from '@/app/actions/codes'

type T = (key: string, values?: Record<string, string>) => string

// Testo dell'errore di «Hai un codice?» (dashboard, pagina del servizio,
// Wallet), uguale ovunque. t = namespace dashboard, tg = namespace gifts.
export function activationErrorText(result: Pick<ActivationResult, 'kind' | 'reason'>, code: string, t: T, tg: T): string {
  if (result.reason === 'trial_code') return t('activateCodeErrorTrial', { code })
  if (result.kind === 'gift') return tg(`redeem_${result.reason ?? 'error'}`)
  switch (result.reason) {
    case 'not_found':
      return t('activateVoucherErrorNotFound')
    case 'already_used':
      return t('activateVoucherErrorUsed')
    case 'self_redemption':
      return t('activateVoucherErrorSelf')
    case 'revoked':
      return t('activateVoucherErrorRevoked')
    case 'already_subscribed':
      return t('activateVoucherErrorSubscribed')
    case 'already_active':
      return t('activateVoucherErrorUnlimited')
    case 'plan_mismatch':
      return t('activateVoucherErrorPlan')
    case 'already_included':
      return t('activateCodeErrorIncluded')
    default:
      return t('activateVoucherErrorGeneric')
  }
}
