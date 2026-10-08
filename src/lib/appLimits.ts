import { getTranslations } from 'next-intl/server'

// Limiti per persona impostati dall'Admin (tabella app_limits): superato il
// limite il database rifiuta il salvataggio con «app_limit:<chiave>:<max>».
// Qui l'errore diventa un messaggio già tradotto per chi usa l'app.
export function appLimitMax(error: { message?: string } | null | undefined): number | null {
  const match = /app_limit:[a-z0-9_.-]+:(\d+)/i.exec(error?.message ?? '')
  return match ? Number(match[1]) : null
}

export async function limitError(error: { message?: string } | null | undefined) {
  const max = appLimitMax(error)
  if (max === null) return null
  const t = await getTranslations('common')
  return { success: false as const, message: 'limitReached', limitText: t('limitReached', { max }) }
}
