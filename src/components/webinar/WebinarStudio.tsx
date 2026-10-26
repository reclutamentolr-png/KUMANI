'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Copy,
  Eye,
  Hand,
  Loader2,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  Radio,
  Share2,
  Square,
  UserX,
  Users,
  Video,
  VideoOff,
  Volume2,
  X,
} from 'lucide-react'
import {
  hostAnswer,
  hostBeat,
  hostEnd,
  hostIce,
  hostModerate,
  hostPublish,
  hostPull,
  hostSendMessage,
  hostSetSpeaker,
} from '@/app/actions/webinar'
import { HOST_BEAT_MS, trackKind, type LiveState, type WebinarMessage, type WebinarStatus, type WebinarViewerRow } from '@/lib/webinar'
import { askConfirm } from '@/lib/confirm'
import WebinarChat from '@/components/webinar/WebinarChat'
import WebinarInvites from '@/components/webinar/WebinarInvites'
import WebinarName from '@/components/webinar/WebinarName'
import { acceptOffer, initials, makeOffer, makePeer, useCanShareScreen, useMounted, useWakeLock, useWebinarChannel } from '@/components/webinar/rtc'

type Phase = 'setup' | 'starting' | 'live' | 'ended'

const CAMERA: MediaTrackConstraints = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24 }, facingMode: 'user' }

