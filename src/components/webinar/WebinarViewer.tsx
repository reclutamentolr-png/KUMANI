'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Hand, Loader2, LogOut, Maximize, Mic, Minimize, MicOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react'
import {
  joinWebinar,
  viewerAnswer,
  viewerHand,
  viewerPoll,
  viewerPull,
  viewerSend,
  viewerSpeak,
  viewerStopSpeak,
} from '@/app/actions/webinar'
import { trackKind, VIEWER_POLL_MS, voiceOwner, voiceTrackNames, WEBINAR_NAME_MAX, type LiveState, type WebinarMessage, type WebinarStatus } from '@/lib/webinar'
import WebinarChat from '@/components/webinar/WebinarChat'
import { acceptOffer, initials, makeOffer, makePeer, useMounted, useWakeLock, useWebinarChannel } from '@/components/webinar/rtc'

type Phase = 'name' | 'joining' | 'in' | 'full' | 'banned' | 'ended' | 'gone'
type Saved = { token: string; name: string }

const storageKey = (code: string) => `kumani.webinar.${code}`

function readSaved(code: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(code))
    const data = raw ? (JSON.parse(raw) as Saved) : null
    return data && typeof data.token === 'string' && typeof data.name === 'string' ? data : null
  } catch {
    return null
  }
}

function writeSaved(code: string, saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(storageKey(code), JSON.stringify(saved))
    else localStorage.removeItem(storageKey(code))
  } catch {
    // Memoria del browser non disponibile: si rientra scrivendo di nuovo il nome
  }
}

