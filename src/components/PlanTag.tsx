import type { RequiredPlan } from '@/lib/plans'

// Piccola scritta col piano che comprende uno strumento: Free in verde, Plus in
// arancio, Pro in blu (i nomi dei piani restano uguali in tutte le lingue).
const STYLE: Record<RequiredPlan, { label: string; className: string }> = {
  free: { label: 'Free', className: 'text-emerald-700' },
  base: { label: 'Plus', className: 'text-orange-600' },
  pro: { label: 'Pro', className: 'text-blue-700' },
}

export default function PlanTag({ plan, className = '' }: { plan?: RequiredPlan | null; className?: string }) {
  if (!plan) return null
  const s = STYLE[plan]
  return <span className={`block text-[10px] font-extrabold uppercase leading-none tracking-wider ${s.className} ${className}`}>{s.label}</span>
}
