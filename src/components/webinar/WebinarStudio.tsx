'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Copy,
  Eye,
  Hand,
  Loader2,
  Maximize,
  Minimize,
  TriangleAlert,
  MessageSquare,
  MessageSquareOff,
  Mic,
  MicOff,
  MicVocal,
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
  Wallpaper,
  X,
} from 'lucide-react'
import {
  hostAnswer,
  hostBeat,
  hostEnd,
  hostIce,
  hostModerate,
  hostSetChat,
  hostSetTitle,
  hostSetOpenMic,
  hostPublish,
  hostPull,
  hostSendMessage,
  hostSetSpeaker,
} from '@/app/actions/webinar'
import { HOST_BEAT_MS, trackKind, voiceOwner, voiceTrackNames, type LiveState, type WebinarMessage, type WebinarStatus, type WebinarViewerRow } from '@/lib/webinar'
import { askConfirm } from '@/lib/confirm'
import WebinarChat from '@/components/webinar/WebinarChat'
import WebinarInvites from '@/components/webinar/WebinarInvites'
import WebinarName from '@/components/webinar/WebinarName'
import WebinarPrompter from '@/components/webinar/WebinarPrompter'
import { acceptOffer, initials, makeOffer, makePeer, useCanShareScreen, useMounted, useWakeLock, useWebinarChannel } from '@/components/webinar/rtc'
import { backgroundsSupported, type BackgroundChoice, useCameraBackground } from '@/components/webinar/background'
import { BackgroundPicker, CallButton, FaceStrip } from '@/components/webinar/WebinarControls'

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