export default function WebinarViewer({
  code,
  title,
  hostName,
  startsAt,
  initialStatus,
  suggestedName,
}: {
  code: string
  title: string
  hostName: string
  startsAt: string
  initialStatus: WebinarStatus
  suggestedName: string
}) {
  const t = useTranslations('webinar')
  const [phase, setPhase] = useState<Phase>(initialStatus === 'ended' ? 'ended' : 'name')
  const [name, setName] = useState(suggestedName)
  const [error, setError] = useState<string | null>(null)
  const [channelKey, setChannelKey] = useState<string | null>(null)
  const [state, setState] = useState<LiveState | null>(null)
  const [messages, setMessages] = useState<WebinarMessage[]>([])
  const [hand, setHand] = useState(false)
  const [mayspeak, setMayspeak] = useState(false)
  // Microfono acceso con il microfono aperto a tutti (secondo il server)
  const [myVoice, setMyVoice] = useState(false)
  // Videocamera spenta da chi presenta: si parla solo con la voce
  const [camBlocked, setCamBlocked] = useState(false)
  const [speakingOn, setSpeakingOn] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const mounted = useMounted()

  const tokenRef = useRef<string | null>(null)
  // Chi sono in questo webinar: le proprie voce e videocamera non si ricevono
  const myIdRef = useRef<string | null>(null)
  const iceRef = useRef<RTCIceServer[]>([])
  const lastIdRef = useRef(0)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const hostSessionRef = useRef<string | null>(null)
  const pulledRef = useRef(new Set<string>())
  const midToName = useRef(new Map<string, string>())
  const syncingRef = useRef(false)
  const pendingRef = useRef(false)
  const stateRef = useRef<LiveState | null>(null)
  const repairTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollBusy = useRef(0)
  // Avviso arrivato mentre un controllo era già in corso: se ne fa un altro subito dopo
  const pollAgain = useRef(false)
  // Chi ha la parola: collegamento, voce e (se accesa) videocamera
  const speakRef = useRef<{ pc: RTCPeerConnection; tracks: MediaStreamTrack[]; video: MediaStreamTrack | null; at: number } | null>(null)
  const [selfVideo, setSelfVideo] = useState<MediaStream | null>(null)
  // Videocamere di chi parla (chi ha la parola e chi parla con il microfono aperto)
  const [faces, setFaces] = useState<{ name: string; stream: MediaStream }[]>([])
  // Voci di chi parla: un altoparlante per ognuno
  const voicesRef = useRef(new Map<string, HTMLAudioElement>())

  const stageRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLVideoElement>(null)
  const pipRef = useRef<HTMLVideoElement>(null)
  const hostAudioRef = useRef<HTMLAudioElement>(null)
  const tracksRef = useRef<{ video?: MediaStreamTrack; screen?: MediaStreamTrack }>({})

  // ── Video e audio della diretta ─────────────────────────────────────
  const play = (el: HTMLMediaElement | null) => {
    el?.play().catch(() => setNeedsTap(true))
  }

  const showVideo = useCallback(() => {
    const s = stateRef.current
    const cam = s?.camOn ? tracksRef.current.video : undefined
    const screen = s?.screenOn ? tracksRef.current.screen : undefined
    const set = (el: HTMLVideoElement | null, track: MediaStreamTrack | undefined) => {
      if (!el) return
      const current = (el.srcObject as MediaStream | null)?.getVideoTracks()[0]
      if (current === track) return
      el.srcObject = track ? new MediaStream([track]) : null
      // Quale traccia mostra (utile anche per le prove automatiche)
      el.dataset.track = !track ? '' : track === tracksRef.current.screen ? 'screen' : 'video'
      if (track) el.play().catch(() => {})
    }
    set(mainRef.current, screen ?? cam)
    set(pipRef.current, screen ? cam : undefined)
  }, [])

  const resetPeer = useCallback(() => {
    pcRef.current?.close()
    pcRef.current = null
    pulledRef.current.clear()
    midToName.current.clear()
    tracksRef.current = {}
    if (hostAudioRef.current) hostAudioRef.current.srcObject = null
    for (const el of voicesRef.current.values()) {
      el.srcObject = null
      el.remove()
    }
    voicesRef.current.clear()
    setFaces([])
    showVideo()
  }, [showVideo])

  // Riceve le tracce che mancano (all'inizio, quando chi presenta riparte,
  // quando qualcuno ha la parola)
  const syncTracks = useCallback(async () => {
    const s = stateRef.current
    const token = tokenRef.current
    if (!token) return
    if (!s || s.status !== 'live' || !s.hostSession) {
      if (pcRef.current) resetPeer()
      hostSessionRef.current = null
      return
    }
    if (syncingRef.current) {
      pendingRef.current = true
      return
    }
    let fresh = false
    if (hostSessionRef.current !== s.hostSession) {
      resetPeer()
      hostSessionRef.current = s.hostSession
      retries.current = 0
      fresh = true
    }
    // Videocamera e schermo solo quando trasmettono: una traccia senza immagini
    // fa aspettare Cloudflare diversi secondi prima di rispondere
    // Le proprie voce e videocamera non si ricevono: il server le rifiuterebbe
    // e la richiesta si ripeterebbe all'infinito («Riconnessione…» fisso)
    const wanted = [s.tracks.audio, s.camOn ? s.tracks.video : undefined, s.screenOn ? s.tracks.screen : undefined, ...voiceTrackNames(s, myIdRef.current)].filter(
      (x): x is string => !!x
    )
    const allMissing = wanted.filter((n) => !pulledRef.current.has(n))
    if (allMissing.length === 0) return
    // Al massimo 12 alla volta: le altre al giro dopo
    const missing = allMissing.slice(0, 12)
    if (allMissing.length > missing.length) pendingRef.current = true
    syncingRef.current = true
    // Aggiungere una traccia a un collegamento già attivo non è una riconnessione
    if (!pcRef.current || pcRef.current.connectionState !== 'connected') setConnecting(true)
    try {
      if (!pcRef.current) {
        fresh = true
        const pc = makePeer(iceRef.current)
        pcRef.current = pc
        pc.ontrack = (e) => {
          const trackName = midToName.current.get(e.transceiver.mid ?? '') ?? ''
          const kind = trackKind(trackName)
          if (kind === 'audio' && hostAudioRef.current) {
            hostAudioRef.current.srcObject = new MediaStream([e.track])
            play(hostAudioRef.current)
          } else if (kind === 'voice') {
            let el = voicesRef.current.get(trackName)
            if (!el) {
              el = document.createElement('audio')
              el.autoplay = true
              voicesRef.current.set(trackName, el)
              document.body.appendChild(el)
            }
            el.srcObject = new MediaStream([e.track])
            play(el)
          } else if (kind === 'video' || kind === 'screen') {
            tracksRef.current[kind] = e.track
            showVideo()
          } else if (kind === 'face') {
            const stream = new MediaStream([e.track])
            setFaces((list) => [...list.filter((f) => f.name !== trackName), { name: trackName, stream }])
          }
        }
        pc.onconnectionstatechange = () => {
          if (pcRef.current !== pc) return
          const st = pc.connectionState
          if (st === 'connected') {
            setConnecting(false)
            if (repairTimer.current) clearTimeout(repairTimer.current)
            repairTimer.current = null
          } else if (st === 'failed') repair(1000)
          else if (st === 'disconnected') repair(5000)
        }
      }
      const pc = pcRef.current
      const res = await viewerPull(code, token, missing, fresh)
      if ('error' in res) {
        if (res.error === 'banned') setPhase('banned')
        // Chi presenta si sta ancora collegando: si riprova tra poco
        else if (res.error === 'not_ready' || res.error === 'realtime') retrySoon()
        return
      }
      if (pcRef.current !== pc) return
      for (const tr of res.tracks) midToName.current.set(tr.mid, tr.trackName)
      const answer = await acceptOffer(pc, res.offer)
      const ok = await viewerAnswer(code, token, answer)
      if ('error' in ok) return
      for (const tr of res.tracks) pulledRef.current.add(tr.trackName)
      if (res.notReady > 0) retrySoon()
      if (pc.connectionState === 'connected') setConnecting(false)
    } catch {
      repair(2000)
    } finally {
      syncingRef.current = false
      if (pcRef.current?.connectionState === 'connected') setConnecting(false)
      if (pendingRef.current) {
        pendingRef.current = false
        syncTracks()
      }
    }
    // repair usa solo ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, resetPeer, showVideo])

  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retries = useRef(0)
  function retrySoon() {
    if (retryTimer.current || retries.current >= 8) return
    retries.current++
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null
      syncTracks()
    }, 1500)
  }

  // Collegamento caduto (rete cambiata, app in secondo piano): si riparte
  function repair(delay: number) {
    if (repairTimer.current) return
    setConnecting(true)
    repairTimer.current = setTimeout(() => {
      repairTimer.current = null
      const pc = pcRef.current
      if (pc && pc.connectionState === 'connected') {
        setConnecting(false)
        return
      }
      resetPeer()
      hostSessionRef.current = null
      syncTracks()
    }, delay)
  }

  // ── Stato e chat ────────────────────────────────────────────────────
  const applyState = useCallback(
    (s: LiveState) => {
      stateRef.current = s
      setState(s)
      if (s.status === 'ended') {
        resetPeer()
        setPhase('ended')
        return
      }
      showVideo()
      syncTracks()
    },
    [resetPeer, showVideo, syncTracks]
  )

  const poll = useCallback(async () => {
    const token = tokenRef.current
    if (!token) return
    if (pollBusy.current && Date.now() - pollBusy.current < 12_000) {
      pollAgain.current = true
      return
    }
    pollBusy.current = Date.now()
    try {
      const res = await viewerPoll(code, token, lastIdRef.current)
      if ('error' in res) {
        if (res.error === 'banned') {
          resetPeer()
          setPhase('banned')
        } else if (res.error === 'not_found') {
          resetPeer()
          setPhase('gone')
        }
        return
      }
      if (res.messages.length) {
        lastIdRef.current = res.messages[res.messages.length - 1].id
        setMessages((list) => [...list, ...res.messages].slice(-300))
      }
      setHand(res.me.hand)
      setMayspeak(res.me.speaking)
      setMyVoice(res.me.voice)
      setCamBlocked(res.me.camBlocked)
      applyState(res.state)
    } catch {
      // Rete assente: si riprova al giro successivo
    } finally {
      pollBusy.current = 0
      if (pollAgain.current) {
        pollAgain.current = false
        poll()
      }
    }
  }, [code, applyState, resetPeer])

  useWebinarChannel(phase === 'in' ? channelKey : null, () => {
    poll()
  })

  useEffect(() => {
    if (phase !== 'in') return
    const timer = setInterval(poll, VIEWER_POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      // Al ritorno: stato aggiornato e, se serve, collegamento nuovo
      const pc = pcRef.current
      if (pc && pc.connectionState !== 'connected' && pc.connectionState !== 'connecting') repair(0)
      play(hostAudioRef.current)
      poll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, poll])

  // Orologio del conto alla rovescia (sala d'attesa)
  useEffect(() => {
    if (phase !== 'name' && phase !== 'joining' && phase !== 'in') return
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(clock)
  }, [phase])

  useWakeLock(phase === 'in' && state?.status === 'live')

  // ── Entrare ─────────────────────────────────────────────────────────
  const join = useCallback(
    async (joinName: string, token: string | null) => {
      setError(null)
      setPhase('joining')
      try {
        const res = await joinWebinar(code, joinName, token)
        if ('error' in res) {
          if (res.error === 'full') setPhase('full')
          else if (res.error === 'banned') setPhase('banned')
          else if (res.error === 'ended') setPhase('ended')
          else if (res.error === 'not_found') setPhase('gone')
          else {
            setPhase('name')
            setError(res.error === 'name' ? t('errorName') : t('errorGeneric'))
          }
          return
        }
        tokenRef.current = res.token
        myIdRef.current = res.viewerId
        iceRef.current = res.ice
        writeSaved(code, { token: res.token, name: joinName })
        setChannelKey(res.channelKey)
        setPhase('in')
        applyState(res.state)
        poll()
      } catch {
        setPhase('name')
        setError(t('errorGeneric'))
      }
    },
    [code, t, applyState, poll]
  )

  // Chi era già entrato (stesso browser) rientra senza riscrivere il nome
  useEffect(() => {
    if (initialStatus === 'ended') return
    const saved = readSaved(code)
    if (!saved) return
    // Dati del browser: si leggono solo dopo il primo disegno
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(saved.name)
    join(saved.name, saved.token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const leave = () => {
    resetPeer()
    stopSpeaking(false)
    writeSaved(code, null)
    tokenRef.current = null
    setChannelKey(null)
    setPhase('name')
  }

  // ── Alzare la mano e parlare ────────────────────────────────────────
  const toggleHand = async () => {
    const token = tokenRef.current
    if (!token) return
    const next = !hand
    setHand(next)
    const res = await viewerHand(code, token, next)
    if ('error' in res) setHand(!next)
  }

  // withVideo: anche la videocamera (se non si apre, si parla solo con la voce)
  const startSpeaking = async (withVideo: boolean) => {
    const token = tokenRef.current
    if (!token || speakRef.current) return
    try {
      const audioWanted = { echoCancellation: true, noiseSuppression: true }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          withVideo ? { audio: audioWanted, video: mayspeak ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } } } : { audio: audioWanted }
        )
      } catch (e) {
        if (!withVideo) throw e
        stream = await navigator.mediaDevices.getUserMedia({ audio: audioWanted })
        setError(t('errorNoCamSpeak'))
      }
      const track = stream.getAudioTracks()[0]
      const video = stream.getVideoTracks()[0] ?? null
      const pc = makePeer(iceRef.current)
      const transceiver = pc.addTransceiver(track, { direction: 'sendonly' })
      const videoTransceiver = video ? pc.addTransceiver(video, { direction: 'sendonly' }) : null
      speakRef.current = { pc, tracks: stream.getTracks(), video, at: Date.now() }
      const offer = await makeOffer(pc)
      const res = await viewerSpeak(code, token, offer, transceiver.mid ?? '', videoTransceiver?.mid ?? null)
      if ('error' in res) {
        stopSpeaking(false)
        if (res.error === 'too_many_voices') setError(t('errorTooManyVoices'))
        else if (res.error === 'cam_blocked') setError(t('camBlockedNote'))
        return
      }
      await pc.setRemoteDescription(res.answer)
      setSelfVideo(video ? new MediaStream([video]) : null)
      setSpeakingOn(true)
    } catch {
      stopSpeaking(false)
      setError(t('errorNoMic'))
    }
  }

  // Videocamera accesa o spenta mentre si parla (la voce continua)
  const [selfCamOff, setSelfCamOff] = useState(false)
  const toggleSelfCam = () => {
    const video = speakRef.current?.video
    if (!video) return
    video.enabled = !video.enabled
    setSelfCamOff(!video.enabled)
  }

  function stopSpeaking(tellServer: boolean) {
    const current = speakRef.current
    speakRef.current = null
    current?.tracks.forEach((track) => track.stop())
    current?.pc.close()
    setSelfVideo(null)
    setSelfCamOff(false)
    setSpeakingOn(false)
    if (tellServer && tokenRef.current) viewerStopSpeak(code, tokenRef.current).then(() => poll())
  }

  // La parola tolta, il microfono aperto a tutti richiuso o il proprio
  // microfono spento da chi presenta: si chiude il microfono qui
  const openMic = !!state?.openMic && state.status === 'live'
  const canSpeak = mayspeak || openMic
  useEffect(() => {
    const current = speakRef.current
    if (!current) return
    // Appena acceso il server può non saperlo ancora: si aspetta qualche secondo
    const mutedByHost = !mayspeak && openMic && !myVoice && Date.now() - current.at > 8000
    if (!canSpeak || mutedByHost) stopSpeaking(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mayspeak, openMic, myVoice, canSpeak])

  // Chi presenta ha spento la videocamera: si spegne qui, la voce continua
  useEffect(() => {
    const video = speakRef.current?.video
    if (!camBlocked || !video) return
    video.stop()
    speakRef.current!.video = null
    // Il cambio arriva dal server: si toglie l'anteprima della propria videocamera
    setSelfVideo(null)
  }, [camBlocked])

  useEffect(() => {
    const voices = voicesRef.current
    return () => {
      pcRef.current?.close()
      speakRef.current?.pc.close()
      speakRef.current?.tracks.forEach((track) => track.stop())
      for (const el of voices.values()) el.remove()
      voices.clear()
    }
  }, [])

  // Schermo intero: si entra e si esce con lo stesso pulsante (dentro
  // l'immagine c'è «Riduci», perché fuori non si vede più nulla)
  const [isFullscreen, setIsFullscreen] = useState(false)
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const fullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
      return
    }
    const stage = stageRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null
    const video = mainRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (stage?.requestFullscreen) stage.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.())
    else video?.webkitEnterFullscreen?.()
  }

  const unmute = () => {
    setNeedsTap(false)
    play(hostAudioRef.current)
    for (const el of voicesRef.current.values()) play(el)
    play(mainRef.current)
  }

  const sendMessage = async (body: string) => {
    const token = tokenRef.current
    if (!token) return t('errorGeneric')
    const res = await viewerSend(code, token, body)
    if ('error' in res) return res.error === 'too_fast' ? t('errorTooFast') : res.error === 'chat_closed' ? t('chatClosedNote') : t('errorGeneric')
    poll()
    return null
  }

  // ── Schermate ───────────────────────────────────────────────────────
  const startTime = new Date(startsAt).getTime()
  // Conto alla rovescia solo nel browser (l'ora del server è diversa)
  const left = mounted ? Math.max(0, Math.floor((startTime - now) / 1000)) : 0
  const countdown =
    left >= 3600
      ? `${Math.floor(left / 3600)}:${String(Math.floor((left % 3600) / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
      : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`

  if (phase === 'ended' || phase === 'gone' || phase === 'banned' || phase === 'full') {
    const text = {
      ended: [t('endedTitle'), t('endedViewerText')],
      gone: [t('goneTitle'), t('goneText')],
      banned: [t('bannedTitle'), t('bannedText')],
      full: [t('fullTitle'), t('fullText')],
    }[phase]
    return (
      <div className="rounded-3xl border border-[var(--gold)]/35 bg-white/5 p-6 text-center">
        <h2 className="text-2xl font-extrabold">{text[0]}</h2>
        <p className="mt-2 text-white/75">{text[1]}</p>
        {phase === 'full' && (
          <button
            type="button"
            onClick={() => join(name, readSaved(code)?.token ?? null)}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--gold-bright)] px-6 font-bold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t('tryAgain')}
          </button>
        )}
      </div>
    )
  }

  if (phase === 'name' || phase === 'joining') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) join(name.trim(), readSaved(code)?.token ?? null)
        }}
        className="space-y-5"
      >
        {initialStatus !== 'live' && left > 0 && (
          <div className="rounded-3xl border border-[var(--gold)]/35 bg-white/5 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/70">{t('startsIn')}</p>
            <p className="mt-1 text-5xl font-extrabold tabular-nums text-[var(--gold-bright)]">{countdown}</p>
          </div>
        )}
        <div>
          <label htmlFor="webinar-name" className="mb-1.5 block text-sm font-bold">
            {t('yourName')}
          </label>
          <input
            id="webinar-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={WEBINAR_NAME_MAX}
            autoComplete="given-name"
            required
            className="min-h-12 w-full rounded-2xl border border-white/25 bg-white/5 px-4 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
          <p className="mt-1.5 text-xs text-white/65">{t('nameHint', { host: hostName })}</p>
        </div>
        <ul className="space-y-2 text-sm text-white/85">
          <li>• {t('ruleNoCamera')}</li>
          <li>• {t('ruleChat')}</li>
          <li>• {t('ruleNoInstall')}</li>
        </ul>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-300">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={phase === 'joining' || !name.trim()}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--gold-bright)] px-6 text-lg font-extrabold text-[var(--ink)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {phase === 'joining' && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
          {initialStatus === 'live' ? t('joinLive') : t('joinWaiting')}
        </button>
      </form>
    )
  }

  // Dentro il webinar
  const live = state?.status === 'live'
  const showMain = live && (state?.screenOn || state?.camOn)
  // Riquadri di chi parla: la propria videocamera e quelle che arrivano adesso
  const liveFaces = live && state ? faces.filter((f) => voiceTrackNames(state, myIdRef.current).includes(f.name)) : []
  const talkingNames = (state?.voices ?? []).filter((v) => v.id !== myIdRef.current).map((v) => v.name)
  return (
    <div className="space-y-3">
      <audio ref={hostAudioRef} autoPlay className="hidden" />

      <div ref={stageRef} className="relative -mx-4 aspect-video overflow-hidden bg-[#2a2620] sm:mx-0 sm:rounded-3xl">
        <video ref={mainRef} autoPlay playsInline muted className={`h-full w-full ${state?.screenOn ? 'object-contain' : 'object-cover'} ${showMain ? '' : 'hidden'}`} />
        <video
          ref={pipRef}
          autoPlay
          playsInline
          muted
          className={`absolute bottom-3 right-3 aspect-[3/4] w-20 rounded-xl border-2 border-[var(--gold-bright)] object-cover sm:w-28 ${live && state?.screenOn && state?.camOn ? '' : 'hidden'}`}
        />
        {!showMain && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white/75">
            {live ? (
              <>
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#3b352b] text-3xl font-extrabold text-[var(--gold-bright)]">{initials(hostName)}</span>
                <span className="text-sm">{t('audioOnly')}</span>
              </>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.14em]">{left > 0 ? t('startsIn') : t('aboutToStart')}</p>
                {left > 0 && <p className="text-5xl font-extrabold tabular-nums text-[var(--gold-bright)]">{countdown}</p>}
                <p className="text-sm">{t('waitingAuto')}</p>
              </>
            )}
          </div>
        )}
        {live && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-700 px-2.5 py-1 text-[11px] font-extrabold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
            {t('liveBadge')}
          </span>
        )}
        {live && state?.hostAway && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/65 p-6 text-center text-sm font-semibold text-white">{t('hostAway')}</div>
        )}
        {live && connecting && !state?.hostAway && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('reconnecting')}
          </div>
        )}
        {isFullscreen && (
          <button
            type="button"
            onClick={fullscreen}
            className="absolute right-3 top-3 z-[2] inline-flex min-h-11 items-center gap-2 rounded-full bg-black/70 px-4 text-sm font-bold text-white"
          >
            <Minimize className="h-5 w-5" aria-hidden />
            {t('exitFullscreen')}
          </button>
        )}
        {needsTap && live && (
          <button
            type="button"
            onClick={unmute}
            className="absolute inset-x-0 bottom-0 m-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold-bright)] font-extrabold text-[var(--ink)]"
          >
            <VolumeX className="h-5 w-5" aria-hidden />
            {t('tapForSound')}
          </button>
        )}
      </div>

      <div>
        <h2 className="text-lg font-extrabold leading-snug">{title}</h2>
        <p className="text-sm text-white/70">
          {t('withHost', { host: hostName })}
          {live && ` · ${t('connectedCount', { count: state?.viewers ?? 0 })}`}
        </p>
      </div>

      {canSpeak && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-400/60 bg-emerald-500/15 p-3">
          <Volume2 className="h-5 w-5 text-emerald-300" aria-hidden />
          <p className="min-w-0 flex-1 text-sm font-semibold">{speakingOn ? t('youAreSpeaking') : mayspeak ? t('youMaySpeak') : t('openMicViewer')}</p>
          {speakingOn ? (
            <>
              {camBlocked && <span className="text-xs font-semibold text-amber-200">{t('camBlockedNote')}</span>}
              {selfVideo && (
                <button type="button" onClick={toggleSelfCam} aria-pressed={selfCamOff} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-bold text-white">
                  {selfCamOff ? <VideoOff className="h-4 w-4" aria-hidden /> : <Video className="h-4 w-4" aria-hidden />}
                  {selfCamOff ? t('camTurnOn') : t('camTurnOff')}
                </button>
              )}
              <button type="button" onClick={() => stopSpeaking(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-[var(--ink)]">
                <MicOff className="h-4 w-4" aria-hidden />
                {t('doneSpeaking')}
              </button>
            </>
          ) : (
            <>
              {!camBlocked && (
                <button type="button" onClick={() => startSpeaking(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-400 px-4 text-sm font-extrabold text-[var(--ink)]">
                  <Video className="h-4 w-4" aria-hidden />
                  {t('turnOnMicCam')}
                </button>
              )}
              <button type="button" onClick={() => startSpeaking(false)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-bold text-white">
                <Mic className="h-4 w-4" aria-hidden />
                {t('turnOnMic')}
              </button>
            </>
          )}
        </div>
      )}
      {state?.speaker && !mayspeak && (
        <p className="text-sm text-emerald-300">
          <Volume2 className="mr-1 inline h-4 w-4" aria-hidden />
          {t('someoneSpeaking', { name: state.speaker.name })}
        </p>
      )}
      {talkingNames.length > 0 && (
        <p className="text-sm text-emerald-300">
          <Mic className="mr-1 inline h-4 w-4" aria-hidden />
          {t('talkingNow', { names: talkingNames.join(', ') })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggleHand}
          disabled={!live || mayspeak}
          aria-pressed={hand}
          className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border text-sm font-extrabold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] ${
            hand ? 'border-[var(--gold-bright)] bg-[var(--gold-bright)] text-[var(--ink)]' : 'border-[var(--gold)]/50 bg-[var(--gold)]/12 text-[var(--gold-bright)]'
          }`}
        >
          <Hand className="h-5 w-5" aria-hidden />
          {hand ? t('handDown') : t('handUp')}
        </button>
        <button
          type="button"
          onClick={fullscreen}
          disabled={!showMain}
          aria-label={t('fullscreen')}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#26231d] text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
        >
          <Maximize className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={leave}
          aria-label={t('leave')}
          title={t('leave')}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#26231d] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--gold)]"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Chi parla con la videocamera: fuori dall'immagine, accanto alla chat */}
        {live && (selfVideo || liveFaces.length > 0) && (
          <div className="flex gap-2 overflow-x-auto sm:order-2 sm:max-h-[360px] sm:w-32 sm:shrink-0 sm:flex-col sm:overflow-y-auto sm:overflow-x-hidden">
            {selfVideo && (
              <div className="relative w-24 shrink-0 overflow-hidden rounded-xl border-2 border-emerald-400 bg-black sm:w-full">
                <video
                  ref={(el) => {
                    if (el && el.srcObject !== selfVideo) el.srcObject = selfVideo
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`aspect-[3/4] w-full -scale-x-100 object-cover ${selfCamOff ? 'opacity-0' : ''}`}
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[10px] font-bold text-white">{t('you')}</span>
              </div>
            )}
            {liveFaces.map((f) => (
              <div key={f.name} className="relative w-24 shrink-0 overflow-hidden rounded-xl border-2 border-emerald-400 bg-black sm:w-full">
                <video
                  ref={(el) => {
                    if (el && el.srcObject !== f.stream) {
                      el.srcObject = f.stream
                      el.play().catch(() => {})
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[3/4] w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[10px] font-bold text-white">{voiceOwner(state, f.name)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex h-[360px] min-w-0 flex-1">
          <WebinarChat
            messages={messages}
            hiddenIds={state?.hiddenIds ?? []}
            onSend={sendMessage}
            title={t('chatTitle')}
            disabled={state?.chatOpen === false}
            placeholder={state?.chatOpen === false ? t('chatClosedNote') : t('chatViewerPlaceholder')}
          />
        </div>
      </div>
    </div>
  )
}
