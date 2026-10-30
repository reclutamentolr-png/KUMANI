'use client'

import { BedDouble, Car, CarTaxiFront, Fuel, Receipt, SquareParking, TrainFront, Utensils, type LucideIcon } from 'lucide-react'
import type { ExpenseCategory, ReportStatus } from '@/lib/noteSpese'

// Stili e icone comuni alle schermate di Note spese

export const input =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[16px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
export const label = 'mb-1 block text-sm font-semibold text-gray-700'
export const primary =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60'
export const secondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] disabled:opacity-50'
export const card = 'rounded-2xl border border-[var(--gold)]/20 bg-white p-4 shadow-sm sm:p-5'

export const CATEGORY_ICONS: Record<ExpenseCategory, LucideIcon> = {
  meals: Utensils,
  lodging: BedDouble,
  transport: TrainFront,
  taxi: CarTaxiFront,
  parking: SquareParking,
  fuel: Fuel,
  mileage: Car,
  other: Receipt,
}

export const STATUS_STYLES: Record<ReportStatus, string> = {
  open: 'bg-[var(--gold-pale)] text-[var(--ink)]',
  submitted: 'bg-[#e8f0ff] text-[#1e4fa3]',
  reimbursed: 'bg-[#e6f6ec] text-[#1d6b3a]',
}

export function CategoryIcon({ category, className = 'h-5 w-5' }: { category: ExpenseCategory; className?: string }) {
  const Icon = CATEGORY_ICONS[category]
  return <Icon className={className} aria-hidden />
}
