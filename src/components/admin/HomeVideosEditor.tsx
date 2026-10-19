'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, EyeOff, Plus, Trash2, Video } from 'lucide-react'
import { adminGetHomeVideos, adminSaveHomeVideos } from '@/app/actions/admin'
import { DEFAULT_HOME_VIDEO, HOME_VIDEOS_MAX, homeVideoCover, youtubeId } from '@/lib/homeVideoShared'
import { notify } from '@/lib/adminNotify'

type Row = { key: number; url: string; title: string; accent: string; text: string }

let nextKey = 1
const toRow = (video: { id: string; title: string; accent: string; text: string }): Row => ({
  key: nextKey++,
  url: `https://youtu.be/${video.id}`,
  title: video.title,
  accent: video.accent,
  text: video.text,
})

// Admin → Aspetto homepage → Video: l'elenco dei video di YouTube pronti
// (titolo, parte in oro, frase) e quello in vetrina sulla homepage. Cambiare
// video = scegliere «In vetrina» e salvare. Il primo, il tormentone, senza
// titolo usa i testi tradotti in tutte le lingue.
export default function HomeVideosEditor() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [active, setActive] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminGetHomeVideos().then((result) => {
      setRows(result.videos.map(toRow))
      setActive(result.active ?? '')
    })
  }, [])

  const update = (key: number, patch: Partial<Row>) => setRows((list) => (list ?? []).map((row) => (row.key === key ? { ...row, ...patch } : row)))

  const save = async () => {
    if (!rows) return
    setSaving(true)
    const result = await adminSaveHomeVideos({ videos: rows, active })
    setSaving(false)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    setRows((result.videos ?? []).map(toRow))
    setActive(result.active ?? '')
    notify(result.active ? 'Video salvati: la homepage mostra quello in vetrina.' : 'Video salvati: riquadro nascosto dalla homepage.', 'success')
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-gray-900">
        <Video className="h-5 w-5 text-red-600" /> Video della homepage
      </div>
      <p className="mt-1 text-sm text-gray-600">
        I video di YouTube (pubblici) pronti da mostrare nella sezione della community. Quello «In vetrina» è sulla homepage: per cambiarlo
        scegline un altro e premi Salva. Il video resta su YouTube e si carica solo quando qualcuno preme play. Titolo e frase sono in
        italiano per tutte le lingue; il tormentone senza titolo usa i testi già tradotti.
      </p>

      {rows === null ? (
        <p className="mt-4 text-sm text-gray-500">Caricamento…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => {
            const id = youtubeId(row.url)
            const isActive = !!id && id === active
            return (
              <div key={row.key} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row ${isActive ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-200'}`}>
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-44">
                  {id && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={homeVideoCover(id)} alt="" className="h-full w-full object-cover" />
                  )}
                  {isActive && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" /> In vetrina
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={row.url}
                    onChange={(e) => update(row.key, { url: e.target.value })}
                    placeholder="https://youtu.be/…"
                    className={`w-full rounded-lg border px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)] ${row.url && !id ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={row.title}
                      onChange={(e) => update(row.key, { title: e.target.value })}
                      maxLength={80}
                      placeholder={id === DEFAULT_HOME_VIDEO ? 'Titolo (vuoto = «Dammi una mano» tradotto)' : 'Titolo, es. Con KUMANI'}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                    />
                    <input
                      value={row.accent}
                      onChange={(e) => update(row.key, { accent: e.target.value })}
                      maxLength={40}
                      placeholder="Parte in oro, es. tutto torna"
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                    />
                  </div>
                  <input
                    value={row.text}
                    onChange={(e) => update(row.key, { text: e.target.value })}
                    maxLength={240}
                    placeholder="Frase sotto il titolo (facoltativa)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => id && setActive(id)}
                      disabled={!id || isActive}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> {isActive ? 'In vetrina' : 'Metti in vetrina'}
                    </button>
                    {id && (
                      <a
                        href={`https://youtu.be/${id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Apri
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRows((list) => (list ?? []).filter((r) => r.key !== row.key))
                        if (isActive) setActive('')
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Togli
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => setRows((list) => [...(list ?? []), { key: nextKey++, url: '', title: '', accent: '', text: '' }])}
              disabled={rows.length >= HOME_VIDEOS_MAX}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Aggiungi video
            </button>
            <button
              type="button"
              onClick={() => setActive('')}
              disabled={!active}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              <EyeOff className="h-4 w-4" /> Nessun video in homepage
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="ml-auto rounded-lg bg-[var(--ink)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--ink-soft)] disabled:bg-gray-400"
            >
              {saving ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
