'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Clapperboard, ExternalLink, LoaderCircle, Search } from 'lucide-react'
import { adminGetServiceVideos, adminSaveServiceVideos, type ShareStats } from '@/app/actions/adminServiceVideos'
import { getShareableTools } from '@/lib/shareableTools'
import { homeVideoCover, youtubeId } from '@/lib/homeVideoShared'
import { notify } from '@/lib/adminNotify'

// Admin → Video dei servizi: il video ufficiale (YouTube) di ogni servizio.
// Con il video, dentro il servizio compare «Invia il video»: il Kumano manda
// un link corto kumani.io/v/CODICE con il video e il suo invito. Sotto, quante
// volte sono stati aperti quei link.
export default function ServiceVideosPanel() {
  const tm = useTranslations('marketplace')
  const tools = useMemo(() => getShareableTools(tm).sort((a, b) => a.title.localeCompare(b.title, 'it')), [tm])
  const [links, setLinks] = useState<Record<string, string> | null>(null)
  const [stats, setStats] = useState<ShareStats | null>(null)
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    adminGetServiceVideos().then((result) => {
      if ('error' in result) return notify('Errore: ' + result.error)
      setLinks(Object.fromEntries(Object.entries(result.videos).map(([tool, id]) => [tool, `https://youtu.be/${id}`])))
      setStats(result.stats)
    })
  }, [])

  if (!links || !stats) return <p className="text-sm text-gray-500">Caricamento…</p>

  const save = async () => {
    setSaving(true)
    const result = await adminSaveServiceVideos(links)
    setSaving(false)
    if (!result.success) return notify('Errore: ' + result.error)
    setLinks(Object.fromEntries(Object.entries(result.videos).map(([tool, id]) => [tool, `https://youtu.be/${id}`])))
    notify(`Video salvati: ${Object.keys(result.videos).length} servizi con il video.`, 'success')
  }

  const q = query.trim().toLowerCase()
  const shown = tools.filter((tool) => !q || tool.title.toLowerCase().includes(q) || tool.toolName.includes(q))
  const withVideo = tools.filter((tool) => links[tool.toolName]?.trim()).length
  // I link d'invito corti (kumani.io/i/…) stanno nella stessa tabella: contati a parte
  const videoStats = Object.entries(stats.byTool).filter(([tool]) => tool !== 'invito').map(([, s]) => s)
  const totalOpens = videoStats.reduce((sum, s) => sum + s.opens, 0)
  const totalLinks = videoStats.reduce((sum, s) => sum + s.links, 0)
  const invites = stats.byTool.invito ?? { links: 0, opens: 0 }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Clapperboard className="h-7 w-7 text-red-600" /> Video dei servizi
        </h2>
        <p className="mt-1 text-gray-600">
          Il link di YouTube del video ufficiale di ogni servizio (anche uno Short). Con il video, dentro il servizio il pulsante «Condividi»
          offre «Invia il video»: il Kumano manda un messaggio già scritto con un link corto (kumani.io/v/…) che apre il video, dice chi lo
          consiglia e porta all&apos;iscrizione con il suo invito. I video restano su YouTube: su KUMANI non si carica nulla.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Servizi con il video', value: `${withVideo} / ${tools.length}` },
          { label: 'Link dei video creati', value: totalLinks },
          { label: 'Aperture dei video', value: totalOpens },
          { label: 'Inviti corti aperti', value: `${invites.opens} (${invites.links} link)` },
        ].map((box) => (
          <div key={box.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{box.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{box.value}</p>
          </div>
        ))}
      </div>

      {stats.top.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">Chi fa aprire più link (video e inviti)</h3>
          <ol className="mt-3 divide-y divide-gray-100 text-sm">
            {stats.top.map((person, i) => (
              <li key={`${person.name}-${i}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="font-semibold text-gray-900">
                    {i + 1}. {person.name}
                  </span>
                  {person.email && <span className="ml-2 text-gray-500">{person.email}</span>}
                </span>
                <span className="shrink-0 text-gray-600">
                  {person.opens} aperture · {person.links} link
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca un servizio"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--ink-soft)] disabled:bg-gray-400"
          >
            {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Salva
          </button>
        </div>
        <ul className="mt-4 divide-y divide-gray-100">
          {shown.map((tool) => {
            const value = links[tool.toolName] ?? ''
            const id = value.trim() ? youtubeId(value) : null
            const s = stats.byTool[tool.toolName]
            return (
              <li key={tool.toolName} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-center gap-3 sm:w-64">
                  <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
                    {id && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={homeVideoCover(id)} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900">{tool.title}</span>
                    <span className="block text-xs text-gray-500">{s ? `${s.links} link · ${s.opens} aperture` : 'Nessun link ancora'}</span>
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <input
                    value={value}
                    onChange={(e) => setLinks({ ...links, [tool.toolName]: e.target.value })}
                    placeholder="https://youtu.be/… oppure https://youtube.com/shorts/…"
                    className={`min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)] ${value.trim() && !id ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {id && (
                    <a href={`https://youtu.be/${id}`} target="_blank" rel="noopener noreferrer" aria-label="Apri su YouTube" className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
