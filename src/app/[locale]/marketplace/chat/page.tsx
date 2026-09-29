import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { getUserConversations } from '@/lib/listings-server'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Clock, MessageCircle } from 'lucide-react'
import ChatModalWrapper from '@/components/ChatModalWrapper'
import ConversationItem from '@/components/ConversationItem' // ✅ Import del componente client separato
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ChatInboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const t = await getTranslations('chat')
  const conversations = await getUserConversations(user.id)

  const online = await isToolOnline('chat')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="bg-[var(--ink)] text-white shadow-lg border-b border-[var(--gold)]/25 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          {/* Si arriva qui dalla Bacheca: si torna alla Bacheca (e da lì alla dashboard) */}
          <Link href="/marketplace/listings" className="flex items-center gap-2 text-white/80 hover:text-[var(--gold-bright)] transition-colors font-medium">
            <ArrowLeft className="w-5 h-5" />
            {t('backToBoard')}
          </Link>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] p-2 rounded-lg">
              <MessageCircle className="w-5 h-5 text-[var(--ink)]" />
            </div>
            <h1 className="text-xl font-bold text-white">{t('pageTitle')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {!online && <SuspendedBanner className="mb-6" />}
        {/* Cancellazione automatica dopo 30 giorni: ben visibile */}
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-3 text-sm font-semibold text-[var(--ink)]">
          <Clock className="h-5 w-5 shrink-0 text-[var(--gold)]" />
          {t('retention')}
        </p>
        {conversations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[var(--gold)]/25 p-12 text-center">
            <MessageCircle className="w-16 h-16 text-[var(--gold)]/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[var(--ink)] mb-2">{t('inboxEmptyTitle')}</h3>
            <p className="text-[var(--muted)] mb-6">{t('inboxEmptyText')}</p>
            <Link href="/marketplace/listings" className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 text-[var(--ink)] px-5 py-2.5 rounded-xl font-bold transition-all">
              {t('goToBoard')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conv: any) => (
  <ConversationItem 
    key={conv.key}
    convKey={conv.key}
    listingId={conv.listingId}
    listingTitle={conv.listingTitle || t('directMessage')}
    otherUserId={conv.otherUserId}
    otherUserName={conv.otherUserName || t('someone')}
    lastMessage={conv.lastMessage}
    unreadCount={conv.unreadCount}
    currentUserId={user.id}
    initiatedBy={conv.initiatedBy}
  />
))}
          </div>
        )}
      </main>

      {/* Wrapper per aprire la chat modale */}
      <ChatModalWrapper userId={user.id} />
    </div>
  )
}