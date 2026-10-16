'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { FileDown, LoaderCircle } from 'lucide-react'
import { scamLookup, type ScamMatch } from '@/app/actions/scamNet'
import { loadInterFontBase64 } from '@/lib/pdfHelpers'

// Dossier del controllo (SVAT, CheckMail, Verifica IBAN, «Chi mi ha
// chiamato?»): PDF fatto nel browser con data e ora, cosa è stato
// controllato, esito, controlli eseguiti, segnalazioni della community e cosa
// fare, da allegare a una denuncia alla Polizia Postale o da mandare alla banca.

export type DossierStatus = 'ok' | 'warning' | 'risk' | 'info'
export type Dossier = {
  // Nome del controllo (es. «SVAT – Verifica sito»)
  tool: string
  // Cosa è stato controllato (indirizzo, mittente, IBAN, numero) ed eventuali righe in più
  subject: string
  subjectLines?: string[]
  verdict: { status: DossierStatus; text: string; score?: string }
  rows: { label: string; value?: string; status: DossierStatus }[]
  advice?: string[]
}

type Rgb = [number, number, number]
const INK: Rgb = [23, 23, 23]
const GOLD: Rgb = [199, 161, 90]
const MUTED: Rgb = [110, 110, 110]
const COLOR: Record<DossierStatus, Rgb> = { ok: [21, 128, 61], warning: [180, 120, 0], risk: [185, 28, 28], info: [90, 90, 90] }

export default function DossierButton({
  build,
  community,
  match,
  className = '',
}: {
  build: () => Dossier
  // Dati da cercare tra le segnalazioni confermate della community
  community?: { kind: string; value: string }[]
  // Esito della community già noto (es. «Chi mi ha chiamato?»)
  match?: ScamMatch | null
  className?: string
}) {
  const t = useTranslations('dossier')
  const ts = useTranslations('scamNet')
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const d = build()
      const [{ jsPDF }, font, matches] = await Promise.all([
        import('jspdf'),
        loadInterFontBase64(),
        match !== undefined ? Promise.resolve(match ? [match] : []) : community?.length ? scamLookup(community).catch(() => [] as ScamMatch[]) : Promise.resolve([] as ScamMatch[]),
      ])
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      doc.addFileToVFS('Inter-Regular.ttf', font)
      doc.addFont('Inter-Regular.ttf', 'Inter', 'normal')
      doc.setFont('Inter')
      const now = new Date()
      const when = `${now.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })} ${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`
      // Codice del dossier: data e ora + 4 caratteri, per citarlo in una segnalazione
      const code = `KD-${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

      const W = 210
      const M = 16
      const maxW = W - 2 * M
      let y = 0
      const ensure = (space: number) => {
        if (y + space > 282) {
          doc.addPage()
          y = 18
        }
      }
      const para = (s: string, size: number, color: Rgb = INK, x = M, width = maxW) => {
        doc.setFontSize(size)
        doc.setTextColor(...color)
        const lines = doc.splitTextToSize(s, width) as string[]
        for (const line of lines) {
          ensure(size * 0.5)
          doc.text(line, x, y)
          y += size * 0.45
        }
      }
      const section = (title: string) => {
        y += 6
        ensure(16)
        doc.setFontSize(9)
        doc.setTextColor(...GOLD)
        doc.text(title.toUpperCase(), M, y)
        doc.setDrawColor(...GOLD)
        doc.line(M, y + 1.5, W - M, y + 1.5)
        y += 7
      }

      // Intestazione
      doc.setFillColor(...INK)
      doc.rect(0, 0, W, 32, 'F')
      doc.setFontSize(18)
      doc.setTextColor(255, 255, 255)
      doc.text(t('title'), M, 14)
      doc.setFontSize(10)
      doc.setTextColor(...GOLD)
      doc.text(`${d.tool} · KUMANI`, M, 21)
      doc.setTextColor(200, 200, 200)
      doc.text(t('generated', { date: when, code }), M, 27)
      y = 42

      section(t('subject'))
      para(d.subject, 12)
      for (const line of d.subjectLines ?? []) para(line, 9, MUTED)

      section(t('result'))
      doc.setFillColor(...COLOR[d.verdict.status])
      doc.roundedRect(M, y - 4.5, 3, 6, 1, 1, 'F')
      para(`${d.verdict.text}${d.verdict.score ? ` · ${d.verdict.score}` : ''}`, 12, COLOR[d.verdict.status], M + 6, maxW - 6)

      if (d.rows.length) {
        section(t('checks'))
        for (const r of d.rows) {
          ensure(10)
          doc.setFillColor(...COLOR[r.status])
          doc.circle(M + 1.5, y - 1.2, 1.2, 'F')
          para(r.label, 10, INK, M + 5, maxW - 5)
          if (r.value) para(r.value, 9, MUTED, M + 5, maxW - 5)
          y += 1.5
        }
      }

      section(t('community'))
      if (!matches.length) para(t('noCommunity'), 10, MUTED)
      for (const m of matches) {
        para(t('communityMatch', { value: m.value, n: m.reports, category: m.category ? ts(`categories.${m.category}`) : '—' }), 10, COLOR.risk)
        para(t('communityLast', { date: new Date(m.lastReportAt).toLocaleDateString(locale) }), 9, MUTED)
        for (const q of m.quotes.slice(0, 3)) para(`«${q.text.slice(0, 300)}»${q.city ? ` — ${q.city}` : ''}`, 9, MUTED, M + 4, maxW - 4)
        y += 2
      }

      section(t('advice'))
      for (const a of [...(d.advice ?? []), t(`advice_${d.verdict.status}`)]) para(`• ${a}`, 10)

      section(t('useTitle'))
      para(t('useText'), 9.5)

      y += 4
      para(t('disclaimer'), 8, MUTED)

      // Piè di pagina su ogni pagina
      const pages = doc.getNumberOfPages()
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(...MUTED)
        doc.text(`${code} · kumani.io/controlla · ${i}/${pages}`, W / 2, 290, { align: 'center' })
      }
      doc.save(`${t('file')}-${code}.pdf`)
    } catch {
      setError(t('error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[var(--gold)] bg-white px-4 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold)]/10 disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} {t('button')}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-amber-800">{error}</p>}
    </div>
  )
}
