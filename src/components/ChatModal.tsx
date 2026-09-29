'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { X, Send, MessageCircle, Tag, Clock } from 'lucide-react'
import type { ChatListing, ListingMessage } from '@/lib/listings'

type ChatModalProps = {
  isOpen: boolean
  onClose: () => void
  listing: ChatListing
  currentUserId: string
  receiverId: string
  // Nome della persona con cui si parla (non sempre è chi ha pubblicato l'annuncio)
  otherName?: string
}

export default function ChatModal({ isOpen, onClose, listing, currentUserId, receiverId, otherName }: ChatModalProps) {
  const t = useTranslations('chat')
  const locale = useLocale()
  // Il nome dell'altra persona: quello passato da chi apre la chat, oppure
  // l'autore dell'annuncio se è lui che riceve (mai "undefined")
  const name = (otherName || (listing?.user_id === receiverId ? listing?.profiles?.first_name : '') || '').trim()
  const [messages, setMessages] = useState<ListingMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Scroll automatico in basso quando arrivano nuovi messaggi
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // ✅ FUNZIONE CORRETTA: Filtra SOLO i messaggi tra i 2 utenti specifici per quell'annuncio
  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('listing_id', listing.id)
      // ✅ Filtro rigoroso: solo messaggi tra currentUserId e receiverId in entrambe le direzioni
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`)
      // Solo gli ultimi 100 (i più recenti, poi rimessi in ordine)
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (error) {
      console.error('Errore caricamento messaggi:', error)
      return
    }
    
    setMessages((data || []).reverse())
  }

  // ✅ Segna i messaggi ricevuti come letti
  const markAsRead = async () => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('listing_id', listing.id)
      .eq('sender_id', receiverId)
      .eq('receiver_id', currentUserId)
      .eq('is_read', false)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || loading) return
    
    setLoading(true)
    const { data: sent, error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUserId,
        receiver_id: receiverId,
        listing_id: listing.id,
        content: newMessage.trim()
      })
      .select()
      .single()
    
    if (!error) {
      setNewMessage('')
      // Si aggiunge il messaggio inviato, senza ricaricare tutta la chat
      if (sent) setMessages((prev) => [...prev, sent])
      else await loadMessages()
    } else {
      console.error('Errore invio messaggio:', error)
      alert(t('sendError'))
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen && listing && currentUserId && receiverId) {
      loadMessages()
      markAsRead()

      // ✅ REALTIME: Filtra SOLO i messaggi in arrivo dall'altro utente per QUESTO annuncio specifico
      const channelName = `chat-${listing.id}-${currentUserId}-${receiverId}`
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            // Il filtro in tempo reale accetta una sola condizione: i
            // messaggi per me; annuncio e mittente si controllano qui sotto
            // (prima c'era un filtro and(...) che il servizio non accetta).
            filter: `receiver_id=eq.${currentUserId}`
          },
          (payload) => {
            const incoming = payload.new as ListingMessage
            if (incoming.listing_id !== listing.id || incoming.sender_id !== receiverId) return
            setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]))
            
            // Segna il nuovo messaggio come letto immediatamente (le query
            // supabase-js partono solo con then/await)
            void supabase
              .from('messages')
              .update({ is_read: true })
              .eq('id', payload.new.id)
              .then(() => window.dispatchEvent(new CustomEvent('refreshUnreadCount')))
            
            // Suono di notifica
            try {
              const audio = new Audio('/notification.mp3')
              audio.volume = 0.4
              audio.play().catch(() => {})
            } catch (e) {}
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [isOpen, listing, currentUserId, receiverId])

  if (!isOpen || !listing) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header con info chiare sulla conversazione */}
        <div className="flex justify-between items-center p-5 border-b border-[var(--gold)]/25 bg-[var(--paper)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--ink)] flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-[var(--gold-bright)]" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--ink)]">
                {name ? t('titleWith', { name }) : t('title')}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] mt-0.5">
                <Tag className="w-3 h-3 text-[var(--gold)]" />
                <span className="truncate max-w-[200px]">{listing.title}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--ink)] p-2 rounded-full hover:bg-[var(--gold)]/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Area messaggi */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[var(--background)]">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <MessageCircle className="w-16 h-16 mx-auto mb-3 text-[var(--gold)] opacity-40" />
              <p className="font-medium">{t('emptyTitle')}</p>
              <p className="text-sm mt-1">{t('emptyText')}</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${
                        isMe
                          ? 'bg-[var(--ink)] text-white border border-[var(--gold)]/30 rounded-br-sm'
                          : 'bg-white text-[var(--ink)] border border-[var(--gold)]/25 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${isMe ? 'text-[var(--gold-pale)]/80' : 'text-[var(--muted)]'}`}>
                        {new Date(msg.created_at).toLocaleString(locale, { 
                          day: '2-digit', 
                          month: '2-digit', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input messaggio */}
        <div className="p-4 border-t border-[var(--gold)]/25 bg-white">
          {/* Cancellazione automatica dopo 30 giorni: ben visibile */}
          <p className="mb-3 flex items-center gap-2 rounded-lg bg-[var(--gold-pale)] px-3 py-2 text-xs font-semibold text-[var(--ink)]">
            <Clock className="h-4 w-4 shrink-0 text-[var(--gold)]" />
            {t('retention')}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={name ? t('placeholderWith', { name }) : t('placeholder')}
              className="flex-1 px-4 py-2.5 border border-[var(--gold)]/30 rounded-full focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !newMessage.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-[var(--ink)] rounded-full flex items-center gap-2 font-bold shadow-md transition-all"
            >
              <Send className="w-4 h-4" />
              {t('send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}