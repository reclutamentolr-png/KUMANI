'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUp, ChevronRight, House, Plus, Users, UserRound } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { useTranslations } from 'next-intl'
import KumiTentacles, { NET_ASPECT, NET_OWNER, NET_POINTS } from '@/components/KumiTentacles'
import InviteSheet, { type NetworkInvite } from '@/components/network/InviteSheet'

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
  // Cognome e codice completo solo dei propri invitati diretti (e per lo Staff)
  last_name?: string | null
  referral_code?: string | null
  masked_code?: string | null
  country_code?: string | null
  // Invitato da chi gli sta sopra nella stella? Se no, è arrivato dalla community
  sponsored_by_parent?: boolean | null
  // Kumani attivi sotto di lui, già contati dal database (get_my_downline_star:
  // la stella riceve solo i primi 5 livelli, non tutta la discendenza)
  active_downline_count?: number | null
  // Attivo grazie a un voucher (regalo): 🎁 sul pallino, i colori non cambiano
  gifted?: boolean | null
}

type MatrixTreeProps = {
  rootNode: MatrixNode
  descendants: MatrixNode[]
  // Posti occupati da persone invitate da altri Kumani (dalla community)
  receivedIds?: string[]
  // 'admin': lo Staff guarda i Kumani di un'altra persona
  mode?: 'self' | 'admin'
  // Link d'invito: con questo i «+» del proprio polpo aprono l'invito
  invite?: NetworkInvite
}

// Si possono aprire i Kumani fino al 4° livello, così si vedono le persone
// fino al 5° livello sotto il titolare.
const MAX_OPEN_LEVEL = 4

// Quanti tentacoli di ogni Kumano sono già stati visti cresciuti su questo
// telefono: i nuovi si allungano con un'animazione alla visita successiva
const seenKey = (id: string) => `kumani:polpo:${id}`

