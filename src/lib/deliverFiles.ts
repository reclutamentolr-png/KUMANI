// Consegna dei file creati nel browser (biglietti da visita).
// Sul telefono si apre la condivisione con il file vero: scaricato, il PDF
// si apriva in un'anteprima con un indirizzo «blob:https://kumani.io/…» e,
// condiviso da lì, arrivava un link che dava 404. Sul computer, o se la
// condivisione non c'è, i file si scaricano uno dopo l'altro.

const isPhone = () => /Android|iPhone|iPad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1

export function dataUrlToFile(dataUrl: string, name: string): File {
  const [head, body] = dataUrl.split(',')
  const type = head.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return new File([bytes], name, { type })
}

export async function deliverFiles(files: File[]): Promise<void> {
  if (isPhone() && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ files })
      return
    } catch (e) {
      // Chiusa dall'utente: niente da fare. Altri errori (ad esempio il
      // telefono non la permette più dopo l'attesa): si scaricano
      if (e instanceof DOMException && e.name === 'AbortError') return
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
