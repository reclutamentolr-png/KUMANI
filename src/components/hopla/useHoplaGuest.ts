'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import {
  HOPLA_CONNECT_TIMEOUT,
  HOPLA_CTRL_LABEL,
  HOPLA_ICE,
  HOPLA_LOW_WATER,
  detectDevice,
  hoplaChannel,
  newPeerId,
  parseCtrl,
  type HoplaDevice,
  type HoplaHandlers,
  type HoplaLink,
  type HoplaMode,
  type HoplaSignal,
} from '@/lib/hopla'

export type GuestPhase = 'joining' | 'connecting' | 'ready' | 'expired' | 'busy' | 'failed' | 'lost'

// Hoplà dal telefono che ha inquadrato il codice: si collega a chi lo mostra.
// La modalità la sceglie l'altro dispositivo: se lui riceve, qui si invia, e
// viceversa (può cambiarla anche a collegamento aperto).
export function useHoplaGuest(id: string) {
  const [phase, setPhase] = useState<GuestPhase>('joining')
  const [hostMode, setHostMode] = useState<HoplaMode>('get')
  const [hostDevice, setHostDevice] = useState<HoplaDevice>('computer')
  const [link, setLink] = useState<HoplaLink | null>(null)
  // Ogni tentativo (anche «Ricollegati») rientra sullo stesso codice con un nuovo canale
  const [attempt, setAttempt] = useState(0)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const ctrlRef = useRef<RTCDataChannel | null>(null)
  const handlersRef = useRef<HoplaHandlers | null>(null)
  const phaseRef = useRef<GuestPhase>('joining')

  const go = (next: GuestPhase) => {
    phaseRef.current = next
    setPhase(next)
    if (next !== 'ready') setLink(null)
  }

  useEffect(() => {
    const peer = newPeerId()
    const supabase = createClient()
    const channel = supabase.channel(hoplaChannel(id), { config: { broadcast: { self: false } } })
    const signal = (payload: HoplaSignal) => channel.send({ type: 'broadcast', event: 'signal', payload })
    let helloTimer: ReturnType<typeof setInterval> | null = null
    let expireTimer: ReturnType<typeof setTimeout> | null = null
    let connectTimer: ReturnType<typeof setTimeout> | null = null
    // Indirizzi di rete dell'altro dispositivo arrivati prima che l'offerta sia applicata
    const iceQueue: RTCIceCandidateInit[] = []
    let gotOffer = false

    const onOffer = async (s: Extract<HoplaSignal, { kind: 'offer' }>) => {
      // Una sola offerta per collegamento
      if (gotOffer) return
      gotOffer = true
      if (helloTimer) clearInterval(helloTimer)
      if (expireTimer) clearTimeout(expireTimer)
      if (s.mode === 'get' || s.mode === 'give') setHostMode(s.mode)
      if (s.device) setHostDevice(s.device)
      pcRef.current?.close()
      const pc = new RTCPeerConnection({ iceServers: HOPLA_ICE })
      pcRef.current = pc
      go('connecting')
      pc.onicecandidate = (e) => {
        if (e.candidate) signal({ kind: 'ice', peer, from: 'phone', candidate: e.candidate.toJSON() })
      }
      pc.onconnectionstatechange = () => {
        // Solo il collegamento attuale: uno vecchio che muore dopo non deve toccare quello nuovo
        if (pcRef.current !== pc) return
        if (pc.connectionState === 'failed') go(phaseRef.current === 'connecting' ? 'failed' : 'lost')
      }
      pc.ondatachannel = (e) => {
        if (e.channel.label === HOPLA_CTRL_LABEL) {
          ctrlRef.current = e.channel
          e.channel.onmessage = (m) => {
            const msg = typeof m.data === 'string' ? parseCtrl(m.data) : null
            if (msg) handlersRef.current?.onCtrl(msg)
          }
          return
        }
        const dc = e.channel
        dc.binaryType = 'arraybuffer'
        dc.bufferedAmountLowThreshold = HOPLA_LOW_WATER
        dcRef.current = dc
        dc.onopen = () => {
          if (connectTimer) clearTimeout(connectTimer)
          go('ready')
          setLink({
            pc,
            dc,
            ctrl: () => ctrlRef.current,
            listen: (h) => {
              handlersRef.current = h
            },
          })
        }
        dc.onmessage = (m) => {
          if (dcRef.current !== dc) return
          // Il cambio di modalità lo gestisce il collegamento, il resto va al pannello
          if (typeof m.data === 'string') {
            const msg = parseCtrl(m.data)
            if (msg?.t === 'mode') {
              if (msg.mode === 'get' || msg.mode === 'give') setHostMode(msg.mode)
              return
            }
          }
          handlersRef.current?.onData(m.data as string | ArrayBuffer)
        }
        dc.onclose = () => {
          if (dcRef.current !== dc) return
          if (!['expired', 'busy', 'failed'].includes(phaseRef.current)) go('lost')
        }
      }
      connectTimer = setTimeout(() => {
        if (dcRef.current?.readyState !== 'open') go('failed')
      }, HOPLA_CONNECT_TIMEOUT)
      await pc.setRemoteDescription(s.sdp)
      for (const candidate of iceQueue.splice(0)) await pc.addIceCandidate(candidate).catch(() => {})
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      signal({ kind: 'answer', peer, sdp: answer })
    }

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const s = payload as HoplaSignal
        if (!s || s.peer !== peer) return
        if (s.kind === 'offer') onOffer(s).catch(() => go('failed'))
        else if (s.kind === 'ice' && s.from === 'pc') {
          const pc = pcRef.current
          if (!pc || !pc.remoteDescription) iceQueue.push(s.candidate)
          else pc.addIceCandidate(s.candidate).catch(() => {})
        } else if (s.kind === 'busy') {
          if (helloTimer) clearInterval(helloTimer)
          if (expireTimer) clearTimeout(expireTimer)
          go('busy')
        } else if (s.kind === 'bye' && s.from === 'pc') go('lost')
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        const hello = () => signal({ kind: 'hello', peer, device: detectDevice(navigator.userAgent) })
        hello()
        // Ripete il saluto: l'altro dispositivo potrebbe essersi appena collegato
        helloTimer = setInterval(hello, 3000)
        expireTimer = setTimeout(() => {
          if (helloTimer) clearInterval(helloTimer)
          if (phaseRef.current === 'joining') go('expired')
        }, 12_000)
      })
    channelRef.current = channel

    const onLeave = () => signal({ kind: 'bye', peer, from: 'phone' })
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      if (helloTimer) clearInterval(helloTimer)
      if (expireTimer) clearTimeout(expireTimer)
      if (connectTimer) clearTimeout(connectTimer)
      onLeave()
      ctrlRef.current?.close()
      dcRef.current?.close()
      pcRef.current?.close()
      supabase.removeChannel(channel)
    }
  }, [id, attempt])

  const retry = () => {
    // Il vecchio collegamento si chiude davvero prima di aprirne uno nuovo
    const oldDc = dcRef.current
    const oldPc = pcRef.current
    dcRef.current = null
    pcRef.current = null
    oldDc?.close()
    oldPc?.close()
    go('joining')
    setAttempt((n) => n + 1)
  }

  return { phase, hostMode, hostDevice, link, retry }
}