export default function MatrixTree({ rootNode, descendants, receivedIds = [], mode = 'self', invite }: MatrixTreeProps) {
  const t = useTranslations('dashboard')
  // Le stelle aperte, dalla prima sotto il titolare a quella al centro
  const [trail, setTrail] = useState<MatrixNode[]>([])
  const center = trail[trail.length - 1] ?? rootNode
  const centerLevel = trail.length
  const isOwnStar = centerLevel === 0
  const canOpen = centerLevel < MAX_OPEN_LEVEL
  // Invito aperto: per un tentacolo libero (0-4) o per lo Spillover (null);
  // nel polpo di un proprio Kumano prenota il posto sotto di lui
  const [sheet, setSheet] = useState<{ slot: number | null; target?: { name: string; nodeId: string } } | null>(null)
  const canInvite = Boolean(invite) && mode === 'self'

  const directMembers = descendants
    .filter((node) => node.parent_id === center.id)
    .sort((firstNode, secondNode) => firstNode.position - secondNode.position)

  const directSlots = Array.from({ length: 5 }, (_, index) => directMembers[index] || null)
  const grown = directSlots.map(Boolean)
  const grownCount = grown.filter(Boolean).length

  // Tentacoli nuovi dall'ultima visita (solo nella propria rete)
  const [fresh, setFresh] = useState<boolean[]>([])
  useEffect(() => {
    if (mode !== 'self') return
    try {
      const raw = localStorage.getItem(seenKey(center.id))
      const seen = raw === null ? null : Number(raw)
      localStorage.setItem(seenKey(center.id), String(grownCount))
      // Prima visita: niente animazione, il polpo è già com'è
      if (seen === null || !Number.isFinite(seen)) return
      // Dati del browser: si leggono solo dopo il primo disegno
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFresh(grown.map((isGrown, index) => isGrown && index >= seen))
    } catch {
      // Memoria del browser non disponibile: nessuna animazione
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.id, grownCount, mode])

  const getDownlineCount = (directMember: MatrixNode) =>
    typeof directMember.active_downline_count === 'number'
      ? directMember.active_downline_count
      : descendants.filter((node) => node.path.startsWith(`${directMember.path}.`)).length

  const displayName = (node: MatrixNode) =>
    `${node.first_name || ''} ${node.last_name || ''}`.trim() || 'Kumano'

  const isReceived = (member: MatrixNode) => {
    if (typeof member.sponsored_by_parent === 'boolean') return !member.sponsored_by_parent
    return isOwnStar && receivedIds.includes(member.user_id)
  }

  const open = (member: MatrixNode) => {
    if (!canOpen) return
    setTrail((current) => [...current, member])
  }

  const renderMember = (member: MatrixNode | null, slotIndex: number) => {
    const isOccupied = Boolean(member)
    const received = Boolean(member && isReceived(member))
    const downlineCount = member ? getDownlineCount(member) : 0
    const point = NET_POINTS[slotIndex]
    const clickable = Boolean(member && canOpen)

    const circle = (
      <div className={`relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] shadow-lg transition-transform sm:h-20 sm:w-20 sm:border-4 ${
        received
          ? 'border-sky-400 bg-sky-950 text-sky-200'
          : isOccupied
            ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)]'
            : 'border-dashed border-stone-300 bg-stone-100 text-stone-400'
      } ${clickable ? 'group-hover:-translate-y-1 group-focus-visible:ring-4 group-focus-visible:ring-[var(--gold)]/40' : ''}`}>
        {isOccupied ? <UserRound className="h-6 w-6 sm:h-8 sm:w-8" strokeWidth={1.6} /> : <span className="text-xl sm:text-2xl">+</span>}
        {member?.gifted && (
          <span
            title={t('giftedHint')}
            aria-label={t('giftedHint')}
            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--gold)] bg-white text-[11px] shadow sm:h-7 sm:w-7 sm:text-sm"
          >
            🎁
          </span>
        )}
        <span className={`absolute -bottom-2 rounded-full border px-1.5 py-0.5 text-[9px] font-bold sm:px-2 sm:text-[10px] ${
          received
            ? 'border-sky-300 bg-sky-50 text-sky-900'
            : isOccupied
              ? 'border-[var(--gold)]/50 bg-[var(--gold-pale)] text-[var(--ink)]'
              : 'border-stone-300 bg-white text-stone-400'
        }`}>
          {slotIndex + 1}
        </span>
      </div>
    )

    const label = (
      <>
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
      </>
    )

    const className = 'absolute z-10 flex w-max -translate-x-1/2 -translate-y-6 flex-col items-center text-center sm:-translate-y-10'
    const style = { left: `${point.left}%`, top: `${point.top}%` }

    if (!member && canInvite) {
      return (
        <button
          key={`invite-slot-${slotIndex}`}
          type="button"
          onClick={() => setSheet(isOwnStar ? { slot: slotIndex } : { slot: slotIndex, target: { name: center.first_name || 'Kumano', nodeId: center.id } })}
          aria-label={t('inviteSlotAria', { n: slotIndex + 1 })}
          className={`group cursor-pointer outline-none ${className}`}
          style={style}
        >
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-dashed border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)] shadow-md transition-transform group-hover:-translate-y-1 group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-[var(--gold)]/40 sm:h-20 sm:w-20 sm:border-4">
            <Plus className="h-6 w-6 sm:h-9 sm:w-9" strokeWidth={2.4} />
            <span className="absolute -bottom-2 rounded-full border border-[var(--gold)]/50 bg-white px-1.5 py-0.5 text-[9px] font-bold text-[var(--ink)] sm:px-2 sm:text-[10px]">{slotIndex + 1}</span>
          </div>
          <p className="mt-3 max-w-[84px] text-xs font-bold text-[var(--gold)] sm:max-w-[130px] sm:text-sm">{t('inviteSlotLabel')}</p>
        </button>
      )
    }

    if (member && clickable) {
      return (
        <button
          key={member.id}
          type="button"
          onClick={() => open(member)}
          title={t('starOpen', { name: displayName(member) })}
          aria-label={t('starOpen', { name: displayName(member) })}
          className={`group cursor-pointer outline-none ${className}`}
          style={style}
        >
          {circle}
          {label}
        </button>
      )
    }
    return (
      <div key={member?.id || `empty-slot-${slotIndex}`} className={className} style={style}>
        {circle}
        {label}
      </div>
    )
  }

  const centerCode = center.referral_code || center.masked_code
  const rootCrumb = mode === 'self' ? t('starYou') : displayName(rootNode)

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-4 sm:p-8">
        {/* Percorso: dalla propria stella a quella aperta */}
        {trail.length > 0 && (
          <div className="mb-4 space-y-3">
            <nav aria-label={t('starPath')} className="flex flex-wrap items-center gap-1 text-xs font-semibold text-[var(--muted)] sm:text-sm">
              <button type="button" onClick={() => setTrail([])} className="rounded-full px-2 py-0.5 text-[var(--ink)] hover:bg-[var(--gold-pale)]">
                {rootCrumb}
              </button>
              {trail.map((node, index) => (
                <span key={node.id} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--gold)]" />
                  {index === trail.length - 1 ? (
                    <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[var(--gold-bright)]">{node.first_name || 'Kumano'}</span>
                  ) : (
                    <button type="button" onClick={() => setTrail(trail.slice(0, index + 1))} className="rounded-full px-2 py-0.5 text-[var(--ink)] hover:bg-[var(--gold-pale)]">
                      {node.first_name || 'Kumano'}
                    </button>
                  )}
                </span>
              ))}
            </nav>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTrail(trail.slice(0, -1))}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/50 bg-white px-3 py-1.5 text-xs font-bold text-[var(--ink)] transition hover:border-[var(--gold)]"
              >
                <ArrowUp className="h-3.5 w-3.5" /> {t('starUp')}
              </button>
              <button
                type="button"
                onClick={() => setTrail([])}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-[var(--gold-bright)] transition hover:opacity-90"
              >
                <House className="h-3.5 w-3.5" /> {mode === 'self' ? t('starBackToMine') : t('starBackToStart')}
              </button>
            </div>
          </div>
        )}

        <div key={center.id} className="animate-starZoom relative mx-auto w-full max-w-[34rem]" style={{ aspectRatio: NET_ASPECT }}>
          {/* Il polpo KUMI: la testa è il titolare, i tentacoli i 5 posti */}
          <KumiTentacles grown={grown} fresh={fresh} />

          {/* Il titolare (o il Kumano aperto) sopra la corona di KUMI */}
          <div
            className="absolute z-20 flex -translate-x-1/2 -translate-y-full flex-col items-center text-center"
            style={{ left: `${NET_OWNER.left}%`, top: `${NET_OWNER.top}%` }}
          >
            <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] sm:px-3 sm:py-1 sm:text-[10px] ${
              !isOwnStar && isReceived(center) ? 'bg-sky-950 text-sky-200' : 'bg-[var(--ink)] text-[var(--gold-bright)]'
            }`}>
              {isOwnStar ? t('owner') : t('starLevel', { level: centerLevel })}
            </span>
            <p className="mt-0.5 max-w-[150px] truncate text-sm font-bold text-[var(--ink)] sm:mt-1 sm:max-w-[220px] sm:text-lg">{displayName(center)}</p>
            <p className="font-mono text-[10px] text-[var(--muted)] sm:text-xs">{centerCode || (isOwnStar ? t('myPosition') : '')}</p>
          </div>

          {directSlots.map(renderMember)}
        </div>

        {/* Tentacoli pieni: chi inviti ora aiuta uno dei tuoi Kumani (Spillover) */}
        {canInvite && isOwnStar && directMembers.length >= 5 && (
          <div className="mt-2 flex flex-col items-center text-center">
            <button
              type="button"
              onClick={() => setSheet({ slot: null })}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ink)] px-5 text-sm font-bold text-[var(--gold-bright)] shadow-md transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2.6} /> {t('inviteHelpButton')}
            </button>
            <p className="mt-2 max-w-sm text-xs text-[var(--muted)]">{t('inviteHelpHint')}</p>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          {canOpen ? t('starTapHint') : t('starLastLevel')}
        </p>
      </div>

      {sheet && invite && <InviteSheet invite={invite} slot={sheet.slot} target={sheet.target} onClose={() => setSheet(null)} />}

      {/* Legenda dei colori */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[var(--ink)]">
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-[var(--gold)] bg-[var(--ink)]" />{' '}
          {isOwnStar && mode === 'self' ? t('legendInvited') : t('legendInvitedBy', { name: center.first_name || 'Kumano' })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-sky-400 bg-sky-950" /> {t('legendReceived')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-sm leading-none">🎁</span> {t('legendGifted')}
        </span>
      </div>
      {isOwnStar && mode === 'self' && (
        <div className="-mt-5 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:text-left">
          <p className="max-w-md text-xs text-[var(--muted)]">{t('legendReceivedHint')}</p>
          <Link
            href="/wallet#wallet-points"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 transition hover:border-sky-400"
          >
            {t('legendWalletCta')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
        <Users className="h-4 w-4 text-[var(--gold)]" />
        <span>{t('matrixInfo')}</span>
      </div>
    </div>
  )
}
