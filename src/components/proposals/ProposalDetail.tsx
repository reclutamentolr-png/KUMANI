'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Flag, LoaderCircle, Pencil, Share2, ShieldCheck } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { reportProposal } from '@/app/actions/proposals'
import { REPORT_REASONS, STATUS_STYLES, VOTABLE_STATUSES, type Proposal, type ReportReason } from '@/lib/proposals'
import VoteButton from './VoteButton'
import { useTimeAgo } from './ProposalCard'

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm'

export default function ProposalDetail({ proposal: p, serviceName, shareUrl }: { proposal: Proposal; serviceName: string | null; shareUrl: string }) {
  const t = useTranslations('proposals')
  const locale = useLocale()
  const ago = useTimeAgo()
  const [votes, setVotes] = useState(p.votes_count)
  const [copied, setCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('politics')
  const [note, setNote] = useState('')
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'error'>(p.my_report ? 'sent' : 'idle')

  const published = !['pending', 'changes', 'rejected'].includes(p.status)
  const votable = VOTABLE_STATUSES.includes(p.status) && !p.is_mine
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
  const topic = p.topic === 'existing' && serviceName ? serviceName : t(`topics.${p.topic}`)

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: p.title, url: shareUrl })
      else {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch {
      // condivisione annullata
    }
  }

  const sendReport = async () => {
    setReportState('sending')
    const result = await reportProposal(p.id, reason, note)
    setReportState(result.success ? 'sent' : 'error')
    if (result.success) setReportOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={`inline-block rounded-full px-3 py-1 text-xs font-extrabold ${STATUS_STYLES[p.status]}`}>{t(`status.${p.status}`)}</span>
        <h1 className="break-words text-3xl font-bold leading-tight text-[var(--ink)]">{p.title}</h1>
        <p className="text-sm text-[var(--muted)]">
          {topic} · {p.is_mine ? t('byYou') : p.author_name ? t('by', { name: p.author_name }) : t('byMember')} · {ago(p.published_at ?? p.created_at)}
        </p>
      </div>

      {/* Solo per l'autore: a che punto è la proposta */}
      {p.is_mine && !published && (
        <section className={`rounded-3xl p-5 ${p.status === 'rejected' ? 'bg-[#fdecea] text-[#7f1d1d]' : 'bg-[var(--gold-pale)]/60 text-[var(--ink)]'}`} role="status">
          <p className="font-extrabold">{t(`author.${p.status}Title`)}</p>
          <p className="mt-1 text-sm">{t(`author.${p.status}Text`)}</p>
          {p.staff_note && (
            <p className="mt-3 rounded-2xl bg-white/70 p-3 text-sm">
              <b>{t('staffNote')}</b> {p.staff_note}
            </p>
          )}
          {p.status === 'changes' && (
            <Link
              href={`/community/proposte/nuova?edit=${p.id}`}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-sm font-bold text-[var(--gold-bright)]"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t('editAndResend')}
            </Link>
          )}
        </section>
      )}

      <p className="whitespace-pre-line break-words text-base leading-relaxed text-[var(--ink)]">{p.body}</p>

      {published && (
        <section className="space-y-3 rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.2)]">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('supportTitle')}</p>
          <p className="text-4xl font-extrabold tabular-nums" aria-live="polite">
            {votes}
            <span className="ml-2 text-base font-semibold text-white/70">{t('supporters', { count: votes })}</span>
          </p>
          {p.is_mine ? (
            <p className="text-sm text-white/75">{t('ownProposal')}</p>
          ) : (
            <VoteButton id={p.id} title={p.title} votes={p.votes_count} voted={p.my_vote} disabled={!votable} size="lg" onChange={setVotes} />
          )}
          <p className="text-xs text-white/60">{t('anonymous')}</p>
        </section>
      )}

      {p.staff_reply && (
        <section className={`${card} border-[var(--gold)]/50`}>
          <p className="flex items-center gap-2 text-sm font-extrabold text-[#7a5a14]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t('staffReply')}
          </p>
          <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-[var(--ink)]">{p.staff_reply}</p>
        </section>
      )}

      <section className={card}>
        <h2 className="text-base font-extrabold text-[var(--ink)]">{t('timelineTitle')}</h2>
        <ol className="mt-3 space-y-3">
          {[
            { on: true, label: t('timeline.sent'), date: p.created_at },
            { on: !!p.published_at, label: t('timeline.published'), date: p.published_at },
            { on: published && p.status !== 'open', label: t(`status.${p.status}`), date: p.status_changed_at },
          ]
            .filter((s) => s.on && s.date)
            .map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--gold)]" aria-hidden="true" />
                <span className="text-sm">
                  <b className="block text-[var(--ink)]">{s.label}</b>
                  <span className="text-[var(--muted)]">{day(s.date!)}</span>
                </span>
              </li>
            ))}
        </ol>
      </section>

      {published && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={share}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[var(--gold)]/40 bg-white font-bold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Share2 className="h-4 w-4" aria-hidden="true" />}
            {copied ? t('linkCopied') : t('share')}
          </button>
          {!p.is_mine && (
            <button
              type="button"
              onClick={() => setReportOpen((v) => !v)}
              disabled={reportState === 'sent'}
              aria-expanded={reportOpen}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Flag className="h-4 w-4" aria-hidden="true" />
              {reportState === 'sent' ? t('reported') : t('report')}
            </button>
          )}
        </div>
      )}

      {reportOpen && (
        <section className={`${card} space-y-3`} aria-labelledby="report-title">
          <h2 id="report-title" className="text-base font-extrabold text-[var(--ink)]">
            {t('reportTitle')}
          </h2>
          <fieldset className="space-y-1">
            <legend className="sr-only">{t('reportReason')}</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[var(--ink)]">
                <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="h-5 w-5 accent-[var(--ink)]" />
                {t(`reasons.${r}`)}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm font-semibold text-[var(--muted)]">
            {t('reportNote')}
            <textarea
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-[var(--gold)]/35 bg-white p-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
            />
          </label>
          {reportState === 'error' && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {t('errors.saveError')}
            </p>
          )}
          <button
            type="button"
            onClick={sendReport}
            disabled={reportState === 'sending'}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {reportState === 'sending' && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t('reportSend')}
          </button>
        </section>
      )}
    </div>
  )
}
