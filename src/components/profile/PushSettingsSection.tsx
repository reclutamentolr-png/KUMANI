'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Bell, BellOff, BellRing, LoaderCircle } from 'lucide-react'
import {
  getPushPreferences,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  setPushPreference,
  type PushPreferences,
} from '@/app/actions/push'
import { enablePush, getPushDeviceStatus } from '@/lib/pushClient'

// Nel profilo: attiva le notifiche push su questo dispositivo e scegli quali
// ricevere. Su iPhone funzionano solo con KUMANI aggiunta alla schermata Home.

const CATEGORIES = ['network', 'expiry', 'events', 'messages', 'staff'] as const

type Status = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

export default function PushSettingsSection() {
  const t = useTranslations('pushSettings')
  const locale = useLocale()
  const [status, setStatus] = useState<Status>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testSent, setTestSent] = useState(false)
  const [prefs, setPrefs] = useState<PushPreferences | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { status: deviceStatus, subscription } = await getPushDeviceStatus()
      if (subscription) {
        // Riallinea il dispositivo (lingua, chiavi) a ogni apertura
        await savePushSubscription(JSON.parse(JSON.stringify(subscription)), locale, navigator.userAgent)
        const p = await getPushPreferences()
        if (!cancelled) setPrefs(p)
      }
      if (!cancelled) setStatus(deviceStatus)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [locale])

  const enable = async () => {
    setBusy(true)
    setError(null)
    const result = await enablePush(locale)
    if (result === 'on') {
      setPrefs(await getPushPreferences())
      setStatus('on')
    } else if (result === 'error') setError(t('error'))
    else setStatus(result)
    setBusy(false)
  }

  const disable = async () => {
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setStatus('off')
      setTestSent(false)
    } catch {
      setError(t('error'))
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (category: (typeof CATEGORIES)[number]) => {
    if (!prefs) return
    const value = !prefs[category]
    setPrefs({ ...prefs, [category]: value })
    const res = await setPushPreference(category, value)
    if (!res.success) setPrefs({ ...prefs, [category]: !value })
  }

  const test = async () => {
    setBusy(true)
    const res = await sendTestPush()
    setBusy(false)
    if (res.success) setTestSent(true)
    else setError(t('error'))
  }

  if (status === 'loading') return null

  return (
    <div className="border-t border-gray-100">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
            <Bell className="h-4 w-4 text-[var(--gold)]" /> {t('title')}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {status === 'on' ? t('onHint') : status === 'off' ? t('offHint') : status === 'denied' ? t('denied') : status === 'ios-install' ? t('iosInstall') : t('unsupported')}
          </p>
        </div>
        {status === 'off' && (
          <button type="button" onClick={enable} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-[var(--gold-bright)] disabled:opacity-50">
            {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />} {t('enable')}
          </button>
        )}
        {status === 'on' && (
          <button type="button" onClick={disable} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            <BellOff className="h-3.5 w-3.5" /> {t('disable')}
          </button>
        )}
      </div>

      {status === 'on' && prefs && (
        <div className="mt-3 space-y-2">
          {CATEGORIES.map((category) => (
            <label key={category} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
              <span>
                <span className="block text-xs font-semibold text-[var(--ink)]">{t(`cat_${category}`)}</span>
                <span className="block text-[11px] text-gray-500">{t(`cat_${category}_hint`)}</span>
              </span>
              <input type="checkbox" checked={prefs[category]} onChange={() => toggle(category)} className="h-4 w-4 shrink-0 accent-[var(--gold)]" />
            </label>
          ))}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-gray-500">{testSent ? t('testSent') : t('deviceNote')}</p>
            <button type="button" onClick={test} disabled={busy} className="shrink-0 text-xs font-semibold text-[var(--ink)] underline underline-offset-2 disabled:opacity-50">
              {t('test')}
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
