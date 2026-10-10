'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { MoreVertical, PlusSquare, Share, X } from 'lucide-react'
import Logo from '@/components/Logo'

// «Porta KUMANI con te»: banner per installare il sito come app, sulla
// homepage e sulla dashboard. «Non ora» lo nasconde per 14 giorni; si può
// riaprire quando si vuole con «Installa l'app» (menu ☰ e fondo della
// homepage) e, sul computer, anche dall'icona del browser nella barra degli
// indirizzi. Su iPhone/iPad (niente installazione automatica) spiega i
// due tocchi da fare; negli altri browser dove serve, il menu del browser.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export const SHOW_INSTALL_EVENT = 'kumani:show-install'
const SNOOZE_KEY = 'kumani_install_snoozed_until'
// Solo app installata davvero (la vecchia finestra salvava anche il «Non ora»
// per sempre in install_prompt_dismissed: non vale più)
const INSTALLED_KEY = 'kumani_app_installed'
const SNOOZE_DAYS = 14
const AUTO_PATHS = /^(?:\/[a-z]{2})?(?:\/dashboard)?\/?$/

export function isStandaloneApp() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function openInstallBanner() {
  window.dispatchEvent(new Event(SHOW_INSTALL_EVENT))
}

export default function InstallAppBanner() {
  const t = useTranslations('install')
  const pathname = usePathname()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  // 'ios' = Safari su iPhone/iPad; 'menu' = installazione dal menu del browser
  const [help, setHelp] = useState<null | 'ios' | 'menu'>(null)
  const [isIOS, setIsIOS] = useState(false)

  const read = (key: string) => {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  }
  const write = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value)
    } catch {
      // memoria del browser non disponibile
    }
  }
  const snoozed = useCallback(() => Number(read(SNOOZE_KEY) ?? 0) > Date.now(), [])

  useEffect(() => {
    if (isStandaloneApp()) return
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- il tipo di dispositivo si conosce solo nel browser
    setIsIOS(ios)
    const auto = AUTO_PATHS.test(pathname) && !read(INSTALLED_KEY) && !snoozed()
    const onPrompt = (e: Event) => {
      // Si tiene l'evento anche se il banner è rimandato: serve per «Installa l'app»
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      if (auto) setTimeout(() => setVisible(true), 1500)
    }
    const onInstalled = () => {
      write(INSTALLED_KEY, 'true')
      setVisible(false)
      setHelp(null)
    }
    const onShow = () => {
      setHelp(null)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    window.addEventListener(SHOW_INSTALL_EVENT, onShow)
    const timer = ios && auto ? setTimeout(() => setVisible(true), 1500) : undefined
    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      window.removeEventListener(SHOW_INSTALL_EVENT, onShow)
    }
  }, [pathname, snoozed])

  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') write(INSTALLED_KEY, 'true')
      setDeferred(null)
      setVisible(false)
      return
    }
    setHelp(isIOS ? 'ios' : 'menu')
  }
  const later = () => {
    write(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86_400_000))
    setVisible(false)
    setHelp(null)
  }

  if (!visible) return null

  return (
    <div role="region" aria-label={t('title')} className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] mx-auto max-w-2xl print:hidden">
      <div className="rounded-2xl border-2 border-[var(--gold)]/60 bg-white p-4 shadow-[0_18px_50px_rgba(23,23,23,0.28)]">
        {help ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-[var(--ink)]">{t(help === 'ios' ? 'iosTitle' : 'menuTitle')}</p>
              <button type="button" onClick={later} aria-label={t('later')} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-500 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {help === 'ios' ? (
              <ol className="space-y-2 text-sm text-gray-700">
                <li className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                    <Share className="h-4 w-4" />
                  </span>
                  {t('iosStep1')}
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                    <PlusSquare className="h-4 w-4" />
                  </span>
                  {t('iosStep2')}
                </li>
              </ol>
            ) : (
              <p className="flex items-center gap-3 text-sm text-gray-700">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                  <MoreVertical className="h-4 w-4" />
                </span>
                {t('menuText')}
              </p>
            )}
            <button type="button" onClick={later} className="min-h-11 w-full cursor-pointer rounded-xl bg-[var(--ink)] font-bold text-white">
              {t('gotIt')}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <Logo size={52} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[var(--ink)]">{t('title')}</p>
              <p className="text-sm text-gray-600">{t('text')}</p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <button type="button" onClick={install} className="min-h-11 flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 text-sm font-bold text-[var(--ink)] shadow hover:brightness-105 sm:flex-none">
                {t('add')}
              </button>
              <button type="button" onClick={later} className="min-h-11 cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-[var(--ink)] hover:bg-gray-100">
                {t('later')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Collegamento «Installa l'app» (menu ☰, fondo della homepage): nascosto se
// il sito è già aperto come app
export function InstallAppLink({ className, children }: { className?: string; children: React.ReactNode }) {
  const [standalone, setStandalone] = useState(true)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la modalità app si conosce solo nel browser
    setStandalone(isStandaloneApp())
  }, [])
  if (standalone) return null
  return (
    <button type="button" onClick={openInstallBanner} className={className}>
      {children}
    </button>
  )
}
