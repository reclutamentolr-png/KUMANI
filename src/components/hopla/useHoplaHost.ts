'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  HOPLA_CONNECT_TIMEOUT,
  HOPLA_CTRL_LABEL,
  HOPLA_ICE,
  connectionRoute,
  detectDevice,
  hoplaChannel,
  linkSend,
  newHoplaId,
  parseCtrl,
  type HoplaDevice,
  type HoplaHandlers,
  type HoplaLink,
  type HoplaMode,
  type HoplaRoute,
  type HoplaSignal,
} from '@/lib/hopla'

export type HostPhase = 'starting' | 'waiting' | 'connecting' | 'connected' | 'failed' | 'lost'

// Hoplà dalla pagina dei servizi: crea il codice QR, aspetta il telefono che
// lo inquadra e apre il collegamento diretto. Invio e ricezione dei file
// stanno nei pannelli (HoplaSendPanel, HoplaReceivePanel).
export function useHoplaHost(locale: string, mode: HoplaMode) {
  const [nonce, setNonce] = useState(0)
  const [phase, setPhase] = useState<HostPhase>('starting')
  const [qr, setQr] = useState<string | null>(null)
  const [device, setDevice] = useState<HoplaDevice>('other')
  const [route, setRoute] = useState<HoplaRoute>(null)
  const [link, setLink] = useState<HoplaLink | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const ctrlRef = useRef<RTCDataChannel | null>(null)
  const handlersRef = useRef<HoplaHandlers | null>(null)
  const peerRef = useRef<string | null>(null)
  // Indirizzi di rete arrivati prima della risposta del telefono: in attesa
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modeRef = useRef(mode)

  const send = useCallback((payload: HoplaSignal) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload })
  }, [])

  const closePeer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    ctrlRef.current?.close()
    dcRef.current?.close()
    pcRef.current?.close()
    ctrlRef.current = null
    dcRef.current = null
    pcRef.current = null
    peerRef.current = null
    iceQueueRef.current = []
    setLink(null)
  }, [])

  // Cambio di modalità con il telefono già collegato: glielo si dice, senza scollegarsi
  useEffect(() => {
    modeRef.current = mode
    if (link) linkSend(link, { t: 'mode', mode })
  }, [mode, link])

  const setupChannel = (dc: RTCDataChannel) => {
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => {
      if (dcRef.current !== dc) return
      if (timerRef.current) clearTimeout(timerRef.current)
      const pc = pcRef.current
      if (!pc) return
      setLink({
        pc,
        dc,
        ctrl: () => ctrlRef.current,
        listen: (h) => {
          handlersRef.current = h
        },
      })
      setPhase('connected')
      connectionRoute(pc).then(setRoute)
    }
    dc.onmessage = (e) => {
      if (dcRef.current === dc) handlersRef.current?.onData(e.data as string | ArrayBuffer)
    }
    dc.onclose = () => {
      if (dcRef.current !== dc) return
      // Il telefono si è scollegato: si libera il posto per ricollegarsi allo stesso codice
      closePeer()
      setPhase('lost')
    }
  }

  const connect = async (peer: string) => {
    closePeer()
    peerRef.current = peer
    const pc = new RTCPeerConnection({ iceServers: HOPLA_ICE })
    pcRef.current = pc
    const dc = pc.createDataChannel('hopla', { ordered: true })
    dcRef.current = dc
    setupChannel(dc)
    // Canale dei comandi urgenti: l'«annulla» arriva subito
    const ctrl = pc.createDataChannel(HOPLA_CTRL_LABEL, { ordered: true })
    ctrlRef.current = ctrl
    ctrl.onmessage = (e) => {
      if (ctrlRef.current !== ctrl || typeof e.data !== 'string') return
      const msg = parseCtrl(e.data)
      if (msg) handlersRef.current?.onCtrl(msg)
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ kind: 'ice', peer, from: 'pc', candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== 'failed' || pcRef.current !== pc) return
      closePeer()
      setPhase((p) => (p === 'connecting' ? 'failed' : 'lost'))
    }
    timerRef.current = setTimeout(() => {
      if (dc.readyState !== 'open' && pcRef.current === pc) {
        closePeer()
        setPhase('failed')
      }
    }, HOPLA_CONNECT_TIMEOUT)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ kind: 'offer', peer, sdp: offer, mode: modeRef.current, device: detectDevice(navigator.userAgent) })
  }

  const onSignal = async (s: HoplaSignal) => {
    if (!s || typeof s !== 'object') return
    if (s.kind === 'hello') {
      // Saluto ripetuto dallo stesso telefono mentre ci si sta già collegando
      if (s.peer === peerRef.current && pcRef.current) return
      const busy = peerRef.current && peerRef.current !== s.peer && dcRef.current?.readyState === 'open'
      if (busy) {
        send({ kind: 'busy', peer: s.peer })
        return
      }
      setDevice(s.device)
      setPhase('connecting')
      await connect(s.peer)
    } else if (s.peer !== peerRef.current) {
      return
    } else if (s.kind === 'answer') {
      const pc = pcRef.current
      if (!pc || pc.remoteDescription) return
      await pc.setRemoteDescription(s.sdp)
      for (const candidate of iceQueueRef.current.splice(0)) await pc.addIceCandidate(candidate).catch(() => {})
    } else if (s.kind === 'ice' && s.from === 'phone') {
      const pc = pcRef.current
      if (!pc) return
      if (!pc.remoteDescription) iceQueueRef.current.push(s.candidate)
      else await pc.addIceCandidate(s.candidate).catch(() => {})
    } else if (s.kind === 'bye' && s.from === 'phone') {
      closePeer()
      setPhase('waiting')
    }
  }
  const onSignalRef = useRef(onSignal)
  useEffect(() => {
    onSignalRef.current = onSignal
  })

  // Codice nuovo a ogni apertura (o con «Nuovo codice»)
  useEffect(() => {
    const id = newHoplaId()
    const prefix = locale === 'it' ? '' : `/${locale}`
    const url = `${window.location.origin}${prefix}/hopla/${id}`
    let cancelled = false
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(url, { width: 560, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#ffffff' } }))
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl)
      })
    const supabase = createClient()
    const channel = supabase.channel(hoplaChannel(id), { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        onSignalRef.current(payload as HoplaSignal).catch((error) => {
          console.error('[hopla] segnale:', error)
          setPhase('failed')
        })
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setPhase((p) => (p === 'starting' ? 'waiting' : p))
      })
    channelRef.current = channel
    return () => {
      cancelled = true
      if (peerRef.current) channel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'bye', peer: peerRef.current, from: 'pc' } })
      closePeer()
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [nonce, locale, closePeer])

  const restart = () => {
    setPhase('starting')
    setQr(null)
    setNonce((n) => n + 1)
  }

  // Il percorso può cambiare dopo i primi secondi: lo si ricontrolla all'inizio di un invio
  const recheckRoute = useCallback(() => {
    if (pcRef.current) connectionRoute(pcRef.current).then((r) => r && setRoute(r))
  }, [])

  return { phase, qr, device, route, link, restart, recheckRoute }
}
