// Parte del video della homepage usata anche nel browser (niente database):
// codici di YouTube, libreria dei video e copertina. Vedi lib/homeVideo.ts.
export const DEFAULT_HOME_VIDEO = 'JFcbxosWPLM'
export const HOME_VIDEOS_MAX = 30

// Un video della libreria. Titolo, oro e frase vuoti = testi tradotti del
// tormentone (solo per il video di partenza) oppure nessun testo
export type HomeVideoEntry = { id: string; title: string; accent: string; text: string }

// Codice di 11 caratteri da un link di YouTube (youtu.be, watch?v=, shorts,
// embed) o dal codice stesso; null se non è un video di YouTube
export function youtubeId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const url = new URL(s)
    const host = url.hostname.replace(/^(www|m)\./, '')
    if (host === 'youtu.be') return youtubeId(url.pathname.slice(1).split('/')[0])
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v')
      if (v) return youtubeId(v)
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)
      return m ? m[1] : null
    }
  } catch {
    // non è un indirizzo
  }
  return null
}

const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')

// Libreria letta da system_settings: voci non valide scartate, codici unici
export function parseHomeVideos(value: unknown): HomeVideoEntry[] {
  let list: unknown = value
  try {
    list = typeof list === 'string' ? JSON.parse(list) : list
  } catch {
    return []
  }
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: HomeVideoEntry[] = []
  for (const raw of list) {
    const id = raw && typeof raw === 'object' ? youtubeId(String((raw as { id?: unknown }).id ?? '')) : null
    if (!id || seen.has(id)) continue
    seen.add(id)
    const r = raw as Record<string, unknown>
    out.push({ id, title: clip(r.title, 80), accent: clip(r.accent, 40), text: clip(r.text, 240) })
    if (out.length >= HOME_VIDEOS_MAX) break
  }
  return out
}

export function parseActiveVideo(value: unknown): string | null {
  try {
    value = typeof value === 'string' ? JSON.parse(value) : value
  } catch {
    // testo semplice
  }
  return typeof value === 'string' && value ? youtubeId(value) : null
}

// Copertina: quella disegnata per il tormentone, l'anteprima di YouTube per
// gli altri video
export const homeVideoCover = (id: string) => (id === DEFAULT_HOME_VIDEO ? '/home/inno-kumani.webp' : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`)
