'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FileDown, LoaderCircle } from 'lucide-react'
import { getSharedYear } from '@/app/actions/spendlyShared'
import { loadInterFontBase64 } from '@/lib/pdfHelpers'
import { monthNames } from '@/lib/spendly'
import { summarize } from '@/lib/spendlyShared'

type Rgb = [number, number, number]
const INK: Rgb = [23, 23, 23]
const GOLD: Rgb = [199, 161, 90]
const MUTED: Rgb = [110, 110, 110]
const LIGHT: Rgb = [242, 236, 222]

// «Il resoconto dell'anno»: resoconto dell'anno del gruppo in PDF, fatto nel
// browser (totale, media, mese più costoso, mese per mese, categorie, chi ha
// pagato e la sua quota, le spese più grandi).
export default function SharedYearPdfButton({ groupId, years }: { groupId: string; years: number[] }) {
  const t = useTranslations('spendlyShared')
  const locale = useLocale()
  const [year, setYear] = useState(years[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await getSharedYear(groupId, year)
      if (!res.success || !res.data) throw new Error('data')
      const { expenses, members, name } = res.data
      if (!expenses.length) {
        setError(t('pdfEmpty', { year }))
        return
      }
      const [{ jsPDF }, font] = await Promise.all([import('jspdf'), loadInterFontBase64()])
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      doc.addFileToVFS('Inter-Regular.ttf', font)
      doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
      doc.setFont('Inter')
      const eur = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
      const months = monthNames(locale)
      const summary = summarize(expenses, members)
      const nameOf = new Map(members.map((m) => [m.id, m.name]))

      const perMonth = Array.from({ length: 12 }, () => 0)
      for (const e of expenses) perMonth[Number(e.spent_on.slice(5, 7)) - 1] += Number(e.amount)
      const activeMonths = perMonth.filter((v) => v > 0).length || 1
      const top = perMonth.indexOf(Math.max(...perMonth))
      const biggest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5)

      const W = 210
      const M = 16
      let y = 0
      const text = (s: string, x: number, size: number, color: Rgb = INK, align: 'left' | 'right' | 'center' = 'left') => {
        doc.setFontSize(size)
        doc.setTextColor(...color)
        doc.text(s, x, y, { align })
      }
      // Nuova pagina se la riga non ci sta più
      const ensure = (space: number) => {
        if (y + space > 280) {
          doc.addPage()
          y = 20
        }
      }
      const section = (title: string) => {
        y += 10
        ensure(24)
        text(title.toUpperCase(), M, 9, GOLD)
        doc.setDrawColor(...GOLD)
        doc.line(M, y + 1.5, W - M, y + 1.5)
        y += 8
      }

      // Intestazione
      doc.setFillColor(...INK)
      doc.rect(0, 0, W, 38, 'F')
      y = 16
      text(t('pdfTitle', { year }), M, 20, [255, 255, 255])
      y = 26
      text(name, M, 12, GOLD)
      y = 32
      text(t('pdfMembers', { names: members.map((m) => m.name).join(', ') }), M, 9, [200, 200, 200])

      // Numeri dell'anno
      y = 50
      const kpis: [string, string][] = [
        [t('pdfTotal'), eur(summary.total)],
        [t('pdfAverage'), eur(summary.total / activeMonths)],
        [t('pdfTopMonth'), `${months[top]} · ${eur(perMonth[top])}`],
        [t('pdfCount'), String(expenses.length)],
      ]
      const boxW = (W - 2 * M - 9) / 4
      kpis.forEach(([label, value], i) => {
        const x = M + i * (boxW + 3)
        doc.setFillColor(...LIGHT)
        doc.roundedRect(x, y - 6, boxW, 20, 2, 2, 'F')
        doc.setFontSize(8)
        doc.setTextColor(...MUTED)
        doc.text(label, x + 3, y)
        doc.setFontSize(value.length > 16 ? 9 : 11)
        doc.setTextColor(...INK)
        doc.text(value, x + 3, y + 8, { maxWidth: boxW - 6 })
      })
      y += 16

      // Mese per mese
      section(t('pdfByMonth'))
      ensure(44)
      const maxMonth = Math.max(...perMonth, 1)
      const barW = (W - 2 * M) / 12
      const chartH = 34
      perMonth.forEach((v, i) => {
        const h = (v / maxMonth) * chartH
        const x = M + i * barW
        doc.setFillColor(...(i === top ? GOLD : ([214, 196, 160] as Rgb)))
        doc.rect(x + 2, y + chartH - h, barW - 4, h, 'F')
        doc.setFontSize(7)
        doc.setTextColor(...MUTED)
        doc.text(months[i].slice(0, 3), x + barW / 2, y + chartH + 4, { align: 'center' })
        if (v > 0) doc.text(String(Math.round(v)), x + barW / 2, y + chartH - h - 1.5, { align: 'center' })
      })
      y += chartH + 6

      // Categorie
      section(t('pdfCategories'))
      for (const c of summary.byCategory.slice(0, 8)) {
        ensure(8)
        const pct = summary.total ? c.amount / summary.total : 0
        text(t(`cat_${c.category}`), M, 10)
        text(`${eur(c.amount)} · ${Math.round(pct * 100)}%`, W - M, 10, INK, 'right')
        doc.setFillColor(...LIGHT)
        doc.rect(M, y + 1.5, W - 2 * M, 1.6, 'F')
        doc.setFillColor(...GOLD)
        doc.rect(M, y + 1.5, (W - 2 * M) * pct, 1.6, 'F')
        y += 8
      }

      // Chi ha pagato e quota di ciascuno
      section(t('pdfMembersTitle'))
      text(t('pdfColPaid'), W - M - 60, 8, MUTED, 'right')
      text(t('pdfColShare'), W - M - 30, 8, MUTED, 'right')
      text(t('pdfColDiff'), W - M, 8, MUTED, 'right')
      y += 6
      for (const m of summary.byMember) {
        ensure(7)
        const diff = m.paid - m.share
        text(nameOf.get(m.id) ?? '—', M, 10)
        text(eur(m.paid), W - M - 60, 10, INK, 'right')
        text(eur(m.share), W - M - 30, 10, INK, 'right')
        text(`${diff >= 0 ? '+' : ''}${eur(diff)}`, W - M, 10, diff >= 0 ? [21, 128, 61] : [185, 28, 28], 'right')
        y += 7
      }
      y += 1
      text(t('pdfMembersNote'), M, 8, MUTED)

      // Le spese più grandi
      section(t('pdfBiggest'))
      for (const e of biggest) {
        ensure(7)
        const date = new Date(`${e.spent_on}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
        text(date, M, 10, MUTED)
        text(e.description.length > 60 ? `${e.description.slice(0, 59)}…` : e.description, M + 22, 10)
        text(eur(Number(e.amount)), W - M, 10, INK, 'right')
        y += 7
      }

      // Piè di pagina
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(t('pdfFooter', { date: new Date().toLocaleDateString(locale) }), W / 2, 288, { align: 'center' })

      doc.save(`${t('pdfFile', { year })}.pdf`)
    } catch {
      setError(t('pdfError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label={t('pdfYear')} className="min-h-11 rounded-xl border border-gray-300 px-3">
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button type="button" onClick={download} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 font-bold text-[var(--ink)] disabled:opacity-60">
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {t('pdfButton')}
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-amber-800">{error}</p>}
    </div>
  )
}
