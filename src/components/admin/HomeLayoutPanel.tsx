'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ExternalLink, LoaderCircle, Palette, Video } from 'lucide-react'
import { adminGetHomeLayout, adminGetHomeVideo, adminSetHomeLayout, adminSetHomeVideo } from '@/app/actions/admin'
import { HOME_LAYOUTS, HOME_LAYOUT_INFO, type HomeLayoutKey } from '@/lib/homeLayouts'
import { notify } from '@/lib/adminNotify'

// Admin → Aspetto homepage: le versioni salvate della homepage (sfondi, foto e
// alternanza chiaro/scuro; testi e contenuti restano gli stessi). Ogni
// layout si può vedere in anteprima prima di attivarlo.
export default function HomeLayoutPanel() {
  const [current, setCurrent] = useState<string | null>(null)
  const [saving, setSaving] = useState<HomeLayoutKey | null>(null)

  // Video della homepage (YouTube): link modificabile, vuoto = nascosto
  const [video, setVideo] = useState<string | null>(null)
  const [savingVideo, setSavingVideo] = useState(false)

  useEffect(() => {
    adminGetHomeLayout().then((result) => setCurrent(result.layout))
    adminGetHomeVideo().then((result) => setVideo(result.url ?? ''))
  }, [])

  const saveVideo = async () => {
    setSavingVideo(true)
    const result = await adminSetHomeVideo(video ?? '')
    setSavingVideo(false)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    setVideo(result.url ?? '')
    notify(result.url ? 'Video della homepage salvato.' : 'Riquadro del video nascosto dalla homepage.', 'success')
  }

  const choose = async (key: HomeLayoutKey) => {
    setSaving(key)
    const result = await adminSetHomeLayout(key)
    setSaving(null)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    setCurrent(key)
    notify(`La homepage ora usa il layout "${HOME_LAYOUT_INFO[key].name}".`, 'success')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Palette className="h-7 w-7" /> Aspetto della homepage
        </h2>
        <p className="mt-1 max-w-3xl text-gray-600">
          Le versioni memorizzate della homepage e la bozza su cui lavoriamo. Quella «In uso» è la Home pubblica; con &quot;Anteprima&quot; vedi una versione in una nuova scheda e con &quot;Usa questo&quot; la rimetti in un attimo.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-gray-900">
          <Video className="h-5 w-5 text-red-600" /> Video della homepage
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Link di un video di YouTube (pubblico), mostrato nella sezione della community. Il video resta su YouTube e si carica solo quando
          qualcuno preme play. Lascia vuoto per nascondere il riquadro.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={video ?? ''}
            onChange={(e) => setVideo(e.target.value)}
            placeholder="https://youtu.be/…"
            disabled={video === null}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
          <button
            type="button"
            onClick={saveVideo}
            disabled={savingVideo || video === null}
            className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--ink-soft)] disabled:bg-gray-400"
          >
            {savingVideo ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </div>

      {current === null ? (
        <p className="text-sm text-gray-500">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {HOME_LAYOUTS.map((key, index) => {
            const active = current === key
            return (
              <div
                key={key}
                className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm ${active ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]' : 'border-gray-200'}`}
              >
                <div className="relative h-56 overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/home-layouts/${key}.webp`} alt={`Anteprima ${HOME_LAYOUT_INFO[key].name}`} className="h-full w-full object-cover object-top" />
                  {active && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow">
                      <CheckCircle2 className="h-3.5 w-3.5" /> In uso
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="font-bold text-gray-900">
                    <span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-xs text-[var(--gold-bright)]">{index + 1}</span>
                    {HOME_LAYOUT_INFO[key].name}
                  </p>
                  <p className="mt-1 flex-1 text-sm text-gray-600">{HOME_LAYOUT_INFO[key].description}</p>
                  <div className="mt-4 flex gap-2">
                    <a
                      href={`/admin/anteprima-home/${key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-4 w-4" /> Anteprima
                    </a>
                    <button
                      type="button"
                      onClick={() => choose(key)}
                      disabled={active || saving !== null}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      {saving === key && <LoaderCircle className="h-4 w-4 animate-spin" />}
                      {active ? 'Attivo' : 'Usa questo'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
