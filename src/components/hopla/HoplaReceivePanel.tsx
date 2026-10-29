'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Download, FileVideo, File as FileIcon, FolderOpen, LoaderCircle, Share2, Trash2, X, Zap } from 'lucide-react'
import {
  HOPLA_MEMORY_WARN,
  HOPLA_PHONE_MEMORY_WARN,
  formatBytes,
  isHandheld,
  linkCancel,
  linkSend,
  parseCtrl,
  safeFileName,
  withSuffix,
  type HoplaCtrl,
  type HoplaFileMeta,
  type HoplaLink,
  type HoplaRoute,
} from '@/lib/hopla'

type Phase = 'idle' | 'asking' | 'receiving' | 'done'

type Received = { key: number; i: number; name: string; size: number; type: string; url: string | null; blob: Blob | null; saved: boolean; dir: DirHandle | null }

type DirHandle = FileSystemDirectoryHandle
type Writer = { write: (data: ArrayBuffer) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }
type PickerWindow = Window & { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<DirHandle> }

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
const primary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-base font-bold text-[var(--gold-bright)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:opacity-50'
const secondary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-5 text-base font-bold text-[var(--ink)] transition hover:bg-[var(--gold-pale)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]'

const canPickFolder = () => typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function'
const canShareFiles = (files: File[]) => {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files })
  } catch {
    return false
  }
}

type Props = {
  link: HoplaLink | null
  // Nome dell'altro dispositivo (es. «iPhone», «Computer»)
  peer: string
  onBusy?: (busy: boolean) => void
  onDone?: () => void
  // Ricontrolla il tipo di collegamento all'inizio della ricezione
  onStart?: () => void
  // Via internet e lento: si consiglia la stessa Wi-Fi
  route?: HoplaRoute
}

