'use client'

import { useState, useTransition } from 'react'
import { BellRing, CalendarClock, CheckCircle2 } from 'lucide-react'
import { joinPlanWaitlist } from '@/app/actions/plansWaitlist'

type Texts = { title: string; text: string; notify: string; joined: string }

// Al posto di «Abbonati» finché i piani non sono aperti (lib/plansGate):
// la data di apertura e «Avvisami» (notifica ed email il giorno dell'apertura)
export default function PlansComingSoonCard({ plan, joined: initial, texts, tone = 'light' }: { plan: 'base' | 'pro'; joined: boolean; texts: Texts; tone?: 'light' | 'dark' }) {
  const [joined, setJoined] = useState(initial)
  const [pending, start] = useTransition()
  const dark = tone === 'dark'
  return (
    <div className={`rounded-2xl border p-5 text-left ${dark ? 'border-[var(--gold)]/40 bg-white/5 text-white' : 'border-[var(--gold)]/40 bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
      <p className="flex items-center gap-2 text-lg font-extrabold">
        <CalendarClock className="h-5 w-5 shrink-0 text-[var(--gold)]" /> {texts.title}
      </p>
      <p className={`mt-1 text-sm leading-6 ${dark ? 'text-white/75' : 'text-[var(--muted)]'}`}>{texts.text}</p>
      {joined ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {texts.joined}
        </p>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setJoined((await joinPlanWaitlist(plan)).ok))}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-[var(--gold-bright)] shadow-sm hover:brightness-125 disabled:opacity-60"
        >
          <BellRing className="h-5 w-5" /> {texts.notify}
        </button>
      )}
    </div>
  )
}
