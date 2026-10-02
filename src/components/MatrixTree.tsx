import { ArrowRight, Crown, Users, UserRound } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useTranslations } from 'next-intl'
import StarLines, { STAR_CENTER, STAR_POINTS } from '@/components/StarLines'

type MatrixNode = {
  id: string
  user_id: string
  parent_id: string | null
  path: string
  level: number
  position: number
  depth: number
  created_at: string
  // Dal database possono arrivare vuoti (null)
  username?: string | null
  first_name?: string | null
  last_name?: string | null
  referral_code?: string | null
  country_code?: string | null
}

type MatrixTreeProps = {
  rootNode: MatrixNode
  descendants: MatrixNode[]
  // Posti occupati da persone invitate da altri Kumani (dalla community)
  receivedIds?: string[]
}

export default function MatrixTree({ rootNode, descendants, receivedIds = [] }: MatrixTreeProps) {
  const t = useTranslations('dashboard')
  const directMembers = descendants
    .filter((node) => node.parent_id === rootNode.id)
    .sort((firstNode, secondNode) => firstNode.position - secondNode.position)

  const directSlots = Array.from({ length: 5 }, (_, index) => directMembers[index] || null)

  const getDownlineCount = (directMember: MatrixNode) =>
    descendants.filter((node) => node.path.startsWith(`${directMember.path}.`)).length

  const displayName = (node: MatrixNode) =>
    `${node.first_name || ''} ${node.last_name || ''}`.trim() || t('freeSlot')

  const renderMember = (member: MatrixNode | null, slotIndex: number) => {
    const isOccupied = Boolean(member)
    const isReceived = Boolean(member && receivedIds.includes(member.user_id))
    const downlineCount = member ? getDownlineCount(member) : 0
    const point = STAR_POINTS[slotIndex]

    return (
      <div
        key={member?.id || `empty-slot-${slotIndex}`}
        className="absolute z-10 flex w-max -translate-x-1/2 -translate-y-6 flex-col items-center text-center sm:-translate-y-10"
        style={{ left: `${point.left}%`, top: `${point.top}%` }}
      >
        <div className={`relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] shadow-lg transition-transform sm:h-20 sm:w-20 sm:border-4 ${
          isReceived
            ? 'border-sky-400 bg-sky-950 text-sky-200 hover:-translate-y-1'
            : isOccupied
              ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)] hover:-translate-y-1'
              : 'border-dashed border-stone-300 bg-stone-100 text-stone-400'
        }`}>
          {isOccupied ? <UserRound className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={1.6} /> : <span className="text-xl sm:text-2xl">+</span>}
          <span className={`absolute -bottom-2 rounded-full border px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px] ${
            isReceived
              ? 'border-sky-300 bg-sky-50 text-sky-900'
              : isOccupied
                ? 'border-[var(--gold)]/50 bg-[var(--gold-pale)] text-[var(--ink)]'
                : 'border-stone-300 bg-white text-stone-400'
          }`}>
            {slotIndex + 1}
          </span>
        </div>
        <p className={`mt-3 max-w-[84px] truncate text-xs font-bold sm:max-w-[130px] sm:text-sm ${isOccupied ? 'text-[var(--ink)]' : 'text-stone-400'}`}>
          {member ? displayName(member) : t('freeSlot')}
        </p>
        {isOccupied ? (
          <p className="mt-0.5 flex max-w-[92px] items-start justify-center gap-1 text-[10px] leading-tight text-[var(--muted)] sm:max-w-none sm:items-center sm:whitespace-nowrap sm:text-xs">
            <Users className="mt-px h-3 w-3 shrink-0 text-[var(--gold)] sm:mt-0 sm:h-3.5 sm:w-3.5" />
            {t('activeKumaniTotal', { count: downlineCount })}
          </p>
        ) : (
          <p className="mt-0.5 hidden text-xs text-stone-400 sm:block">{t('waitingForDirect')}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-4 sm:p-8">
        {/* Sul telefono il riquadro è più alto, così le punte in basso non
            toccano il nome del titolare */}
        <div className="relative mx-auto aspect-[100/132] w-full max-w-[34rem] sm:aspect-[100/108]">
          {/* La stella: raggi dal centro e contorno a cinque punte */}
          <StarLines />

          {/* Il titolare al centro della stella */}
          <div
            className="absolute z-20 flex -translate-x-1/2 -translate-y-8 flex-col items-center text-center sm:-translate-y-14"
            style={{ left: `${STAR_CENTER.x}%`, top: `${STAR_CENTER.y}%` }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[var(--gold-bright)] bg-[var(--ink)] text-[var(--gold-bright)] shadow-[0_10px_30px_rgba(23,23,23,0.2)] sm:h-28 sm:w-28">
              <Crown className="h-7 w-7 sm:h-10 sm:w-10" strokeWidth={1.5} />
            </div>
            <span className="mt-2 rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)] sm:mt-3 sm:px-3 sm:py-1 sm:text-[10px]">{t('owner')}</span>
            <p className="mt-1 max-w-[80px] truncate text-sm font-bold text-[var(--ink)] sm:mt-2 sm:max-w-[180px] sm:text-lg">{displayName(rootNode)}</p>
            <p className="font-mono text-[10px] text-[var(--muted)] sm:text-xs">{rootNode.referral_code || t('myPosition')}</p>
          </div>

          {directSlots.map(renderMember)}
        </div>
      </div>

      {/* Legenda dei colori */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--ink)]">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--gold)] bg-[var(--ink)]" /> {t('legendInvited')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-sky-400 bg-sky-950" /> {t('legendReceived')}
        </span>
      </div>
      <div className="-mt-5 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:text-left">
        <p className="max-w-md text-xs text-[var(--muted)]">{t('legendReceivedHint')}</p>
        <Link
          href="/wallet#wallet-points"
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 transition hover:border-sky-400"
        >
          {t('legendWalletCta')} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
        <Users className="h-4 w-4 text-[var(--gold)]" />
        <span>{t('matrixInfo')}</span>
      </div>
    </div>
  )
}
