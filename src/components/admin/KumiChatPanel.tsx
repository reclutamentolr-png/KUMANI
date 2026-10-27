'use client'

import { useCallback, useEffect, useState } from 'react'
import { BookOpen, GraduationCap, LoaderCircle, MessagesSquare, RefreshCw, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react'
import {
  adminKumiClearCache,
  adminKumiData,
  adminKumiForget,
  adminKumiSaveSettings,
  adminKumiTeach,
  type KumiAdminData,
  type KumiMode,
  type KumiQuestionRow,
} from '@/app/actions/kumiChat'

// Admin → Chiedi a KUMI: accensione e limiti, chi sta scrivendo (visitatori
// anonimi), le domande più comuni e quelle senza risposta, con «Insegna a
// KUMI» per aggiungere la risposta giusta.

const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const SOURCE: Record<string, string> = { ai: 'IA', cache: 'già data', staff: 'insegnata', none: 'non sapeva', limit: 'domande finite' }
const FLAG = (cc: string | null) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌍')
const TABS = [
  { id: 'conversations', label: 'Conversazioni' },
  { id: 'top', label: 'Domande più comuni' },
  { id: 'todo', label: 'Da migliorare' },
  { id: 'knowledge', label: 'Cosa ha imparato KUMI' },
] as const

export default function KumiChatPanel() {
  const [data, setData] = useState<KumiAdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('conversations')
  const [mode, setMode] = useState<KumiMode>('staff')
  const [visitorDaily, setVisitorDaily] = useState(10)
  const [totalDaily, setTotalDaily] = useState(300)
  const [saved, setSaved] = useState<string | null>(null)
  const [teach, setTeach] = useState<{ question: string; answer: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminKumiData()
    setData(r)
    setMode(r.settings.mode)
    setVisitorDaily(r.settings.visitorDaily)
    setTotalDaily(r.settings.totalDaily)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dal server all'apertura
    load()
  }, [load])

  const save = async () => {
    const r = await adminKumiSaveSettings({ mode, visitorDaily, totalDaily })
    setSaved(r.ok ? 'Salvato' : `Errore: ${r.error}`)
  }

  const saveTeach = async () => {
    if (!teach) return
    const r = await adminKumiTeach(teach.question, teach.answer, null)
    if (!r.ok) return setSaved(`Errore: ${r.error}`)
    setTeach(null)
    setSaved('KUMI ha imparato la risposta')
    load()
  }

  if (loading && !data)
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
      </p>
    )
  if (!data) return null
  if (data.error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Errore: {data.error}</p>

  const { stats } = data
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
  const todo = data.questions.filter((q) => q.source !== 'limit' && (!q.answered || q.rating === -1))

  const questionLine = (q: KumiQuestionRow) => (
    <li key={q.id} className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>{when(q.created_at)}</span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-semibold uppercase">{q.locale ?? '—'}</span>
        <span className={`rounded px-1.5 py-0.5 font-semibold ${q.answered ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>{SOURCE[q.source] ?? q.source}</span>
        {q.rating === 1 && <ThumbsUp className="h-3.5 w-3.5 text-green-600" />}
        {q.rating === -1 && <ThumbsDown className="h-3.5 w-3.5 text-red-600" />}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-gray-900">{q.question}</p>
      {q.answer && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{q.answer}</p>}
      {q.source !== 'limit' && (
        <button type="button" onClick={() => setTeach({ question: q.question, answer: q.answer ?? '' })} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] hover:underline">
          <GraduationCap className="h-3.5 w-3.5" /> Insegna a KUMI
        </button>
      )}
    </li>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <MessagesSquare className="h-5 w-5 text-[var(--gold)]" /> Chiedi a KUMI
          </h2>
          <p className="text-sm text-gray-600">
            La chat della home per chi visita KUMANI la prima volta (gli iscritti non la vedono). KUMI risponde solo con i testi di KUMANI; quando non sa, propone di scrivere allo Staff. Ultimi 30 giorni.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Aggiorna
        </button>
      </div>

      {/* Impostazioni */}
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[1.3fr_1fr_1fr_auto] sm:items-end">
        <label className="block text-xs font-semibold text-gray-600">
          Stato
          <select value={mode} onChange={(e) => setMode(e.target.value as KumiMode)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="off">Spenta</option>
            <option value="staff">Solo Staff (prova)</option>
            <option value="on">Accesa per i visitatori</option>
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Domande al giorno per visitatore
          <input type="number" min={1} max={100} value={visitorDaily} onChange={(e) => setVisitorDaily(Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Risposte con l’IA al giorno (tutti)
          <input type="number" min={0} value={totalDaily} onChange={(e) => setTotalDaily(Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <button type="button" onClick={save} className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)]">
          Salva
        </button>
        <p className="text-xs text-gray-500 sm:col-span-4">
          Oggi l’IA ha risposto {stats.aiToday} volte. Una risposta con l’IA costa circa 0,1 centesimi; le risposte già date e quelle insegnate sono gratis.{' '}
          <button
            type="button"
            onClick={async () => {
              await adminKumiClearCache()
              setSaved('Risposte ricordate svuotate')
            }}
            className="font-semibold text-[var(--gold)] hover:underline"
          >
            Svuota le risposte ricordate
          </button>{' '}
          (dopo aver cambiato prezzi o servizi).
        </p>
        {saved && <p className="text-xs font-semibold text-green-700 sm:col-span-4">{saved}</p>}
      </div>

      {/* Numeri */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Scrivono adesso', stats.liveNow, 'ultimi 15 minuti'],
          ['Visitatori', stats.visitors, '30 giorni'],
          ['Domande', stats.total, `${stats.limit} oltre il limite`],
          ['Con risposta', `${pct(stats.answered, stats.total)}%`, `${stats.answered} su ${stats.total}`],
          ['Utili', `${stats.up} 👍 · ${stats.down} 👎`, stats.up + stats.down ? `${pct(stats.up, stats.up + stats.down)}% utili` : 'nessun voto'],
        ].map(([label, value, hint]) => (
          <div key={label as string} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{hint}</p>
          </div>
        ))}
      </div>

      {/* Insegna a KUMI */}
      {teach && (
        <div className="rounded-xl border-2 border-[var(--gold)] bg-[var(--gold-pale)] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <GraduationCap className="h-4 w-4" /> Insegna a KUMI
          </p>
          <label className="mt-3 block text-xs font-semibold text-gray-700">
            Domanda
            <input value={teach.question} onChange={(e) => setTeach({ ...teach, question: e.target.value })} maxLength={300} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="mt-3 block text-xs font-semibold text-gray-700">
            Risposta giusta (breve, in italiano: KUMI la traduce per le altre lingue)
            <textarea value={teach.answer} onChange={(e) => setTeach({ ...teach, answer: e.target.value })} maxLength={1500} rows={4} className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={saveTeach} className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)]">
              Salva la risposta
            </button>
            <button type="button" onClick={() => setTeach(null)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700">
              Annulla
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === x.id ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'border border-gray-300 bg-white text-gray-700'}`}
          >
            {x.label}
            {x.id === 'todo' && todo.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">{todo.length}</span>}
          </button>
        ))}
        <button type="button" onClick={() => setTeach({ question: '', answer: '' })} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)] bg-white px-4 py-2 text-sm font-semibold text-gray-900">
          <BookOpen className="h-4 w-4" /> Nuova risposta
        </button>
      </div>

      {tab === 'conversations' &&
        (data.conversations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Ancora nessuna conversazione.</p>
        ) : (
          <div className="space-y-3">
            {data.conversations.slice(0, 60).map((c) => (
              <details key={c.tag} className="rounded-xl border border-gray-200 bg-white p-3">
                <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                  <span className="text-lg">{FLAG(c.country)}</span>
                  <span className="font-bold text-gray-900">Visitatore {c.tag.slice(0, 4).toUpperCase()}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-gray-600">{c.locale ?? '—'}</span>
                  <span className="text-xs text-gray-500">
                    {c.questions.length} {c.questions.length === 1 ? 'domanda' : 'domande'} · {when(c.last)}
                  </span>
                  {c.live && <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-bold text-white">sta scrivendo</span>}
                  <span className="w-full truncate text-xs text-gray-600 sm:w-auto sm:flex-1">«{c.questions[0]?.question}»</span>
                </summary>
                <ul className="mt-3 space-y-2">{c.questions.map(questionLine)}</ul>
              </details>
            ))}
          </div>
        ))}

      {tab === 'top' &&
        (data.top.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Ancora nessuna domanda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Domanda</th>
                  <th className="px-3 py-2 text-right">Volte</th>
                  <th className="px-3 py-2 text-right">Con risposta</th>
                  <th className="px-3 py-2 text-right">👎</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.top.map((r) => (
                  <tr key={r.question}>
                    <td className="px-3 py-2 text-gray-900">{r.question}</td>
                    <td className="px-3 py-2 text-right font-bold">{r.count}</td>
                    <td className={`px-3 py-2 text-right ${r.answered < r.count ? 'font-semibold text-amber-700' : 'text-gray-600'}`}>{pct(r.answered, r.count)}%</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.down || ''}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setTeach({ question: r.question, answer: '' })} className="text-xs font-semibold text-[var(--gold)] hover:underline">
                        Insegna
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'todo' &&
        (todo.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Niente da migliorare: KUMI ha risposto a tutto e nessuno ha messo 👎.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">Domande a cui KUMI non ha saputo rispondere o con 👎: insegna la risposta giusta e da quel momento KUMI la sa.</p>
            <ul className="space-y-2">{todo.slice(0, 100).map(questionLine)}</ul>
          </>
        ))}

      {tab === 'knowledge' &&
        (data.knowledge.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Ancora nessuna risposta insegnata: KUMI usa solo i testi del sito.</p>
        ) : (
          <ul className="space-y-2">
            {data.knowledge.map((k) => (
              <li key={k.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{k.question}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{k.answer}</p>
                    <p className="mt-1 text-xs text-gray-400">{when(k.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await adminKumiForget(k.id)
                      load()
                    }}
                    aria-label="Elimina"
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
