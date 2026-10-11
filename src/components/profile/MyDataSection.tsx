'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Database, Download, LoaderCircle, Trash2 } from 'lucide-react'
import { deleteMyData, exportMyData, listMyData, type MyDataSummary } from '@/app/actions/myData'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { askConfirm } from '@/lib/confirm'

// «I miei dati nei servizi»: per ogni servizio con dati salvati, quante voci
// ci sono, «Scarica» (copia in un file) e «Cancella tutto». Funziona anche
// senza piano attivo: i dati restano sempre di chi li ha creati.
export default function MyDataSection({ isOpen }: { isOpen: boolean }) {
  const t = useTranslations('myData')
  const tm = useTranslations('marketplace')
  const [items, setItems] = useState<MyDataSummary[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    listMyData()
      .then((list) => {
        if (!cancelled) setItems(list)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, reload])

  const tools = getMarketplaceTools((key) => tm(key))
  const nameOf = (tool: string) => tools.find((x) => x.toolName === tool)?.title ?? tool

  const download = async (item: MyDataSummary) => {
    setBusy(item.key)
    setError(null)
    try {
      const result = await exportMyData(item.key)
      if (!result.success) return setError(t('error'))
      const blob = new Blob([JSON.stringify({ service: nameOf(item.tool), exportedAt: new Date().toISOString(), data: result.data }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `kumani-${item.key}-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      setError(t('error'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async (item: MyDataSummary) => {
    if (!(await askConfirm(t('deleteConfirm', { service: nameOf(item.tool), count: item.count })))) return
    setBusy(item.key)
    setError(null)
    try {
      const result = await deleteMyData(item.key)
      if (!result.success) setError(t('error'))
      setReload((n) => n + 1)
    } catch {
      setError(t('error'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
        <Database className="h-4 w-4 text-[var(--gold)]" /> {t('title')}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{t('intro')}</p>
      {items === null ? (
        <LoaderCircle className="mt-3 h-5 w-5 animate-spin text-gray-400" />
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
          {items.map((item) => (
            <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <span className="min-w-0 text-sm">
                <span className="font-semibold text-[var(--ink)]">{nameOf(item.tool)}</span>{' '}
                <span className="text-gray-500">· {t('count', { count: item.count })}</span>
              </span>
              <span className="flex items-center gap-1.5">
                {busy === item.key && <LoaderCircle className="h-4 w-4 animate-spin text-gray-400" />}
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => download(item)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-gray-200 px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" /> {t('download')}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => remove(item)}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 px-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t('delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-gray-500">{t('note')}</p>
    </div>
  )
}
