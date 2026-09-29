'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { markMessagesAsRead, deleteConversationAction } from '@/app/actions/listings'
import { User, FileText, Trash2 } from 'lucide-react'

type ConversationItemProps = {
  convKey: string
  listingId: string | null
  listingTitle: string
  otherUserId: string
  otherUserName: string
  lastMessage: string
  unreadCount: number
  currentUserId: string
  initiatedBy: string
}

export default function ConversationItem({
  convKey,
  listingId,
  listingTitle,
  otherUserId,
  otherUserName,
  lastMessage,
  unreadCount,
  currentUserId,
  initiatedBy
}: ConversationItemProps) {
  const t = useTranslations('chat')
  const [unread, setUnread] = useState(unreadCount)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  // ✅ Solo chi ha iniziato la conversazione può eliminarla
  const canDelete = initiatedBy === currentUserId

  const handleClick = async () => {
    if (isDeleting) return

    if (unread > 0) {
      const result = await markMessagesAsRead(currentUserId, otherUserId, listingId || undefined)
      if (result.success) {
        setUnread(0)
        window.dispatchEvent(new CustomEvent('refreshUnreadCount'))
      }
    }

    const listing = listingId
      ? { id: listingId, title: listingTitle, user_id: otherUserId }
      : null

    window.dispatchEvent(new CustomEvent('openChat', {
      detail: {
        listing: listing || { id: 'direct', title: t('directMessage'), user_id: otherUserId },
        receiverId: otherUserId,
        otherName: otherUserName
      }
    }))
  }

  // ✅ CANCELLAZIONE CORRETTA: chiama la server action e ricarica la pagina
  const handleDelete = async (e: React.SyntheticEvent) => {
    e.stopPropagation()
    if (!confirm(t('confirmDelete'))) return

    setIsDeleting(true)
    const result = await deleteConversationAction(currentUserId, otherUserId, listingId || undefined)

    if (result.success) {
      setDeleted(true)
      // ✅ Forza il ricaricamento completo della pagina: i dati vengono riletti dal DB
      window.location.reload()
    } else {
      alert(t('deleteError'))
    }
    setIsDeleting(false)
  }

  if (deleted) return null

  return (
    <div className={`relative bg-white rounded-2xl border p-4 hover:shadow-md transition-all ${
      unread > 0 ? 'border-[var(--gold)]/60 bg-[var(--gold-pale)]/30' : 'border-[var(--gold)]/25'
    }`}>
      <button onClick={handleClick} className="w-full flex items-start gap-4 text-left">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          unread > 0 ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--paper)] text-[var(--muted)]'
        }`}>
          {listingId ? <FileText className="w-6 h-6" /> : <User className="w-6 h-6" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h3 className={`font-semibold truncate ${unread > 0 ? 'text-[var(--ink)]' : 'text-[var(--ink-soft)]'}`}>
                {listingTitle}
              </h3>
              {unread > 0 && (
                <span className="bg-[var(--gold)] text-[var(--ink)] text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                  {unread === 1 ? t('newOne') : t('newMany', { count: unread })}
                </span>
              )}
            </div>

            {/* ✅ Cestino visibile SOLO a chi ha iniziato la conversazione */}
            {canDelete && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleDelete}
                onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(e) }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors flex-shrink-0 ml-2"
                title={t('deleteTitle')}
              >
                <Trash2 className={`w-4 h-4 ${isDeleting ? 'animate-pulse' : ''}`} />
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--muted)] mb-1">{otherUserName}</p>
          <p className={`text-sm truncate ${unread > 0 ? 'text-[var(--ink)] font-medium' : 'text-[var(--muted)]'}`}>
            {lastMessage}
          </p>
        </div>
      </button>
    </div>
  )
}