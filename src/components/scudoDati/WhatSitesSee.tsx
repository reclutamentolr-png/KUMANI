'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Eye, Globe, Languages, LoaderCircle, MapPin, Monitor, Smartphone } from 'lucide-react'

// «Cosa vede un sito di te»: i dati che un link spia (IP logger) raccoglie da
// chi lo apre, mostrati solo alla persona stessa. IP e zona arrivano da
// /api/whoami (nessun salvataggio); dispositivo, browser, lingua e fuso orario
// si leggono qui nel browser.

type NetInfo = { ip: string | null; city: string | null; region: string | null; country: string | null }
type Row = { icon: typeof Eye; label: string; value: string }

function deviceOf(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'Android (smartphone)' : 'Android (tablet)'
  if (/Windows/i.test(ua)) return 'Windows'
  if (/Mac OS X|Macintosh/i.test(ua)) return 'Mac'
  if (/Linux/i.test(ua)) return 'Linux'
  return '—'
}

function browserOf(ua: string): string {
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet'
  if (/Edg\//i.test(ua)) return 'Microsoft Edge'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Firefox|FxiOS/i.test(ua)) return 'Firefox'
  if (/CriOS|Chrome/i.test(ua)) return 'Chrome'
  if (/Safari/i.test(ua)) return 'Safari'
  return '—'
}

export default function WhatSitesSee() {
  const t = useTranslations('scudoDati')
  const locale = useLocale()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)

  const show = async () => {
    setBusy(true)
    let net: NetInfo = { ip: null, city: null, region: null, country: null }
    try {
      const res = await fetch('/api/whoami', { cache: 'no-store' })
      if (res.ok) net = (await res.json()) as NetInfo
    } catch {}
    const ua = navigator.userAgent
    const country = net.country ? (new Intl.DisplayNames([locale], { type: 'region' }).of(net.country) ?? net.country) : null
    const place = [net.city, net.region, country].filter(Boolean).join(', ')
    const mobile = /Android|iPhone|iPad|Mobile/i.test(ua)
    setRows([
      { icon: Globe, label: t('seeIp'), value: net.ip ?? t('seeUnknown') },
      { icon: MapPin, label: t('seePlace'), value: place || t('seeUnknown') },
      { icon: mobile ? Smartphone : Monitor, label: t('seeDevice'), value: `${deviceOf(ua)} · ${browserOf(ua)} · ${window.screen.width}×${window.screen.height}` },
      { icon: Languages, label: t('seeLanguage'), value: `${navigator.language} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}` },
    ])
    setBusy(false)
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <Eye className="h-5 w-5 text-[var(--gold)]" /> {t('seeTitle')}
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{t('seeIntro')}</p>
      {!rows ? (
        <button
          type="button"
          onClick={show}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4 text-[var(--gold-bright)]" />} {t('seeButton')}
        </button>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
            {rows.map((row) => (
              <li key={row.label} className="flex items-start gap-3 px-4 py-3 text-sm">
                <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                <span className="w-32 shrink-0 font-semibold text-[var(--ink)] sm:w-40">{row.label}</span>
                <span className="min-w-0 break-words text-gray-700">{row.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-[var(--gold-pale)]/60 px-3 py-2 text-xs leading-5 text-gray-700">{t('seeExplain')}</p>
        </>
      )}
      <p className="mt-3 text-xs text-[var(--muted)]">{t('seePrivacy')}</p>
    </section>
  )
}