// Immagine nera minuscola (2 al secondo) al posto della videocamera spenta o
// dello schermo non condiviso: un canale senza immagini dopo ~30 secondi non
// viene più dato da Cloudflare a chi guarda
function placeholderTrack(): MediaStreamTrack | null {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 9
    const ctx = canvas.getContext('2d')
    if (!ctx || typeof canvas.captureStream !== 'function') return null
    let tick = 0
    const draw = () => {
      tick = 1 - tick
      ctx.fillStyle = tick ? '#000000' : '#010101'
      ctx.fillRect(0, 0, 16, 9)
    }
    draw()
    const timer = setInterval(draw, 500)
    const track = canvas.captureStream(2).getVideoTracks()[0]
    if (!track) {
      clearInterval(timer)
      return null
    }
    track.addEventListener('ended', () => clearInterval(timer))
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

const ctrl =
  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:opacity-40'

export default function WebinarStudio({
  webinar,
  hostName,
}: {
  webinar: { id: string; code: string; title: string; startsAt: string; status: WebinarStatus; channelKey: string; seats: number }
  hostName: string
}) {
  const t = useTranslations('webinar')
  const locale = useLocale()
  const [phase, setPhase] = useState<Phase>(webinar.status === 'ended' ? 'ended' : 'setup')
  const [error, setError] = useState<string | null>(null)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const [state, setState] = useState<LiveState | null>(null)
  const [viewers, setViewers] = useState<WebinarViewerRow[]>([])
  const [messages, setMessages] = useState<WebinarMessage[]>([])
  const [copied, setCopied] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const screenAllowed = useCanShareScreen()
  const mounted = useMounted()

  const iceRef = useRef<RTCIceServer[] | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const tx = useRef<{ audio?: RTCRtpTransceiver; video?: RTCRtpTransceiver; screen?: RTCRtpTransceiver }>({})
  const micRef = useRef<MediaStreamTrack | null>(null)
  const camRef = useRef<MediaStreamTrack | null>(null)
  const screenRef = useRef<MediaStreamTrack | null>(null)
  const idleRef = useRef<{ video: MediaStreamTrack | null; screen: MediaStreamTrack | null }>({ video: null, screen: null })
  const flagsRef = useRef({ camOn: true, screenOn: false })
  const lastIdRef = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  const previewRef = useRef<HTMLVideoElement>(null)
  const pipRef = useRef<HTMLVideoElement>(null)
  const speakerAudioRef = useRef<HTMLAudioElement>(null)
  // Videocamera di chi ha la parola (riquadro sull'anteprima)
  const speakerVideoRef = useRef<HTMLVideoElement>(null)
  const listenRef = useRef<{ pc: RTCPeerConnection; track: string } | null>(null)
  const repairTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ora d'inizio del controllo in corso (0 = nessuno): uno rimasto appeso
  // mentre il telefono addormentava la pagina non blocca i successivi
  const beatBusy = useRef(0)
  const beatAgain = useRef(false)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])
  useEffect(() => {
    flagsRef.current = { camOn, screenOn }
    // Videocamera o schermo cambiati in diretta: chi guarda lo sa subito
    if (phaseRef.current === 'live') beatRef.current()
  }, [camOn, screenOn])

  const link = !mounted ? '' : `${window.location.origin}${locale === 'it' ? '' : `/${locale}`}/webinar/${webinar.code}`

  // Anteprima: schermo grande se condiviso, videocamera nel riquadro
  const refreshPreview = useCallback(() => {
    const main = previewRef.current
    const pip = pipRef.current
    const cam = camRef.current && camRef.current.readyState === 'live' ? camRef.current : null
    const screen = screenRef.current && screenRef.current.readyState === 'live' ? screenRef.current : null
    if (main) {
      const track = screen ?? cam
      const current = (main.srcObject as MediaStream | null)?.getVideoTracks()[0]
      if (current !== track) main.srcObject = track ? new MediaStream([track]) : null
    }
    if (pip) {
      const track = screen ? cam : null
      const current = (pip.srcObject as MediaStream | null)?.getVideoTracks()[0]
      if (current !== track) pip.srcObject = track ? new MediaStream([track]) : null
    }
  }, [])

  // ── Segnale di vita, chat e chi è collegato ──────────────────────────
  const beat = useCallback(async () => {
    if (beatBusy.current && Date.now() - beatBusy.current < 12_000) {
      beatAgain.current = true
      return
    }
    beatBusy.current = Date.now()
    try {
      const res = await hostBeat(
        webinar.id,
        { paused: document.visibilityState !== 'visible', camOn: flagsRef.current.camOn, screenOn: flagsRef.current.screenOn },
        lastIdRef.current
      )
      if ('error' in res) return
      setState(res.state)
      setViewers(res.viewers)
      if (res.messages.length) {
        lastIdRef.current = res.messages[res.messages.length - 1].id
        setMessages((list) => [...list, ...res.messages].slice(-300))
      }
    } catch {
      // Rete assente: si riprova al giro successivo
    } finally {
      beatBusy.current = 0
      if (beatAgain.current) {
        beatAgain.current = false
        beat()
      }
    }
  }, [webinar.id])

  const beatRef = useRef(beat)
  useEffect(() => {
    beatRef.current = beat
  }, [beat])

  useWebinarChannel(webinar.channelKey, () => {
    beat()
  })

  useEffect(() => {
    // Primo controllo subito, poi ogni 5 secondi
    const first = setTimeout(beat, 0)
    const timer = setInterval(beat, HOST_BEAT_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [beat])

  useEffect(() => {
    if (phase !== 'live') return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [phase])

  useWakeLock(phase === 'live' || phase === 'starting')

  // Uscire dalla pagina durante la diretta: il browser chiede conferma
  useEffect(() => {
    if (phase !== 'live') return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase])

  // Traccia «a riposo» per il canale della videocamera o dello schermo
  const idle = (kind: 'video' | 'screen') => {
    const current = idleRef.current[kind]
    if (current && current.readyState === 'live') return current
    const track = placeholderTrack()
    idleRef.current[kind] = track
    return track
  }

  // ── Videocamera e microfono ──────────────────────────────────────────
  const openMedia = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: CAMERA })
      micRef.current = stream.getAudioTracks()[0] ?? null
      camRef.current = stream.getVideoTracks()[0] ?? null
      if (micRef.current) micRef.current.enabled = micOn
      setCamOn(!!camRef.current)
      setMediaReady(true)
      requestAnimationFrame(refreshPreview)
    } catch {
      // Senza videocamera si prova almeno il microfono
      try {
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true })
        micRef.current = audio.getAudioTracks()[0] ?? null
        setCamOn(false)
        setMediaReady(true)
        setError(t('errorNoCamera'))
      } catch {
        setError(t('errorNoMedia'))
      }
    }
  }

  const toggleMic = () => {
    const next = !micOn
    if (micRef.current) micRef.current.enabled = next
    setMicOn(next)
  }

  const toggleCam = async () => {
    if (camOn) {
      camRef.current?.stop()
      camRef.current = null
      await tx.current.video?.sender.replaceTrack(idle('video')).catch(() => {})
      setCamOn(false)
      refreshPreview()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA })
      camRef.current = stream.getVideoTracks()[0]
      await tx.current.video?.sender.replaceTrack(camRef.current).catch(() => {})
      setCamOn(true)
      requestAnimationFrame(refreshPreview)
    } catch {
      setError(t('errorNoCamera'))
    }
  }

  const stopScreen = useCallback(async () => {
    screenRef.current?.stop()
    screenRef.current = null
    await tx.current.screen?.sender.replaceTrack(idle('screen')).catch(() => {})
    setScreenOn(false)
    refreshPreview()
  }, [refreshPreview])

  const toggleScreen = async () => {
    if (screenOn) return stopScreen()
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false })
      const track = stream.getVideoTracks()[0]
      if (!track) return
      track.contentHint = 'detail'
      track.addEventListener('ended', () => {
        if (screenRef.current === track) stopScreen()
      })
      screenRef.current = track
      await tx.current.screen?.sender.replaceTrack(track).catch(() => {})
      setScreenOn(true)
      requestAnimationFrame(refreshPreview)
    } catch {
      // Condivisione annullata dall'utente
    }
  }

  // ── Diretta ──────────────────────────────────────────────────────────
  const closePeer = () => {
    const pc = pcRef.current
    pcRef.current = null
    tx.current = {}
    if (pc) {
      pc.onconnectionstatechange = null
      pc.close()
    }
  }

  // Pubblica le tre tracce (voce, videocamera, schermo); chiamata anche per
  // ripartire dopo un problema di rete, con una sessione nuova
  const publish = useCallback(async (): Promise<boolean> => {
    if (!iceRef.current) {
      const res = await hostIce(webinar.id)
      if ('error' in res) {
        setError(res.error === 'not_configured' ? t('errorNotConfigured') : t('errorGeneric'))
        return false
      }
      iceRef.current = res.ice
    }
    closePeer()
    const pc = makePeer(iceRef.current)
    pcRef.current = pc
    const mic = micRef.current?.readyState === 'live' ? micRef.current : null
    const cam = camRef.current?.readyState === 'live' ? camRef.current : null
    const screen = screenRef.current?.readyState === 'live' ? screenRef.current : null
    tx.current = {
      audio: pc.addTransceiver(mic ?? 'audio', { direction: 'sendonly' }),
      video: pc.addTransceiver(cam ?? idle('video') ?? 'video', { direction: 'sendonly' }),
      screen: pc.addTransceiver(screen ?? idle('screen') ?? 'video', { direction: 'sendonly' }),
    }
    const offer = await makeOffer(pc)
    const res = await hostPublish(
      webinar.id,
      offer,
      [
        { mid: tx.current.audio!.mid!, kind: 'audio' },
        { mid: tx.current.video!.mid!, kind: 'video' },
        { mid: tx.current.screen!.mid!, kind: 'screen' },
      ],
      flagsRef.current
    )
    if (pcRef.current !== pc) return false
    if ('error' in res) {
      closePeer()
      setError(res.error === 'ended' ? t('errorEnded') : t('errorGeneric'))
      return false
    }
    await pc.setRemoteDescription(res.answer)
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return
      const s = pc.connectionState
      if (s === 'connected') {
        setReconnecting(false)
        if (repairTimer.current) clearTimeout(repairTimer.current)
        repairTimer.current = null
      } else if (s === 'failed') {
        scheduleRepair(0)
      } else if (s === 'disconnected') {
        scheduleRepair(5000)
      }
    }
    return true
    // scheduleRepair è stabile (usa solo ref)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webinar.id, t])

  // Collegamento perso: si ripubblica (chi guarda si ricollega da solo)
  function scheduleRepair(delay: number) {
    if (repairTimer.current || phaseRef.current !== 'live') return
    setReconnecting(true)
    repairTimer.current = setTimeout(async () => {
      repairTimer.current = null
      if (phaseRef.current !== 'live') return
      const pc = pcRef.current
      if (pc && pc.connectionState === 'connected') {
        setReconnecting(false)
        return
      }
      const ok = await publish().catch(() => false)
      if (!ok) scheduleRepair(3000)
    }, delay)
  }

  const start = async () => {
    if (!mediaReady) return
    setError(null)
    setPhase('starting')
    const ok = await publish().catch(() => false)
    if (!ok) {
      setPhase('setup')
      setError((e) => e ?? t('errorGeneric'))
      return
    }
    setStartedAt(Date.now())
    setPhase('live')
    beat()
  }

  // Spegne videocamera, microfono, schermo e collegamenti
  const stopAll = () => {
    closePeer()
    listenRef.current?.pc.close()
    listenRef.current = null
    micRef.current?.stop()
    camRef.current?.stop()
    screenRef.current?.stop()
    idleRef.current.video?.stop()
    idleRef.current.screen?.stop()
  }

  const end = async () => {
    if (!(await askConfirm(t('endConfirm'), { title: t('endTitle'), confirmLabel: t('endYes'), cancelLabel: t('endNo'), tone: 'warning' }))) return
    await hostEnd(webinar.id)
    stopAll()
    setPhase('ended')
  }

  // «Chiudi la regia»: in diretta prima la si termina per tutti (con conferma),
  // poi si spegne tutto e si torna all'elenco dei webinar
  const router = useRouter()
  const closeStudio = async () => {
    if (phase === 'live') {
      if (!(await askConfirm(t('closeStudioConfirm'), { title: t('closeStudioTitle'), confirmLabel: t('closeStudioYes'), cancelLabel: t('endNo'), tone: 'warning' }))) return
      await hostEnd(webinar.id)
    }
    stopAll()
    router.push(`${locale === 'it' ? '' : `/${locale}`}/app/webinar`)
  }

  // Tornando sulla pagina: videocamera e microfono possono essere stati
  // spenti dal telefono, il collegamento può essere caduto
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== 'visible') {
        beat()
        return
      }
      if (phaseRef.current === 'live') {
        if (micRef.current && micRef.current.readyState === 'ended') {
          try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
            const track = s.getAudioTracks()[0]
            track.enabled = micRef.current.enabled
            micRef.current = track
            await tx.current.audio?.sender.replaceTrack(track)
          } catch {
            setError(t('errorNoMedia'))
          }
        }
        if (flagsRef.current.camOn && camRef.current && camRef.current.readyState === 'ended') {
          try {
            const s = await navigator.mediaDevices.getUserMedia({ video: CAMERA })
            camRef.current = s.getVideoTracks()[0]
            await tx.current.video?.sender.replaceTrack(camRef.current)
            refreshPreview()
          } catch {
            setError(t('errorNoCamera'))
          }
        }
        const pc = pcRef.current
        if (!pc || pc.connectionState === 'failed' || pc.connectionState === 'closed') scheduleRepair(0)
      }
      beat()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat, refreshPreview, t])

  // Chi ha la parola: si ascolta la sua voce e si vede la sua videocamera
  const speakerTrack = state?.speaker?.track ?? null
  const speakerVideoTrack = state?.speaker?.videoTrack ?? null
  useEffect(() => {
    if (phase !== 'live') return
    const key = `${speakerTrack ?? ''}|${speakerVideoTrack ?? ''}`
    const current = listenRef.current
    if (current && current.track === key) return
    current?.pc.close()
    listenRef.current = null
    if (speakerAudioRef.current) speakerAudioRef.current.srcObject = null
    if (speakerVideoRef.current) speakerVideoRef.current.srcObject = null
    if (!speakerTrack || !iceRef.current) return
    const pc = makePeer(iceRef.current)
    listenRef.current = { pc, track: key }
    const midToName = new Map<string, string>()
    pc.ontrack = (e) => {
      const isFace = trackKind(midToName.get(e.transceiver.mid ?? '') ?? '') === 'face' || e.track.kind === 'video'
      const el = isFace ? speakerVideoRef.current : speakerAudioRef.current
      if (el) {
        el.srcObject = new MediaStream([e.track])
        el.play().catch(() => {})
      }
    }
    ;(async () => {
      const res = await hostPull(webinar.id, null, speakerVideoTrack ? [speakerTrack, speakerVideoTrack] : [speakerTrack])
      if ('error' in res || listenRef.current?.pc !== pc) return
      for (const tr of res.tracks) midToName.set(tr.mid, tr.trackName)
      const answer = await acceptOffer(pc, res.offer)
      await hostAnswer(webinar.id, res.sessionId, answer)
    })().catch(() => {})
  }, [phase, speakerTrack, speakerVideoTrack, webinar.id])

  // Chiusura della pagina: si spegne tutto
  useEffect(() => {
    // Stesso oggetto per tutta la vita della pagina (cambiano solo i campi)
    const idleTracks = idleRef.current
    return () => {
      pcRef.current?.close()
      listenRef.current?.pc.close()
      micRef.current?.stop()
      camRef.current?.stop()
      screenRef.current?.stop()
      idleTracks.video?.stop()
      idleTracks.screen?.stop()
    }
  }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const sendMessage = async (body: string) => {
    const res = await hostSendMessage(webinar.id, body)
    if ('error' in res) return t('errorGeneric')
    beat()
    return null
  }

  const ban = async (viewer: WebinarViewerRow) => {
    if (!(await askConfirm(t('banConfirm', { name: viewer.name }), { title: t('banTitle'), confirmLabel: t('banYes'), cancelLabel: t('endNo'), tone: 'warning' }))) return
    await hostModerate(webinar.id, { ban: viewer.id })
    beat()
  }

  const giveVoice = async (viewerId: string | null) => {
    await hostSetSpeaker(webinar.id, viewerId)
    beat()
  }

  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const hands = viewers.filter((v) => v.hand && !v.speaking)
  const speaking = viewers.find((v) => v.speaking)
  const shareText = encodeURIComponent(`${webinar.title}\n${link}`)

  if (phase === 'ended') {
    return (
      <div className="rounded-3xl bg-[var(--ink)] p-6 text-center text-white">
        <Square className="mx-auto h-10 w-10 text-[var(--gold-bright)]" aria-hidden />
        <h2 className="mt-3 text-2xl font-extrabold">{t('endedTitle')}</h2>
        <p className="mt-2 text-white/70">{t('endedHostText')}</p>
        <button
          type="button"
          onClick={closeStudio}
          className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold-bright)] px-6 font-bold text-[var(--ink)]"
        >
          <X className="h-5 w-5" aria-hidden />
          {t('closeStudio')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <audio ref={speakerAudioRef} autoPlay className="hidden" />

      {/* Barra di stato */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-white">
        {phase === 'live' ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-700 px-3 py-1 text-xs font-extrabold">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" aria-hidden />
            {t('liveBadge')}
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-[var(--gold-bright)]">{t('notLiveBadge')}</span>
        )}
        {phase === 'live' && <span className="text-sm tabular-nums text-white/75">{clock}</span>}
        {reconnecting && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('reconnecting')}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-bold" title={t('connectedPeople')}>
          <Eye className="h-4 w-4" aria-hidden />
          {state?.viewers ?? 0} / {webinar.seats}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border-l-4 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {/* Anteprima */}
          <div className="relative aspect-video overflow-hidden rounded-3xl bg-[#2a2620]">
            <video ref={previewRef} autoPlay playsInline muted className={`h-full w-full ${screenOn ? 'object-contain' : 'object-cover'} ${!camOn && !screenOn ? 'hidden' : ''}`} />
            {!camOn && !screenOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3b352b] text-3xl font-extrabold text-[var(--gold-bright)]">{initials(hostName)}</span>
                <span className="text-sm">{mediaReady ? t('cameraOff') : t('previewHint')}</span>
              </div>
            )}
            <video
              ref={pipRef}
              autoPlay
              playsInline
              muted
              className={`absolute bottom-3 right-3 aspect-[3/4] w-24 rounded-xl border-2 border-[var(--gold-bright)] object-cover sm:w-32 ${screenOn && camOn ? '' : 'hidden'}`}
            />
            {phase === 'live' && (
              <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">{micOn ? t('youAreLive') : t('micMutedNote')}</span>
            )}
            {/* Chi ha la parola con la videocamera */}
            <div className={`absolute left-3 top-3 w-24 overflow-hidden rounded-xl border-2 border-emerald-400 bg-black sm:w-32 ${phase === 'live' && speakerVideoTrack ? '' : 'hidden'}`}>
              <video ref={speakerVideoRef} autoPlay playsInline muted className="aspect-[3/4] w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-center text-[11px] font-bold text-white">{speaking?.name}</span>
            </div>
          </div>

          {!mediaReady ? (
            <button
              type="button"
              onClick={openMedia}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-lg font-bold text-[var(--gold-bright)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
            >
              <Video className="h-5 w-5" aria-hidden />
              {t('openMedia')}
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={toggleMic} aria-pressed={!micOn} className={`${ctrl} ${micOn ? 'bg-[var(--ink)] text-white' : 'bg-red-700 text-white'}`}>
                {micOn ? <Mic className="h-5 w-5" aria-hidden /> : <MicOff className="h-5 w-5" aria-hidden />}
                {micOn ? t('micOn') : t('micOff')}
              </button>
              <button type="button" onClick={toggleCam} aria-pressed={!camOn} className={`${ctrl} ${camOn ? 'bg-[var(--ink)] text-white' : 'bg-[#4a443a] text-white'}`}>
                {camOn ? <Video className="h-5 w-5" aria-hidden /> : <VideoOff className="h-5 w-5" aria-hidden />}
                {camOn ? t('camOn') : t('camOff')}
              </button>
              <button
                type="button"
                onClick={toggleScreen}
                disabled={!screenAllowed}
                aria-pressed={screenOn}
                title={screenAllowed ? undefined : t('screenOnlyPc')}
                className={`${ctrl} ${screenOn ? 'bg-[var(--gold-bright)] text-[var(--ink)]' : 'bg-[var(--ink)] text-white'}`}
              >
                {screenOn ? <MonitorX className="h-5 w-5" aria-hidden /> : <MonitorUp className="h-5 w-5" aria-hidden />}
                {screenOn ? t('screenStop') : t('screenShare')}
              </button>
              {phase === 'live' ? (
                <button type="button" onClick={end} className={`${ctrl} bg-red-700 text-white`}>
                  <Square className="h-5 w-5" aria-hidden />
                  {t('end')}
                </button>
              ) : (
                <button type="button" onClick={start} disabled={phase === 'starting'} className={`${ctrl} bg-[var(--gold-bright)] text-[var(--ink)]`}>
                  {phase === 'starting' ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Radio className="h-5 w-5" aria-hidden />}
                  {webinar.status === 'live' ? t('resume') : t('goLive')}
                </button>
              )}
            </div>
          )}
          {!screenAllowed && mediaReady && <p className="text-xs text-[var(--muted)]">{t('screenOnlyPc')}</p>}
          <button
            type="button"
            onClick={closeStudio}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--ink)]/25 bg-white px-4 text-sm font-bold text-[var(--ink)] hover:bg-[var(--paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
          >
            <X className="h-4 w-4" aria-hidden />
            {t('closeStudio')}
          </button>
          {phase !== 'live' && <p className="rounded-2xl bg-[var(--gold-pale)] p-3 text-sm font-medium text-[var(--ink)]">{t('stayOnPage')}</p>}

          {/* Kumani invitati: avviso sul telefono con il link */}
          <WebinarInvites webinarId={webinar.id} />

          {/* Invito */}
          <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-4">
            <p className="text-sm font-bold">{t('inviteTitle')}</p>
            <p className="mt-1 break-all text-sm text-[var(--muted)]">{link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                <Copy className="h-4 w-4" aria-hidden />
                {copied ? t('copied') : t('copyLink')}
              </button>
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-4 text-sm font-bold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Persone, mani alzate e chat */}
        <div className="flex min-h-[420px] flex-col gap-3 lg:h-[640px]">
          {speaking && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/50 bg-emerald-50 p-3">
              <Volume2 className="h-5 w-5 text-emerald-700" aria-hidden />
              <p className="flex-1 text-sm">
                <WebinarName name={speaking.name} kumano={speaking.kumano} /> {t('isSpeaking')}
              </p>
              <button
                type="button"
                onClick={() => giveVoice(null)}
                className="min-h-10 rounded-full bg-[var(--ink)] px-3 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
              >
                {t('takeVoice')}
              </button>
            </div>
          )}
          {hands.map((v) => (
            <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-[var(--gold)]/50 bg-[var(--gold-pale)] p-3">
              <Hand className="h-5 w-5 text-[#7a5a14]" aria-hidden />
              <p className="flex-1 text-sm">
                <WebinarName name={v.name} kumano={v.kumano} /> {t('raisedHand')}
              </p>
              <button
                type="button"
                onClick={() => giveVoice(v.id)}
                disabled={phase !== 'live'}
                className="min-h-10 rounded-full bg-[var(--ink)] px-3 text-xs font-bold text-[var(--gold-bright)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
              >
                {t('giveVoice')}
              </button>
            </div>
          ))}

          <details className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold">
              <Users className="h-4 w-4" aria-hidden />
              {t('peopleTitle', { count: viewers.length })}
            </summary>
            <ul className="max-h-48 space-y-1 overflow-y-auto px-2 pb-2">
              {viewers.length === 0 && <li className="px-2 py-1 text-sm text-[var(--muted)]">{t('nobodyYet')}</li>}
              {viewers.map((v) => (
                <li key={v.id} className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm hover:bg-[var(--gold-pale)]">
                  <span className="min-w-0 flex-1">
                    <WebinarName name={v.name} kumano={v.kumano} />
                  </span>
                  <button
                    type="button"
                    onClick={() => ban(v)}
                    aria-label={t('banAria', { name: v.name })}
                    title={t('banTitle')}
                    className="rounded-full p-2 text-[var(--muted)] hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                  >
                    <UserX className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </details>

          <WebinarChat
            messages={messages}
            hiddenIds={state?.hiddenIds ?? []}
            onSend={sendMessage}
            onHide={async (id) => {
              await hostModerate(webinar.id, { hide: id })
              beat()
            }}
            title={t('chatTitle')}
            placeholder={t('chatHostPlaceholder')}
          />
        </div>
      </div>
    </div>
  )
}