export default function WebinarStudio({
  webinar,
  hostName,
  hostTitle: initialTitle,
}: {
  webinar: { id: string; code: string; title: string; startsAt: string; status: WebinarStatus; channelKey: string; seats: number }
  hostName: string
  // Ruolo accanto al nome (es. «Founder KUMANI»)
  hostTitle: string
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
  const [hostTitle, setHostTitle] = useState(initialTitle)
  const [titleSaved, setTitleSaved] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const screenAllowed = useCanShareScreen()
  const mounted = useMounted()

  const iceRef = useRef<RTCIceServer[] | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const tx = useRef<{ audio?: RTCRtpTransceiver; video?: RTCRtpTransceiver; screen?: RTCRtpTransceiver }>({})
  const micRef = useRef<MediaStreamTrack | null>(null)
  const camRef = useRef<MediaStreamTrack | null>(null)
  // Videocamera che si trasmette: con lo sfondo scelto, o la stessa di camRef
  const camOutRef = useRef<MediaStreamTrack | null>(null)
  const bg = useCameraBackground(24)
  const [bgOpen, setBgOpen] = useState(false)
  // Pannello a destra (come Meet): chat e persone si nascondono quando non servono
  const [chatVisible, setChatVisible] = useState(true)
  const [peopleVisible, setPeopleVisible] = useState(true)
  const [seenMessages, setSeenMessages] = useState(0)
  const screenRef = useRef<MediaStreamTrack | null>(null)
  const idleRef = useRef<{ video: MediaStreamTrack | null; screen: MediaStreamTrack | null }>({ video: null, screen: null })
  const flagsRef = useRef({ camOn: true, screenOn: false })
  const lastIdRef = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  const previewRef = useRef<HTMLVideoElement>(null)
  const pipRef = useRef<HTMLVideoElement>(null)
  // Voci di chi parla (un altoparlante per ognuno) e le loro videocamere
  const voicesRef = useRef(new Map<string, HTMLAudioElement>())
  const [faces, setFaces] = useState<{ name: string; stream: MediaStream }[]>([])
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
    const cam = camRef.current && camRef.current.readyState === 'live' ? (camOutRef.current ?? camRef.current) : null
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
  // Immagini che stanno ancora passando (condivisione dello schermo o
  // videocamera): sul computer continuano anche passando a un'altra finestra,
  // quindi chi guarda non deve leggere «si è allontanato». Sul telefono, in
  // secondo piano, le tracce si fermano (muted o finite).
  const mediaFlowing = () => {
    const flowing = (track: MediaStreamTrack | null | undefined) => !!track && track.readyState === 'live' && !track.muted && track.enabled
    return (flagsRef.current.screenOn && flowing(screenRef.current)) || (flagsRef.current.camOn && flowing(camRef.current))
  }

  const beat = useCallback(async () => {
    if (beatBusy.current && Date.now() - beatBusy.current < 12_000) {
      beatAgain.current = true
      return
    }
    beatBusy.current = Date.now()
    try {
      const res = await hostBeat(
        webinar.id,
        { paused: document.visibilityState !== 'visible' && !mediaFlowing(), camOn: flagsRef.current.camOn, screenOn: flagsRef.current.screenOn },
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
      camOutRef.current = await bg.wrap(camRef.current)
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
      bg.release()
      camOutRef.current = null
      camRef.current?.stop()
      camRef.current = null
      setBgOpen(false)
      await tx.current.video?.sender.replaceTrack(idle('video')).catch(() => {})
      setCamOn(false)
      refreshPreview()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: CAMERA })
      camRef.current = stream.getVideoTracks()[0]
      camOutRef.current = await bg.wrap(camRef.current)
      await tx.current.video?.sender.replaceTrack(camOutRef.current).catch(() => {})
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
    const cam = camRef.current?.readyState === 'live' ? (camOutRef.current ?? camRef.current) : null
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
    for (const el of voicesRef.current.values()) el.remove()
    voicesRef.current.clear()
    bg.release()
    micRef.current?.stop()
    camRef.current?.stop()
    screenRef.current?.stop()
    idleRef.current.video?.stop()
    idleRef.current.screen?.stop()
  }

  // Sfondo scelto: se cambia la traccia della videocamera, la si manda al posto della vecchia
  const chooseBackground = async (c: BackgroundChoice) => {
    const next = await bg.choose(c)
    if (next === undefined) return
    camOutRef.current = next
    await tx.current.video?.sender.replaceTrack(next ?? idle('video')).catch(() => {})
    refreshPreview()
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
            camOutRef.current = await bg.wrap(camRef.current)
            await tx.current.video?.sender.replaceTrack(camOutRef.current)
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

  // Chi parla (con la parola o con il microfono aperto a tutti): si ascolta
  // la sua voce e si vede la sua videocamera. Il collegamento si rifà quando
  // cambia chi parla.
  const listenKey = state ? voiceTrackNames(state, null).join('|') : ''
  useEffect(() => {
    if (phase !== 'live') return
    const current = listenRef.current
    if (current && current.track === listenKey) return
    current?.pc.close()
    listenRef.current = null
    for (const el of voicesRef.current.values()) el.remove()
    voicesRef.current.clear()
    setFaces([])
    const names = listenKey ? listenKey.split('|') : []
    if (names.length === 0 || !iceRef.current) return
    const pc = makePeer(iceRef.current)
    listenRef.current = { pc, track: listenKey }
    const midToName = new Map<string, string>()
    pc.ontrack = (e) => {
      const name = midToName.get(e.transceiver.mid ?? '') ?? ''
      if (trackKind(name) === 'face' || e.track.kind === 'video') {
        const stream = new MediaStream([e.track])
        setFaces((list) => [...list.filter((f) => f.name !== name), { name, stream }])
        return
      }
      const el = document.createElement('audio')
      el.autoplay = true
      el.srcObject = new MediaStream([e.track])
      voicesRef.current.get(name)?.remove()
      voicesRef.current.set(name, el)
      document.body.appendChild(el)
      el.play().catch(() => {})
    }
    ;(async () => {
      const res = await hostPull(webinar.id, null, names)
      if ('error' in res || listenRef.current?.pc !== pc) return
      for (const tr of res.tracks) midToName.set(tr.mid, tr.trackName)
      const answer = await acceptOffer(pc, res.offer)
      await hostAnswer(webinar.id, res.sessionId, answer)
    })().catch(() => {})
  }, [phase, listenKey, webinar.id])

  // Chiusura della pagina: si spegne tutto
  useEffect(() => {
    // Stesso oggetto per tutta la vita della pagina (cambiano solo i campi)
    const idleTracks = idleRef.current
    const voices = voicesRef.current
    return () => {
      for (const el of voices.values()) el.remove()
      voices.clear()
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

  // Togliere dal webinar e, se si vuole, segnalare: se la stessa connessione
  // entra in un altro webinar, chi presenta viene avvisato
  const ban = async (viewer: WebinarViewerRow) => {
    if (!(await askConfirm(t('banConfirm', { name: viewer.name }), { title: t('banTitle'), confirmLabel: t('banYes'), cancelLabel: t('endNo'), tone: 'warning' }))) return
    const report = await askConfirm(t('reportConfirm', { name: viewer.name }), { title: t('reportTitle'), confirmLabel: t('reportYes'), cancelLabel: t('reportNo'), tone: 'warning' })
    await hostModerate(webinar.id, { ban: viewer.id, report })
    beat()
  }

  const toggleViewerCam = async (viewer: WebinarViewerRow) => {
    await hostModerate(webinar.id, { cam: viewer.id, camOff: !viewer.camBlocked })
    beat()
  }

  // Regia a schermo intero (computer): anteprima, persone e chat in una vista
  const studioRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === studioRef.current && !!studioRef.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else studioRef.current?.requestFullscreen?.().catch(() => {})
  }

  // Spegne il microfono di chi parla con il microfono aperto
  const muteVoice = async (viewer: WebinarViewerRow) => {
    await hostModerate(webinar.id, { mute: viewer.id })
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
  const chatOpen = state?.chatOpen !== false
  const openMic = !!state?.openMic
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

  // Messaggi arrivati con la chat nascosta (numero sul pulsante «Chat»)
  const shownMessages = messages.filter((m) => !(state?.hiddenIds ?? []).includes(m.id)).length
  const unread = chatVisible ? 0 : Math.max(0, shownMessages - seenMessages)
  const toggleChat = () => {
    if (chatVisible) setSeenMessages(shownMessages)
    setChatVisible(!chatVisible)
  }
  const panelOpen = chatVisible || peopleVisible
  const faceTiles = phase === 'live' ? faces.map((f) => ({ key: f.name, label: voiceOwner(state, f.name) ?? '', stream: f.stream })) : []
  const panelHeight = isFullscreen ? 'lg:h-[calc(100vh-7rem)]' : 'lg:h-[640px]'

  // Chi parla e mani alzate: nel pannello, o sopra l'immagine se il pannello è chiuso
  const notices = (compact: boolean) => (
    <>
      {speaking && (
        <div className={`flex items-center gap-3 rounded-2xl border border-emerald-400/50 ${compact ? 'bg-emerald-950/85 p-2 text-white' : 'bg-emerald-50 p-3'}`}>
          <Volume2 className={`h-5 w-5 ${compact ? 'text-emerald-300' : 'text-emerald-700'}`} aria-hidden />
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
        <div key={v.id} className={`flex items-center gap-3 rounded-2xl border border-[var(--gold)]/50 ${compact ? 'bg-black/80 p-2 text-white' : 'bg-[var(--gold-pale)] p-3'}`}>
          <Hand className={`h-5 w-5 ${compact ? 'text-[var(--gold-bright)]' : 'text-[#7a5a14]'}`} aria-hidden />
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
    </>
  )

  return (
    <div ref={studioRef} className={`space-y-4 ${isFullscreen ? 'overflow-y-auto bg-[var(--background)] p-4' : ''}`}>
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
        <button
          type="button"
          onClick={toggleFullscreen}
          className="hidden min-h-9 items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 sm:inline-flex"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" aria-hidden /> : <Maximize className="h-4 w-4" aria-hidden />}
          {isFullscreen ? t('studioExitFullscreen') : t('studioFullscreen')}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border-l-4 border-red-500 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-3">
          {/* Gobbo: il testo da dire, visibile solo a chi presenta */}
          <WebinarPrompter webinarId={webinar.id} />
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
            {!panelOpen && (speaking || hands.length > 0) && <div className="absolute inset-x-3 top-3 max-h-[60%] space-y-2 overflow-y-auto">{notices(true)}</div>}
          </div>

          {/* Videocamere di chi parla, sul telefono: sotto l'immagine */}
          <FaceStrip tiles={faceTiles} className="flex lg:hidden" />

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
            <div className="relative">
              {bgOpen && (
                <div className="absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2">
                  <BackgroundPicker value={bg.choice} onChange={chooseBackground} onClose={() => setBgOpen(false)} busy={bg.busy} error={bg.failed ? t('bgError') : null} />
                </div>
              )}
              {/* Barra dei comandi, come Meet e Zoom */}
              <div className="flex flex-wrap items-start justify-center gap-x-1 gap-y-3 rounded-3xl bg-[var(--ink)] px-2 py-3">
                <CallButton icon={micOn ? Mic : MicOff} label={micOn ? t('micOn') : t('micOff')} onClick={toggleMic} tone={micOn ? 'normal' : 'off'} pressed={!micOn} />
                <CallButton icon={camOn ? Video : VideoOff} label={camOn ? t('camOn') : t('camOff')} onClick={toggleCam} tone={camOn ? 'normal' : 'off'} pressed={!camOn} />
                <CallButton
                  icon={Wallpaper}
                  label={t('bgButton')}
                  onClick={() => setBgOpen(!bgOpen)}
                  disabled={!camOn || !backgroundsSupported()}
                  tone={bg.active && camOn ? 'selected' : 'normal'}
                  pressed={bgOpen}
                  busy={bg.busy}
                />
                <CallButton
                  icon={screenOn ? MonitorX : MonitorUp}
                  label={screenOn ? t('screenStop') : t('screenShare')}
                  onClick={toggleScreen}
                  disabled={!screenAllowed}
                  tone={screenOn ? 'selected' : 'normal'}
                  pressed={screenOn}
                />
                <CallButton icon={MessageSquare} label={t('chatButton')} onClick={toggleChat} tone={chatVisible ? 'selected' : 'normal'} pressed={chatVisible} badge={unread} />
                <CallButton icon={Users} label={t('peopleButton')} onClick={() => setPeopleVisible(!peopleVisible)} tone={peopleVisible ? 'selected' : 'normal'} pressed={peopleVisible} badge={hands.length} />
                {phase === 'live' ? (
                  <CallButton icon={Square} label={t('end')} onClick={end} tone="danger" />
                ) : (
                  <CallButton
                    icon={Radio}
                    label={webinar.status === 'live' ? t('resume') : t('goLive')}
                    onClick={start}
                    disabled={phase === 'starting'}
                    busy={phase === 'starting'}
                    tone="active"
                  />
                )}
              </div>
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

          {/* Ruolo accanto al nome: pagina dell'invito, chat e avvisi */}
          <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-4">
            <label htmlFor="host-title" className="text-sm font-bold">
              {t('hostTitleLabel')}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="host-title"
                value={hostTitle}
                maxLength={60}
                onChange={(e) => {
                  setHostTitle(e.target.value)
                  setTitleSaved(false)
                }}
                onBlur={async () => {
                  const res = await hostSetTitle(webinar.id, hostTitle)
                  if ('success' in res) {
                    setHostTitle(res.title ?? '')
                    setTitleSaved(true)
                  }
                }}
                placeholder={t('hostTitlePlaceholder')}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              {titleSaved ? '✓ ' : ''}
              {t('hostTitlePreview', { name: hostTitle.trim() ? `${hostName} · ${hostTitle.trim()}` : hostName })}
            </p>
          </div>

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

        {/* Pannello: chi parla, mani alzate, persone e chat (si nasconde) */}
        {panelOpen && (
          <div className={`flex flex-col gap-3 lg:w-[340px] lg:shrink-0 ${chatVisible ? `min-h-[420px] ${panelHeight}` : 'lg:self-start'}`}>
            {notices(false)}

            {peopleVisible && (
              <>
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
                          {v.flagged && (
                            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800" title={t('flaggedHint')}>
                              <TriangleAlert className="h-3 w-3" aria-hidden /> {t('flagged')}
                            </span>
                          )}
                        </span>
                        {(v.talking || v.speaking || v.camBlocked) && (
                          <button
                            type="button"
                            onClick={() => toggleViewerCam(v)}
                            aria-label={v.camBlocked ? t('camAllowAria', { name: v.name }) : t('camOffAria', { name: v.name })}
                            title={v.camBlocked ? t('camAllowTitle') : t('camOffTitle')}
                            className={`rounded-full p-2 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)] ${v.camBlocked ? 'text-red-700' : 'text-emerald-700 hover:text-red-700'}`}
                          >
                            {v.camBlocked ? <VideoOff className="h-4 w-4" aria-hidden /> : <Video className="h-4 w-4" aria-hidden />}
                          </button>
                        )}
                        {v.talking && (
                          <button
                            type="button"
                            onClick={() => muteVoice(v)}
                            aria-label={t('muteAria', { name: v.name })}
                            title={t('muteTitle')}
                            className="rounded-full p-2 text-emerald-700 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
                          >
                            <Mic className="h-4 w-4" aria-hidden />
                          </button>
                        )}
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

                {/* Microfono e video aperti a tutti: nessuno deve chiedere la parola */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={openMic}
                  disabled={phase !== 'live'}
                  onClick={async () => {
                    await hostSetOpenMic(webinar.id, !openMic)
                    beat()
                  }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] px-4 text-left text-sm font-bold disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <MicVocal className="h-4 w-4 shrink-0" aria-hidden />
                    {openMic ? t('openMicOn') : t('openMicOff')}
                  </span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${openMic ? 'bg-emerald-600' : 'bg-gray-400'}`} aria-hidden>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${openMic ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>

                {/* Chat di chi guarda: aperta o chiusa */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={chatOpen}
                  onClick={async () => {
                    await hostSetChat(webinar.id, !chatOpen)
                    beat()
                  }}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] px-4 text-sm font-bold"
                >
                  <span className="flex items-center gap-2">
                    {chatOpen ? <MessageSquare className="h-4 w-4" aria-hidden /> : <MessageSquareOff className="h-4 w-4" aria-hidden />}
                    {chatOpen ? t('chatOpenForViewers') : t('chatClosedForViewers')}
                  </span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${chatOpen ? 'bg-emerald-600' : 'bg-gray-400'}`} aria-hidden>
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${chatOpen ? 'left-[22px]' : 'left-0.5'}`} />
                  </span>
                </button>
              </>
            )}

            {chatVisible && (
              <WebinarChat
                messages={messages}
                hiddenIds={state?.hiddenIds ?? []}
                onSend={sendMessage}
                onHide={async (id) => {
                  await hostModerate(webinar.id, { hide: id })
                  beat()
                }}
                onClose={toggleChat}
                title={t('chatTitle')}
                placeholder={t('chatHostPlaceholder')}
              />
            )}
          </div>
        )}

        {/* Videocamere di chi parla, sul computer: riquadri piccoli a destra della chat */}
        <FaceStrip tiles={faceTiles} className={`hidden lg:flex lg:w-28 lg:shrink-0 ${panelHeight}`} />
      </div>
    </div>
  )
}
