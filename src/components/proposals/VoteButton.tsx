'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronUp } from 'lucide-react'
import { voteProposal } from '@/app/actions/proposals'

// Sostegno a una proposta: si aggiorna subito e torna indietro se il server rifiuta
export default function VoteButton({
  id,
  title,
  votes: initialVotes,
  voted: initialVoted,
  disabled = false,
  size = 'md',
  onChange,
}: {
  id: string
  title: string
  votes: number
  voted: boolean
  disabled?: boolean
  size?: 'md' | 'lg'
  // Numero aggiornato, per chi lo mostra fuori dal pulsante
  onChange?: (votes: number) => void
}) {
  const t = useTranslations('proposals')
  const [votes, setVotes] = useState(initialVotes)
  const [voted, setVoted] = useState(initialVoted)
  const [pending, start] = useTransition()

  const toggle = () => {
    const next = !voted
    const optimistic = votes + (next ? 1 : -1)
    setVoted(next)
    setVotes(optimistic)
    onChange?.(optimistic)
    start(async () => {
      const result = await voteProposal(id, next)
      if (result.success) {
        setVotes(result.data.votes)
        onChange?.(result.data.votes)
      } else {
        setVoted(!next)
        setVotes(votes)
        onChange?.(votes)
      }
    })
  }

  const label = disabled ? t('voteClosed', { title }) : voted ? t('unvoteAria', { title }) : t('voteAria', { title })
  if (size === 'lg') {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        aria-pressed={voted}
        aria-label={label}
        className={`inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl text-base font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          voted ? 'bg-white text-[var(--ink)] ring-1 ring-white/40' : 'bg-[var(--gold-bright)] text-[var(--ink)] hover:brightness-105'
        }`}
      >
        <ChevronUp className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
        {disabled ? t('voteClosedShort') : voted ? t('voted') : t('vote')}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled || pending}
      aria-pressed={voted}
      aria-label={label}
      className={`flex min-h-16 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors disabled:cursor-not-allowed ${
        voted ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--ink)]'
      } ${disabled ? 'opacity-70' : ''}`}
    >
      <ChevronUp className="h-5 w-5" strokeWidth={2.6} aria-hidden="true" />
      <span className="text-[15px] font-extrabold tabular-nums">{votes}</span>
    </button>
  )
}
