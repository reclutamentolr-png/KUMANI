'use client'

import { removePushSubscription, savePushSubscription } from '@/app/actions/push'

// Lato browser delle notifiche push: usato dal profilo e dall'invito in dashboard.

export type PushDeviceStatus = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i)
  return output
}

// Stato di questo dispositivo (registra il service worker se serve)
export async function getPushDeviceStatus(locale?: string): Promise<{ status: PushDeviceStatus; subscription: PushSubscription | null }> {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!supported || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return { status: ios && !standalone ? 'ios-install' : 'unsupported', subscription: null }
  }
  if (Notification.permission === 'denied') return { status: 'denied', subscription: null }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    const subscription = await registration.pushManager.getSubscription()
    // Il dispositivo appartiene a chi è collegato adesso (anche se prima era
    // di un altro account uscito senza "Esci")
    if (subscription && locale) await savePushSubscription(JSON.parse(JSON.stringify(subscription)), locale, navigator.userAgent).catch(() => {})
    return { status: subscription ? 'on' : 'off', subscription }
  } catch {
    return { status: 'unsupported', subscription: null }
  }
}

// Chiede il permesso, attiva le notifiche e salva il dispositivo
export async function enablePush(locale: string): Promise<'on' | 'off' | 'denied' | 'error'> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })
    const res = await savePushSubscription(JSON.parse(JSON.stringify(subscription)), locale, navigator.userAgent)
    if (!res.success) {
      await subscription.unsubscribe().catch(() => {})
      return 'error'
    }
    return 'on'
  } catch {
    return 'error'
  }
}

// All'uscita dall'account: questo dispositivo smette di ricevere le notifiche
// di quell'account (es. telefono o computer condiviso). Non blocca mai l'uscita.
export async function forgetPushDevice() {
  try {
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return
    await Promise.race([removePushSubscription(subscription.endpoint), new Promise((resolve) => setTimeout(resolve, 3000))])
    await subscription.unsubscribe()
  } catch {
    // l'uscita continua comunque
  }
}