// Hoplà, chi riceve: l'altro dispositivo propone i file, qui si accetta (in
// una cartella con Chrome/Edge sul computer, in memoria altrove) e si
// salvano. Sul telefono «Salva» apre la condivisione (Foto, File, app).
export default function HoplaReceivePanel({ link, peer, onBusy, onDone, onStart, route = null }: Props) {
  const t = useTranslations('hopla')
  const locale = useLocale()
  const [phase, setPhase] = useState<Phase>('idle')
  const [incoming, setIncoming] = useState<HoplaFileMeta[]>([])
  const [received, setReceived] = useState<Received[]>([])
  const [progress, setProgress] = useState({ bytes: 0, total: 0, speed: 0, file: 0, fileBytes: 0 })
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [folderSupported, setFolderSupported] = useState(false)
  const [handheld, setHandheld] = useState(false)
  // Ultimo invio annullato: dall'altro dispositivo o da qui
  const [cancelled, setCancelled] = useState<'peer' | 'me' | null>(null)

  // Dopo un annullamento i pezzi ancora in viaggio si scartano fino al prossimo invio
  const ignoreRef = useRef(false)
  const dirRef = useRef<DirHandle | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const incomingRef = useRef<HoplaFileMeta[]>([])
  const currentRef = useRef<{ meta: HoplaFileMeta; name: string; writer: Writer | null; chunks: ArrayBuffer[]; handle: FileSystemFileHandle | null } | null>(null)
  const bytesRef = useRef(0)
  const fileBytesRef = useRef(0)
  const startRef = useRef(0)
  const urlsRef = useRef<string[]>([])
  const seqRef = useRef(0)
  const linkRef = useRef(link)

  useEffect(() => {
    // Sul telefono niente cartelle: si riceve e poi si salva con la condivisione
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFolderSupported(canPickFolder() && !isHandheld())
    setHandheld(isHandheld())
  }, [])

  const go = (next: Phase) => {
    setPhase(next)
    onBusy?.(next === 'asking' || next === 'receiving')
  }

  // Un file arrivato a metà va scartato
  const dropCurrent = async () => {
    const current = currentRef.current
    currentRef.current = null
    if (!current) return
    await current.writer?.abort?.().catch(() => {})
    if (current.handle && dirRef.current) await dirRef.current.removeEntry(current.name).catch(() => {})
  }

  const uniqueName = async (base: string) => {
    const dir = dirRef.current
    if (!dir) return base
    for (let n = 0; n < 500; n++) {
      const name = n === 0 ? base : withSuffix(base, n)
      try {
        await dir.getFileHandle(name)
      } catch {
        return name
      }
    }
    return withSuffix(base, Date.now())
  }

  // Annullamento (dall'altro dispositivo o con «Annulla ricezione»): subito, il file a metà si scarta
  const cancelIncoming = (by: 'peer' | 'me') => {
    ignoreRef.current = true
    setIncoming([])
    setCancelled(by)
    setPhase((p) => (p === 'receiving' || p === 'asking' ? 'idle' : p))
    onBusy?.(false)
    queueRef.current = queueRef.current.then(() => dropCurrent()).catch(() => {})
  }

  const handleMessage = async (data: string | ArrayBuffer) => {
    if (ignoreRef.current) {
      // Si riparte solo con una nuova offerta
      const next = typeof data === 'string' ? parseCtrl(data) : null
      if (next?.t !== 'offer') return
      ignoreRef.current = false
    }
    if (typeof data !== 'string') {
      const current = currentRef.current
      if (!current) return
      if (current.writer) await current.writer.write(data)
      else current.chunks.push(data)
      bytesRef.current += data.byteLength
      fileBytesRef.current += data.byteLength
      return
    }
    const msg = parseCtrl(data)
    if (!msg) return
    if (msg.t === 'offer') {
      const files = (Array.isArray(msg.files) ? msg.files : [])
        .slice(0, 1000)
        .map((f, i) => ({ i, name: safeFileName(f.name, i), size: Math.max(0, Number(f.size) || 0), type: String(f.type ?? '').slice(0, 100) }))
      if (!files.length) return
      incomingRef.current = files
      setIncoming(files)
      setCancelled(null)
      go('asking')
    } else if (msg.t === 'start') {
      const meta = incomingRef.current[msg.i]
      if (!meta) return
      await dropCurrent()
      const dir = dirRef.current
      if (dir) {
        const name = await uniqueName(meta.name)
        const handle = await dir.getFileHandle(name, { create: true })
        const writer = (await handle.createWritable()) as unknown as Writer
        currentRef.current = { meta, name, writer, chunks: [], handle }
      } else {
        currentRef.current = { meta, name: meta.name, writer: null, chunks: [], handle: null }
      }
      fileBytesRef.current = 0
      setProgress((p) => ({ ...p, file: msg.i, fileBytes: 0 }))
    } else if (msg.t === 'end') {
      const current = currentRef.current
      if (!current || current.meta.i !== msg.i) return
      currentRef.current = null
      let url: string | null = null
      let blob: Blob | null = null
      if (current.writer) {
        await current.writer.close()
        // Anteprima solo per le immagini non enormi
        if (current.meta.type.startsWith('image/') && current.meta.size < 25 * 1024 * 1024 && current.handle) {
          url = URL.createObjectURL(await current.handle.getFile())
        }
      } else {
        blob = new Blob(current.chunks, { type: current.meta.type || 'application/octet-stream' })
        url = URL.createObjectURL(blob)
      }
      if (url) urlsRef.current.push(url)
      setReceived((list) => [...list, { key: ++seqRef.current, i: current.meta.i, name: current.name, size: current.meta.size, type: current.meta.type, url, blob, saved: !!current.writer, dir: current.writer ? dirRef.current : null }])
      linkSend(linkRef.current, { t: 'saved', i: msg.i })
    } else if (msg.t === 'done') {
      go('done')
      onDone?.()
    } else if (msg.t === 'cancel') {
      cancelIncoming('peer')
    }
  }
  const handleRef = useRef(handleMessage)
  const cancelRef = useRef(cancelIncoming)
  useEffect(() => {
    handleRef.current = handleMessage
    cancelRef.current = cancelIncoming
  })

  // Tutti i messaggi in fila: le scritture su disco sono asincrone
  useEffect(() => {
    linkRef.current = link
    if (!link) {
      // Collegamento caduto: il file a metà si scarta, quelli arrivati restano
      ignoreRef.current = false
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIncoming([])
      setPhase((p) => (p === 'asking' || p === 'receiving' ? 'idle' : p))
      onBusy?.(false)
      queueRef.current = queueRef.current.then(() => dropCurrent()).catch(() => {})
      return
    }
    link.listen({
      onData: (data) => {
        queueRef.current = queueRef.current
          .then(() => handleRef.current(data))
          .catch((error) => {
            console.error('[hopla] ricezione:', error)
            linkSend(link, { t: 'cancel' })
            cancelRef.current('me')
          })
      },
      onCtrl: (msg: HoplaCtrl) => {
        if (msg.t === 'cancel') cancelRef.current('peer')
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  // Le anteprime si liberano quando si esce dalla pagina
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // Avanzamento 4 volte al secondo
  useEffect(() => {
    if (phase !== 'receiving') return
    const timer = setInterval(() => {
      const seconds = (performance.now() - startRef.current) / 1000
      setProgress((p) => ({ ...p, bytes: bytesRef.current, fileBytes: fileBytesRef.current, speed: seconds > 0.5 ? bytesRef.current / seconds : 0 }))
    }, 250)
    return () => clearInterval(timer)
  }, [phase])

  const totalIncoming = incoming.reduce((sum, f) => sum + f.size, 0)
  const memoryLimit = handheld ? HOPLA_PHONE_MEMORY_WARN : HOPLA_MEMORY_WARN

  const accept = async (withFolder: boolean) => {
    if (withFolder) {
      try {
        const dir = await (window as PickerWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'hopla' })
        dirRef.current = dir
        setFolderName(dir.name)
      } catch {
        return // scelta annullata: si resta sulla domanda
      }
    } else {
      dirRef.current = null
      setFolderName(null)
    }
    bytesRef.current = 0
    startRef.current = performance.now()
    fileBytesRef.current = 0
    setProgress({ bytes: 0, total: totalIncoming, speed: 0, file: 0, fileBytes: 0 })
    go('receiving')
    linkSend(link, { t: 'accept' })
    onStart?.()
  }

  const refuse = () => {
    linkSend(link, { t: 'refuse' })
    setIncoming([])
    go('idle')
  }

  const cancelReceive = () => {
    linkCancel(link)
    cancelIncoming('me')
  }

  const toFile = (item: Received) => new File([item.blob!], item.name, { type: item.type || 'application/octet-stream' })

  // Sul telefono si salva con la condivisione (Foto, File, app); altrove si scarica
  const saveOne = async (item: Received) => {
    if (!item.blob) return
    const file = toFile(item)
    if (handheld && canShareFiles([file])) {
      await navigator.share({ files: [file] }).catch(() => {})
      return
    }
    const a = document.createElement('a')
    a.href = item.url!
    a.download = item.name
    a.click()
  }

  const saveAll = async () => {
    const list = received.filter((r) => r.blob && !r.saved)
    const files = list.map(toFile)
    if (handheld && files.length && canShareFiles(files)) {
      await navigator.share({ files }).catch(() => {})
      return
    }
    for (const item of list) {
      const a = document.createElement('a')
      a.href = item.url!
      a.download = item.name
      a.click()
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  // Cestino: toglie il file dall'elenco; se era stato salvato nella cartella lo cancella anche da lì
  const remove = async (item: Received) => {
    if (item.saved && confirmDelete !== item.key) {
      setConfirmDelete(item.key)
      return
    }
    setConfirmDelete(null)
    if (item.saved && item.dir) await item.dir.removeEntry(item.name).catch(() => {})
    if (item.url) URL.revokeObjectURL(item.url)
    setReceived((list) => list.filter((r) => r.key !== item.key))
  }

  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.bytes / progress.total) * 100)) : 0
  const currentMeta = incoming[progress.file]
  const filePercent = currentMeta?.size ? Math.min(100, Math.round((progress.fileBytes / currentMeta.size) * 100)) : 0
  const SaveIcon = handheld ? Share2 : Download

  return (
    <div className="space-y-5">
      {phase === 'idle' && cancelled && (
        <p className="rounded-2xl bg-[#fff4e5] p-3 text-sm font-semibold text-[#7a4a00]" role="status">
          {cancelled === 'peer' ? t('receiveCancelledByPeer') : t('pcCancelled')}
        </p>
      )}

      {phase === 'asking' && (
        <section className={`${card} space-y-4`} aria-labelledby="hopla-ask">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <Zap className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 id="hopla-ask" className="text-xl font-extrabold text-[var(--ink)]">
                {t('askTitle', { device: peer, count: incoming.length })}
              </h2>
              <p className="text-sm text-[var(--muted)]">{t('askSize', { size: formatBytes(totalIncoming, locale) })}</p>
            </div>
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-[var(--background)] p-3 text-sm text-[var(--ink)]">
            {incoming.slice(0, 50).map((f) => (
              <li key={f.i} className="flex justify-between gap-3">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">{formatBytes(f.size, locale)}</span>
              </li>
            ))}
            {incoming.length > 50 && <li className="text-[var(--muted)]">{t('andMore', { count: incoming.length - 50 })}</li>}
          </ul>
          {!folderSupported && totalIncoming > memoryLimit && <p className="rounded-2xl bg-[#fff4e5] p-3 text-sm text-[#7a4a00]">{handheld ? t('phoneMemoryWarn') : t('memoryWarn')}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {folderSupported ? (
              <>
                <button type="button" onClick={() => accept(true)} className={primary}>
                  <FolderOpen className="h-5 w-5" aria-hidden="true" /> {t('acceptFolder')}
                </button>
                <button type="button" onClick={() => accept(false)} className={secondary}>
                  <Download className="h-5 w-5" aria-hidden="true" /> {t('acceptNoFolder')}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => accept(false)} className={primary}>
                <Check className="h-5 w-5" aria-hidden="true" /> {t('accept')}
              </button>
            )}
            <button type="button" onClick={refuse} className={`${secondary} text-[#a12a2a]`}>
              <X className="h-5 w-5" aria-hidden="true" /> {t('refuse')}
            </button>
          </div>
        </section>
      )}

      {phase === 'receiving' && (
        <section className={`${card} space-y-4`} aria-labelledby="hopla-progress">
          <div className="flex items-end justify-between gap-3">
            <h2 id="hopla-progress" className="flex items-center gap-2 text-xl font-extrabold text-[var(--ink)]">
              <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" aria-hidden="true" /> {t('receiving')}
            </h2>
            <span className="text-4xl font-extrabold tabular-nums text-[var(--ink)]" aria-hidden="true">
              {percent}%
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--background)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('receiving')}>
            <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
          <p className="flex flex-wrap justify-between gap-2 text-sm tabular-nums text-[var(--muted)]">
            <span>{t('progress', { done: formatBytes(progress.bytes, locale), total: formatBytes(progress.total, locale) })}</span>
            <span>
              {t('fileOf', { n: Math.min(progress.file + 1, incoming.length), count: incoming.length })}
              {progress.speed > 0 ? ` · ${t('speed', { speed: formatBytes(progress.speed, locale) })}` : ''}
            </span>
          </p>
          {currentMeta && (
            <div className="space-y-1.5 rounded-2xl bg-[var(--background)] p-3">
              <p className="flex justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-[var(--ink)]">{currentMeta.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-[var(--ink)]">{filePercent}%</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={filePercent} aria-label={currentMeta.name}>
                <div className="h-full rounded-full bg-[var(--ink)] transition-[width] duration-200" style={{ width: `${filePercent}%` }} />
              </div>
            </div>
          )}
          {route === 'internet' && progress.speed > 0 && progress.speed < 300 * 1024 && progress.bytes > 2 * 1024 * 1024 && <p className="rounded-2xl bg-[#fff4e5] p-3 text-sm text-[#7a4a00]">{t('slowTip')}</p>}
          {folderName && <p className="text-sm text-[var(--muted)]">{t('savingIn', { folder: folderName })}</p>}
          <button type="button" onClick={cancelReceive} className={`${secondary} text-[#a12a2a]`}>
            <X className="h-5 w-5" aria-hidden="true" /> {t('cancelReceive')}
          </button>
        </section>
      )}

      {received.length > 0 && (
        <section className={`${card} space-y-4`} aria-labelledby="hopla-received">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="hopla-received" className="text-xl font-extrabold text-[var(--ink)]">
                {phase === 'done' ? t('doneTitle', { count: received.length }) : t('receivedTitle', { count: received.length })}
              </h2>
              {folderName && received.some((r) => r.saved) && <p className="text-sm text-[var(--muted)]">{t('savedIn', { folder: folderName })}</p>}
              {handheld && received.some((r) => !r.saved) && <p className="text-sm text-[var(--muted)]">{t('saveHint')}</p>}
            </div>
            {received.some((r) => !r.saved) && (
              <button type="button" onClick={saveAll} className={primary}>
                <SaveIcon className="h-5 w-5" aria-hidden="true" /> {handheld ? t('saveAll') : t('downloadAll')}
              </button>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {received.map((item) => (
              <li key={item.key} className="overflow-hidden rounded-2xl border border-[var(--gold)]/20 bg-[var(--background)]">
                <div className="flex aspect-square items-center justify-center bg-white">
                  {item.url && item.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : item.type.startsWith('video/') ? (
                    <FileVideo className="h-10 w-10 text-[var(--gold)]" aria-hidden="true" />
                  ) : (
                    <FileIcon className="h-10 w-10 text-[var(--gold)]" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-1 p-2.5">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]" title={item.name}>
                    {item.name}
                  </p>
                  <p className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span className="tabular-nums">{formatBytes(item.size, locale)}</span>
                    {item.saved ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[#1d6b34]">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t('saved')}
                      </span>
                    ) : null}
                  </p>
                  {confirmDelete === item.key ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="font-semibold text-[#a12a2a]">{t('deleteConfirm')}</span>
                      <button type="button" onClick={() => remove(item)} className="min-h-8 rounded-full bg-[#a12a2a] px-3 font-bold text-white">
                        {t('deleteYes')}
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="min-h-8 rounded-full border border-[var(--gold)]/40 px-3 font-bold text-[var(--ink)]">
                        {t('deleteNo')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {item.blob && !item.saved ? (
                        <button type="button" onClick={() => saveOne(item)} className="inline-flex min-h-9 items-center gap-1 text-xs font-bold text-[#7a5a14] hover:underline">
                          <SaveIcon className="h-4 w-4" aria-hidden="true" /> {handheld ? t('saveFile') : t('download')}
                        </button>
                      ) : (
                        <span />
                      )}
                      <button type="button" onClick={() => remove(item)} className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[#fdf2f2] hover:text-[#a12a2a]" aria-label={t('deleteAria', { name: item.name })} title={t('delete')}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {phase === 'done' && link && <p className="text-sm text-[var(--muted)]">{t('sendMore')}</p>}
        </section>
      )}
    </div>
  )
}
