'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, Clock, MessageCircle, UserPlus, Users } from 'lucide-react'

type ActivePerson = {
  id: string
  first_name: string | null
  last_name: string | null
  referral_code: string | null
  created_at: string
}

type PendingPerson = {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  created_at: string
}

function whatsAppHref(phone: string | null, message: string): string {
  if (phone) {
    const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
    if (digits) return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
  }
  // Nessun numero salvato: WhatsApp si apre col messaggio pronto e il
  // contatto lo sceglie il KUMI.
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

const initials = (first: string | null, last: string | null) => `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?'

// I tuoi KUMANI nella pagina Rete: invitati diretti attivi e quelli che non
// hanno ancora attivato l'abbonamento (con il promemoria WhatsApp).
export default function KumaniPeople({
  active,
  pending,
  senderName,
  loginUrl,
}: {
  active: ActivePerson[]
  pending: PendingPerson[]
  senderName: string
  loginUrl: string
}) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [tab, setTab] = useState<'active' | 'pending'>(active.length === 0 && pending.length > 0 ? 'pending' : 'active')
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale)

  const tabs = [
    { key: 'active' as const, label: t('peopleTabActive'), count: active.length, Icon: CheckCircle2 },
    { key: 'pending' as const, label: t('peopleTabPending'), count: pending.length, Icon: Clock },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gold)]/20 px-5 py-4">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-[var(--ink)]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
            <Users className="h-4.5 w-4.5" />
          </span>
          {t('peopleTitle')}
        </h2>
        <div className="flex rounded-xl bg-[var(--ink)]/[0.05] p-1">
          {tabs.map(({ key, label, count, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === key ? 'bg-[var(--ink)] text-white shadow' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
              <span className={`rounded-full px-1.5 text-xs ${tab === key ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-white text-[var(--ink)]'}`}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === 'active' ? (
          active.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-6 text-center text-sm text-[var(--ink)]">
              {t('peopleEmptyActive')}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((person) => (
                <li key={person.id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-colors hover:border-[var(--gold)]/60">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-sm font-bold text-[var(--ink)]">
                    {initials(person.first_name, person.last_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--ink)]">
                      {person.first_name} {person.last_name}
                    </p>
                    <p className="truncate font-mono text-xs text-[var(--gold)]">{person.referral_code}</p>
                    <p className="text-xs text-[var(--muted)]">{t('peopleSince', { date: date(person.created_at) })}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {t('affiliateActive')}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-6 text-center text-sm text-[var(--ink)]">
            {t('peopleEmptyPending')}
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-[var(--muted)]">{t('notYetKumaniHint')}</p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((person) => {
                const name = `${person.first_name || ''} ${person.last_name || ''}`.trim()
                const message = t('whatsappNudgeMessage', { name: person.first_name || name, sponsorName: senderName, loginUrl })
                return (
                  <li key={person.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-500">
                        {initials(person.first_name, person.last_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--ink)]">{name}</p>
                        <p className="text-xs text-[var(--muted)]">{t('peopleRegisteredOn', { date: date(person.created_at) })}</p>
                      </div>
                      <UserPlus className="h-4 w-4 shrink-0 text-gray-400" />
                    </div>
                    <a
                      href={whatsAppHref(person.phone, message)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> {t('sendWhatsAppNudge')}
                    </a>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
