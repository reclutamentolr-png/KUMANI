import type { ApplicationStatus } from '@/lib/candidature'

// Aspetto condiviso dalle schermate di «Le mie candidature»

export const input =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[16px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
export const label = 'mb-1 block text-sm font-semibold text-gray-700'
export const primary =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60'
export const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-5'
export const pill = 'inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-bold disabled:opacity-60'

// Colore di ogni stato (pastiglia nell'elenco e nella scheda)
export const STATUS_TONE: Record<ApplicationStatus, string> = {
  to_send: 'bg-gray-100 text-gray-700 border-gray-300',
  sent: 'bg-[#eef3fb] text-[#24467a] border-[#c9d7ef]',
  interview_set: 'bg-[var(--gold-pale)] text-[#7a5a12] border-[var(--gold)]/50',
  interview_done: 'bg-[#f3ecfa] text-[#5b3683] border-[#dccbee]',
  offer: 'bg-[#e7f4ea] text-[#1d6b34] border-[#bfe0c8]',
  accepted: 'bg-[#1d6b34] text-white border-[#1d6b34]',
  rejected: 'bg-[#fbeaea] text-[#9b2c2c] border-[#efc9c9]',
  no_answer: 'bg-gray-50 text-gray-500 border-gray-200',
}
