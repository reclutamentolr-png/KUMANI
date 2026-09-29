'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Check, Crown, Hourglass, LoaderCircle, Share2, Users, VenetianMask } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { answerVeritas, getVeritasState, joinVeritasRoom, startVeritas, voteVeritas } from '@/app/actions/veritas'
import { createClient } from '@/lib/supabase/client'
import { readVeritasSeat, saveVeritasSeat, VERITAS_REACTIONS, type VeritasRoomInfo, type VeritasState } from '@/lib/veritas'
import { renderVeritasShareCard } from '@/lib/veritasShareCard'

type Seat = { room_id: string; token: string }
type Reaction = { id: number; emoji: string; nickname: string }

// Stanza di Veritas (/veritas/<codice>): ingresso con soprannome (anche senza
// account), attesa, scrittura, voto, rivelazione e classifica. Aggiornamenti
// in tempo reale sul canale della stanza (solo segnali, nessun dato), più un
// controllo allo scadere di ogni fase e uno di riserva ogni 10 secondi.
export default function VeritasRoom({
  code,
  info,
  isLoggedIn,
  defaultNickname,
}: {
  code: string
  info: VeritasRoomInfo
  isLoggedIn: boolean
  defaultNickname: string
}) {
  const t = useTranslations('veritas')
  const [seat, setSeat] = useState<Seat | null | undefined>(undefined)
  const [game, setGame] = useState<VeritasState | null>(null)
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(0)
  const [nickname, setNickname] = useState(defaultNickname)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reactions, setReactions] = useState<Reaction[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const phaseKey = useRef('')
  const answerRound = useRef(0)
  const reactionSeq = useRef(0)

  // Posto già preso in questa stanza (codice segreto nel browser)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeat(readVeritasSeat(code))
  }, [code])

  const refresh = useCallback(async () => {
    if (!seat) return
    const result = await getVeritasState(seat.room_id, seat.token)
    if ('error' in result) {
      if (result.error === 'not_player') setSeat(null)
      return
    }
    setOffset(new Date(result.server_now).getTime() - Date.now())
    setGame(result)
    if (answerRound.current !== result.round) {
      answerRound.current = result.round
      setAnswer(result.my_answer ?? '')
    }
  }, [seat])

  // Tempo reale: segnali della stanza e reazioni
  useEffect(() => {
    if (!seat) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const supabase = createClient()
    const channel = supabase
      .channel(`veritas:${seat.room_id}`)
      .on('broadcast', { event: 'update' }, () => refresh())
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const reaction = { id: ++reactionSeq.current, emoji: String(payload?.emoji ?? ''), nickname: String(payload?.nickname ?? '') }
        if (!(VERITAS_REACTIONS as readonly string[]).includes(reaction.emoji)) return
        setReactions((list) => [...list.slice(-6), reaction])
        setTimeout(() => setReactions((list) => list.filter((r) => r.id !== reaction.id)), 3500)
      })
      .subscribe()
    channelRef.current = channel
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    // Riserva se un messaggio in tempo reale si perde: ogni 30 secondi
    // (prima 10), il gioco avanza già con i messaggi e il conto alla rovescia
    const fallback = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(fallback)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [seat, refresh])

  // Orologio per il conto alla rovescia; allo scadere si rilegge lo stato
  // (è la lettura che fa avanzare la fase).
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(tick)
  }, [])

  const remaining = game?.phase_ends_at && now ? Math.max(0, Math.ceil((new Date(game.phase_ends_at).getTime() - (now + offset)) / 1000)) : null

  useEffect(() => {
    if (!game || remaining === null || remaining > 0) return
    const key = `${game.status}-${game.round}`
    if (phaseKey.current === key) return
    phaseKey.current = key
    const retry = setTimeout(() => refresh(), 800)
    return () => clearTimeout(retry)
  }, [game, remaining, refresh])

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await joinVeritasRoom(code, nickname)
    setBusy(false)
    if (!result.success) {
      setError(t(`error_${result.error}`))
      return
    }
    const next = { room_id: result.room_id, token: result.token }
    saveVeritasSeat(code, next)
    setSeat(next)
  }

  const run = async (action: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    const result = await action()
    setBusy(false)
    if (result !== 'ok') setError(t(`error_${result}`))
    refresh()
  }

  const react = (emoji: string) => {
    const me = game?.players.find((p) => p.id === game.me)
    channelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji, nickname: me?.nickname ?? '' } })
    const reaction = { id: ++reactionSeq.current, emoji, nickname: me?.nickname ?? '' }
    setReactions((list) => [...list.slice(-6), reaction])
    setTimeout(() => setReactions((list) => list.filter((r) => r.id !== reaction.id)), 3500)
  }

  const shareRoom = async () => {
    const url = `${window.location.origin}/veritas/${code}`
    const text = t('shareInvite')
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Veritas · KUMANI', text, url })
      } catch {
        // Annullato.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setError(t('linkCopied'))
    } catch {
      // Appunti non disponibili.
    }
  }

  const shareResult = async () => {
    if (!game) return
    const winner = game.players[0]
    const blob = await renderVeritasShareCard({
      title: t('title'),
      winnerLine: t('winnerLine', { name: winner?.nickname ?? '' }),
      ranking: game.players.map((p) => ({ nickname: p.nickname, score: p.score })),
      footer: t('cardFooter'),
      site: window.location.host,
    })
    if (!blob) return
    const file = new File([blob], 'veritas.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: t('cardFooter') })
      } catch {
        // Annullato.
      }
      return
    }
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const panel = 'rounded-3xl border border-[var(--gold)]/20 bg-white/[0.04] p-5 sm:p-6'
  const goldButton =
    'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-50'

  if (seat === undefined) {
    return (
      <div className="flex justify-center py-20">
        <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold-bright)]" />
      </div>
    )
  }

  // Ingresso nella stanza
  if (!seat) {
    if (info.status !== 'lobby') {
      return (
        <div className={`${panel} text-center`}>
          <p className="text-white/80">{t('alreadyStarted')}</p>
        </div>
      )
    }
    return (
      <form onSubmit={join} className={`${panel} space-y-4 text-center`}>
        <VenetianMask className="mx-auto h-12 w-12 text-[var(--gold-bright)]" />
        <h1 className="text-2xl font-bold">{t('joinTitle', { name: info.host_nickname ?? '' })}</h1>
        <p className="text-sm text-white/70">{t('joinBody')}</p>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
          required
          placeholder={t('nicknamePlaceholder')}
          className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-center text-lg text-white placeholder:text-white/40 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
        />
        {error && <p className="text-sm font-semibold text-amber-300">{error}</p>}
        <button type="submit" disabled={busy || !nickname.trim()} className={goldButton}>
          {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null} {t('joinButton')}
        </button>
        {!isLoggedIn && <p className="text-xs text-white/50">{t('guestNote')}</p>}
      </form>
    )
  }

  if (!game) {
    return (
      <div className="flex justify-center py-20">
        <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold-bright)]" />
      </div>
    )
  }

  const host = game.players.find((p) => p.is_host)
  const timer = remaining !== null && (game.status === 'writing' || game.status === 'voting' || game.status === 'reveal') && (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${remaining <= 10 ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-white'}`}>
      <Hourglass className="h-4 w-4" /> {remaining}s
    </span>
  )

  const playersStrip = (
    <div className="flex flex-wrap gap-1.5">
      {game.players.map((p) => {
        const done = game.status === 'writing' ? p.answered : game.status === 'voting' ? p.voted : false
        return (
          <span
            key={p.id}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              p.id === game.me ? 'bg-[var(--gold)]/25 text-[var(--gold-bright)]' : 'bg-white/10 text-white/80'
            }`}
          >
            {p.is_host && <Crown className="h-3 w-3" />} {p.nickname}
            {done && <Check className="h-3 w-3 text-emerald-300" />}
          </span>
        )
      })}
    </div>
  )

  const reactionBar = game.status !== 'lobby' && (
    <div className="flex justify-center gap-2">
      {VERITAS_REACTIONS.map((emoji) => (
        <button key={emoji} type="button" onClick={() => react(emoji)} className="rounded-full bg-white/10 px-3 py-1.5 text-xl transition-transform hover:scale-110">
          {emoji}
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Reazioni in arrivo */}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-40 flex flex-col items-center gap-1.5">
        {reactions.map((r) => (
          <span key={r.id} className="animate-bounce rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            {r.emoji} <span className="text-white/70">{r.nickname}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-white/70">
        <span>
          {t('roomCode')} <span className="font-mono font-bold tracking-[0.2em] text-white">{game.code}</span>
        </span>
        {game.status !== 'lobby' && game.status !== 'finished' && <span>{t('roundOf', { round: game.round, total: game.total_rounds })}</span>}
        {timer}
      </div>

      {error && <p className="rounded-xl bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-200">{error}</p>}

      {/* Sala d'attesa */}
      {game.status === 'lobby' && (
        <div className={`${panel} space-y-5 text-center`}>
          <p className="text-sm uppercase tracking-[0.2em] text-white/60">{t('lobbyTitle')}</p>
          <p className="font-mono text-5xl font-bold tracking-[0.25em] text-[var(--gold-bright)]">{game.code}</p>
          <button type="button" onClick={shareRoom} className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/40 px-4 py-2.5 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/10">
            <Share2 className="h-4 w-4" /> {t('invite')}
          </button>
          <div>
            <p className="mb-2 flex items-center justify-center gap-1.5 text-sm text-white/70">
              <Users className="h-4 w-4" /> {t('playersCount', { count: game.players.length })}
            </p>
            <div className="flex justify-center">{playersStrip}</div>
          </div>
          {game.is_host ? (
            <>
              <button
                type="button"
                disabled={busy || game.players.length < 3}
                onClick={() => run(() => startVeritas(seat.room_id, seat.token))}
                className={goldButton}
              >
                {busy && <LoaderCircle className="h-5 w-5 animate-spin" />} {t('startGame')}
              </button>
              {game.players.length < 3 && <p className="text-xs text-white/60">{t('needThree')}</p>}
            </>
          ) : (
            <p className="text-sm text-white/70">{t('waitingHost', { name: host?.nickname ?? '' })}</p>
          )}
        </div>
      )}

      {/* Scrittura */}
      {game.status === 'writing' && (
        <div className={`${panel} space-y-4`}>
          <p className="text-center text-xl font-bold leading-snug sm:text-2xl">{game.question}</p>
          <p
            className={`rounded-xl px-4 py-3 text-center text-sm font-semibold ${
              game.i_am_liar ? 'bg-violet-500/25 text-violet-100' : 'bg-emerald-500/15 text-emerald-100'
            }`}
          >
            {game.i_am_liar ? t('youAreLiar') : t('tellTruth')}
          </p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder={t('answerPlaceholder')}
            className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
          />
          <button
            type="button"
            disabled={busy || !answer.trim()}
            onClick={() => run(() => answerVeritas(seat.room_id, seat.token, answer))}
            className={goldButton}
          >
            {game.my_answer ? t('updateAnswer') : t('sendAnswer')}
          </button>
          {game.my_answer && <p className="text-center text-xs text-emerald-300">{t('answerSaved')}</p>}
          {playersStrip}
        </div>
      )}

      {/* Voto */}
      {game.status === 'voting' && (
        <div className={`${panel} space-y-4`}>
          <p className="text-center text-sm text-white/60">{game.question}</p>
          <p className="text-center text-xl font-bold">{t('whoIsLying')}</p>
          <div className="space-y-2">
            {game.answers.map((a) => {
              const chosen = game.my_vote_slot === a.slot
              return (
                <button
                  key={a.slot}
                  type="button"
                  disabled={busy || a.mine || !game.my_answer}
                  onClick={() => run(() => voteVeritas(seat.room_id, seat.token, a.slot))}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    chosen
                      ? 'border-[var(--gold-bright)] bg-[var(--gold)]/20'
                      : a.mine
                        ? 'border-white/10 bg-white/5 opacity-60'
                        : 'border-white/15 bg-white/[0.06] hover:border-[var(--gold)]'
                  }`}
                >
                  <span className="mr-2 font-bold text-[var(--gold-bright)]">{String.fromCharCode(64 + a.slot)}</span>
                  {a.body}
                  {a.mine && <span className="ml-2 text-xs text-white/50">({t('yourAnswer')})</span>}
                </button>
              )
            })}
          </div>
          {!game.my_answer && <p className="text-center text-xs text-white/60">{t('noAnswerNoVote')}</p>}
          {playersStrip}
        </div>
      )}

      {/* Rivelazione */}
      {game.status === 'reveal' && (
        <div className={`${panel} space-y-4`}>
          <p className="text-center text-sm text-white/60">{game.question}</p>
          {game.answers.some((a) => a.is_liar) ? (
            <p className="text-center text-2xl font-bold">
              <VenetianMask className="mr-2 inline h-7 w-7 text-violet-300" />
              {t('liarWas', { name: game.liar_nickname ?? '' })}
            </p>
          ) : (
            <p className="text-center text-lg font-semibold text-white/80">{t('roundSkipped')}</p>
          )}
          <div className="space-y-2">
            {game.answers.map((a) => (
              <div
                key={a.slot}
                className={`rounded-xl border px-4 py-3 ${a.is_liar ? 'border-violet-400 bg-violet-500/20' : 'border-white/10 bg-white/[0.04]'}`}
              >
                <p className="text-sm">{a.body}</p>
                <p className="mt-1 text-xs text-white/60">
                  {a.author} · {t('votesReceived', { count: a.votes ?? 0 })}
                </p>
              </div>
            ))}
          </div>
          <Scoreboard players={game.players} me={game.me} />
          <p className="text-center text-xs text-white/50">{game.round >= game.total_rounds ? t('finalSoon') : t('nextRoundSoon')}</p>
        </div>
      )}

      {/* Fine partita */}
      {game.status === 'finished' && (
        <div className={`${panel} space-y-5 text-center`}>
          <Crown className="mx-auto h-12 w-12 text-[var(--gold-bright)]" />
          <p className="text-2xl font-bold">{t('winnerLine', { name: game.players[0]?.nickname ?? '' })}</p>
          <Scoreboard players={game.players} me={game.me} />
          <button type="button" onClick={shareResult} className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold)]/40 px-4 py-2.5 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:bg-[var(--gold)]/10">
            <Share2 className="h-4 w-4" /> {t('shareResult')}
          </button>
          {game.is_host && (
            <button type="button" disabled={busy} onClick={() => run(() => startVeritas(seat.room_id, seat.token))} className={goldButton}>
              {t('playAgain')}
            </button>
          )}
          {!isLoggedIn && (
            <Link
              href={game.host_referral ? `/register?sponsor=${encodeURIComponent(game.host_referral)}` : '/register'}
              className="block rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-[var(--gold-bright)]"
            >
              {t('registerCta')}
            </Link>
          )}
        </div>
      )}

      {reactionBar}
    </div>
  )
}

function Scoreboard({ players, me }: { players: VeritasState['players']; me: string }) {
  return (
    <ol className="space-y-1.5">
      {players.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${p.id === me ? 'bg-[var(--gold)]/20' : 'bg-white/[0.05]'}`}
        >
          <span>
            <span className="mr-2 font-bold text-[var(--gold-bright)]">{i + 1}.</span>
            {p.nickname}
          </span>
          <span className="font-bold">{p.score}</span>
        </li>
      ))}
    </ol>
  )
}
