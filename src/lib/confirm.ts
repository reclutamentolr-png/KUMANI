// Conferma con la finestra grafica di KUMANI al posto di window.confirm:
// `if (!(await askConfirm(testo))) return`. La finestra è disegnata da
// ConfirmHost (montato una volta in AppShell); senza di lui si usa la
// conferma del browser, così nulla si blocca.

export type ConfirmTone = 'danger' | 'warning' | 'default'
export type ConfirmOptions = { title?: string; confirmLabel?: string; tone?: ConfirmTone }
export type ConfirmRequest = ConfirmOptions & { message: string; resolve: (ok: boolean) => void }

let show: ((req: ConfirmRequest) => void) | null = null

export function registerConfirmHost(fn: ((req: ConfirmRequest) => void) | null) {
  show = fn
}

// Cancellazioni (nelle 7 lingue): pulsante rosso «Elimina» con il cestino
const DELETE = /elimin|cancell|rimuov|delete|remove|erase|supprim|effac|borrar|quitar|apagar|remover|lösch|entfern|удал|стер/i
// Altre azioni da cui non si torna indietro: pulsante rosso «Conferma»
const WARNING = /annull|svuot|revoc|blocc|togli|chiud|cancel|revoke|block|annul|bloqu|anular|cancelar|stornier|sperr|отмен|блок/i

export function askConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  const tone = options.tone ?? (DELETE.test(message) ? 'danger' : WARNING.test(message) ? 'warning' : 'default')
  if (!show) return Promise.resolve(window.confirm(message))
  return new Promise((resolve) => show!({ ...options, tone, message, resolve }))
}
