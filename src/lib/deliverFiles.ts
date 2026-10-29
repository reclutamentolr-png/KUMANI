// Consegna dei file creati nel browser (biglietti da visita).
// Sul telefono si apre la condivisione con il file vero: scaricato, il PDF
// si apriva in un'anteprima con un indirizzo «blob:https://kumani.io/…» e,
// condiviso da lì, arrivava un link che dava 404. Sul computer, o se la
// condivisione non c'è, i file si scaricano uno dopo l'altro.

import { askConfirm } from '@/lib/confirm'

// iPad con iPadOS si presenta come un Mac: lo si riconosce dal tocco (un
// computer Windows con lo schermo tattile invece scarica come gli altri)
const isPhone = () => /Android|iPhone|iPad/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, body] = dataUrl.split(',')
  const type = head.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return new File([bytes], name, { type })
}

// ready: testo della finestra «Il file è pronto» con il pulsante «Condividi».
// Serve quando il file ci ha messo qualche secondo a prepararsi: il telefono
// apre la condivisione solo subito dopo un tocco, e così il tocco c'è di nuovo
export async function deliverFiles(files: File[], ready?: { message: string; confirmLabel: string }): Promise<void> {
  if (isPhone() && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ files })
      return
    } catch (e) {
      // Chiusa dall'utente: niente da fare
      if (e instanceof DOMException && e.name === 'AbortError') return
      // Troppo tempo dal tocco: si chiede un tocco nuovo e si riprova
      if (e instanceof DOMException && e.name === 'NotAllowedError' && ready && (await askConfirm(ready.message, { confirmLabel: ready.confirmLabel, tone: 'default' }))) {
        try {
          await navigator.share({ files })
          return
        } catch (again) {
          if (again instanceof DOMException && again.name === 'AbortError') return
        }
      }
      // Altri errori: si scaricano
    }
  }
  for (const [i, file] of files.entries()) {
    // Più file di fila: una piccola pausa, così il browser li scarica tutti
    if (i > 0) await new Promise((r) => setTimeout(r, 400))
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}
