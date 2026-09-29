'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, Download, Share, PlusSquare } from 'lucide-react'
import Logo from '@/components/Logo'

// Evento del browser per installare l'app (Chrome, Edge, Android): non è
// ancora nei tipi standard di TypeScript
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export default function InstallAppPrompt() {
  const t = useTranslations('dashboard')
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  // iPhone/iPad: calcolato subito (il banner parte comunque nascosto, quindi
  // server e browser disegnano la stessa cosa)
  const [isIOS] = useState(() => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent))

  useEffect(() => {
    // ✅ Non mostrare se: già rifiutato in passato o app già installata
    const dismissed = localStorage.getItem('install_prompt_dismissed')
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true

    if (dismissed || isStandalone) return

    const iOS = isIOS

    // ✅ Android/Chrome/Desktop: intercetta il prompt nativo e mostra il nostro
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setVisible(true), 1500)
    }

    const onAppInstalled = () => {
      localStorage.setItem('install_prompt_dismissed', 'true')
      setVisible(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    // ✅ iOS: non esiste beforeinstallprompt → mostra il tutorial
    let timer: ReturnType<typeof setTimeout> | undefined
    if (iOS) {
      timer = setTimeout(() => setVisible(true), 1500)
    }

    return () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [isIOS])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      localStorage.setItem('install_prompt_dismissed', 'true')
    }
    setDeferredPrompt(null)
    setVisible(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('install_prompt_dismissed', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative border-b border-[var(--gold)]/25 bg-[var(--ink)] p-5 text-white">
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/70 hover:text-[var(--gold-bright)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Logo size={48} className="flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg">{t('installTitle')}</h3>
              <p className="text-[var(--gold-pale)] text-sm">{t('installDesc')}</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {isIOS ? (
            /* ✅ iPhone/iPad: istruzioni passo-passo */
            <div className="space-y-3">
              <p className="text-sm text-gray-600">{t('installIOS')}</p>
              <div className="flex items-center gap-3 p-3 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-[var(--ink)] text-[var(--gold-bright)] flex items-center justify-center flex-shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-700"><strong>1.</strong> {t('installStep1')} <strong>{t('shareButton')}</strong> {t('installStep1Lower')}</p>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[var(--paper)] border border-[var(--gold)]/20 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-[var(--ink)] text-[var(--gold-bright)] flex items-center justify-center flex-shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <p className="text-sm text-gray-700"><strong>2.</strong> {t('installStep2')} <strong>{t('addToHome')}</strong></p>
              </div>
            </div>
          ) : (
            /* ✅ Android/Desktop: testo + pulsante nativo */
            <p className="text-sm text-gray-600">{t('installPrompt')}</p>
          )}

          <div className="flex gap-3 mt-5">
            {deferredPrompt && (
              <button
                onClick={handleInstall}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] py-3 rounded-xl font-bold hover:brightness-110 transition-all"
              >
                <Download className="w-4 h-4" />
                {t('installNow')}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className={`py-3 rounded-xl font-semibold transition-colors ${
                deferredPrompt
                  ? 'px-4 border border-[var(--gold)]/40 text-[var(--ink)] hover:border-[var(--gold)] hover:bg-[var(--paper)]'
                  : 'flex-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold hover:brightness-110'
              }`}
            >
              {deferredPrompt ? t('notNow') : t('gotIt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
