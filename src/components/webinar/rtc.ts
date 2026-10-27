'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { webinarChannel } from '@/lib/webinar'

// Strumenti del browser per KUMANI Webinar: collegamento video con il server
// di Cloudflare, avvisi in tempo reale e schermo sempre acceso.

export type Sdp = { type: 'offer' | 'answer'; sdp: string }

export function makePeer(ice: RTCIceServer[]) {
  return new RTCPeerConnection({ iceServers: ice, bundlePolicy: 'max-bundle' })
}

// Offerta del server (tracce da ricevere) → risposta del browser
export async function acceptOffer(pc: RTCPeerConnection, offer: Sdp): Promise<Sdp> {
  await pc.setRemoteDescription(offer)
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  return { type: 'answer', sdp: pc.localDescription?.sdp ?? answer.sdp ?? '' }
}

export async function makeOffer(pc: RTCPeerConnection): Promise<Sdp> {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  return { type: 'offer', sdp: pc.localDescription?.sdp ?? offer.sdp ?? '' }
}

// Avvisi «qualcosa è cambiato» dal server (chat o stato della diretta)
export function useWebinarChannel(channelKey: string | null, onPing: (event: 'state' | 'chat') => void) {
  const handler = useRef(onPing)
  useEffect(() => {
    handler.current = onPing
  })
  useEffect(() => {
    if (!channelKey) return
    const supabase = createClient()
    const channel = supabase.channel(webinarChannel(channelKey), { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'state' }, () => handler.current('state'))
      .on('broadcast', { event: 'chat' }, () => handler.current('chat'))
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [channelKey])
}

type WakeLock = { release: () => Promise<void>; released?: boolean }
type WakeNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }

// Schermo acceso finché `active` (si richiede di nuovo quando si torna sulla pagina)
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    let lock: WakeLock | null = null
    let stopped = false
    const request = () => {
      const api = (navigator as WakeNavigator).wakeLock
      if (!api || document.visibilityState !== 'visible' || (lock && !lock.released)) return
      api
        .request('screen')
        .then((l) => {
          if (stopped) l.release().catch(() => {})
          else lock = l
        })
        .catch(() => {})
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => {})
    }
  }, [active])
}

const noopSubscribe = () => () => {}

// Vero solo nel browser dopo il primo disegno (sul server: falso), così il
// testo calcolato dal browser (link, date locali) non crea differenze
export function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

export function useCanShareScreen() {
  return useSyncExternalStore(noopSubscribe, canShareScreen, () => false)
}

// Il browser del telefono non permette di condividere lo schermo
export function canShareScreen() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function'
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

// Videocamera spenta di chi parla: al posto dell'immagine le sue iniziali
// (2 fotogrammi al secondo, pochissimi dati). Il canale resta aperto e la
// videocamera si può riaccendere senza ricollegarsi.
export function avatarTrack(name: string): MediaStreamTrack | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    const ctx = canvas.getContext('2d')
    if (!ctx || typeof canvas.captureStream !== 'function') return null
    let tick = 0
    const draw = () => {
      tick = 1 - tick
      ctx.fillStyle = tick ? '#2a2620' : '#2a2621'
      ctx.fillRect(0, 0, 320, 240)
      ctx.fillStyle = '#3b352b'
      ctx.beginPath()
      ctx.arc(160, 120, 62, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#e7c56a'
      ctx.font = 'bold 54px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(initials(name), 160, 124)
    }
    draw()
    const timer = setInterval(draw, 500)
    const track = canvas.captureStream(2).getVideoTracks()[0]
    if (!track) {
      clearInterval(timer)
      return null
    }
    const stop = track.stop.bind(track)
    track.stop = () => {
      clearInterval(timer)
      stop()
    }
    return track
  } catch {
    return null
  }
}
