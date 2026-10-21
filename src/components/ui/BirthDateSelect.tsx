'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

// Data di nascita con tre menu (Giorno · Mese · Anno) invece del calendario:
// su iPhone si aprono come rotelle, su Android come elenco del sistema. Col
// calendario di Android, per arrivare al 1975 si scorrevano decine di anni
// mese per mese. value/onChange in formato AAAA-MM-GG ('' finché manca un pezzo).

const pad = (n: number) => String(n).padStart(2, '0')
const daysIn = (year: number, month: number) => new Date(year || 2000, month, 0).getDate()

function split(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : { y: '', m: '', d: '' }
}

export default function BirthDateSelect({
  value,
  onChange,
  disabled = false,
  invalid = false,
  className = '',
}: {
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  className?: string
}) {
  const locale = useLocale()
  const t = useTranslations('common')
  const [parts, setParts] = useState(() => split(value))
  // Valore cambiato da fuori (profilo caricato, modulo azzerato): si riparte da lì
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    if (value) setParts(split(value))
  }

  const months = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 1))))
  }, [locale])
  const years = useMemo(() => {
    const last = new Date().getFullYear() - 10
    return Array.from({ length: last - 1920 + 1 }, (_, i) => String(last - i))
  }, [])
  const maxDay = parts.m ? daysIn(Number(parts.y), Number(parts.m)) : 31

  const update = (next: { y: string; m: string; d: string }) => {
    // 31 febbraio → 28/29: il giorno si adatta al mese
    if (next.d && next.m && Number(next.d) > daysIn(Number(next.y), Number(next.m))) next = { ...next, d: String(daysIn(Number(next.y), Number(next.m))) }
    setParts(next)
    const full = next.y && next.m && next.d ? `${next.y}-${pad(Number(next.m))}-${pad(Number(next.d))}` : ''
    setPrev(full)
    onChange?.(full)
  }

  const select = `min-w-0 rounded-lg border bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-600 ${
    invalid ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
  }`

  return (
    <div className={`grid grid-cols-[1fr_1.6fr_1.2fr] gap-1.5 ${className}`}>
      <select aria-label={t('day')} value={parts.d} disabled={disabled} onChange={(e) => update({ ...parts, d: e.target.value })} className={select}>
        <option value="">{t('day')}</option>
        {Array.from({ length: maxDay }, (_, i) => (
          <option key={i + 1} value={String(i + 1)}>
            {i + 1}
          </option>
        ))}
      </select>
      <select aria-label={t('month')} value={parts.m} disabled={disabled} onChange={(e) => update({ ...parts, m: e.target.value })} className={select}>
        <option value="">{t('month')}</option>
        {months.map((name, i) => (
          <option key={i + 1} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label={t('year')} value={parts.y} disabled={disabled} onChange={(e) => update({ ...parts, y: e.target.value })} className={select}>
        <option value="">{t('year')}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}
