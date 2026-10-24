// Stili comuni di KUMANI TEMPUS (come gli altri servizi)
export const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 sm:p-6'
export const field =
  'mt-1 block w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'
export const label = 'block text-sm font-semibold text-[var(--ink)]'
export const primary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 font-extrabold text-[var(--ink)] shadow-md hover:brightness-105 disabled:opacity-50'
export const secondary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-4 text-sm font-bold text-[var(--ink)] hover:border-[var(--gold)]/60 disabled:opacity-50'
export const chip = (on: boolean) =>
  `min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--gold)]/60'}`
