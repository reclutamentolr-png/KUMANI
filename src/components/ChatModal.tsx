'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X, Send, MessageCircle, Tag } from 'lucide-react'

type ChatModalProps = {
  isOpen: boolean
  onClose: () => void
  listing: any
  currentUserId: string
  receiverId: string
}

export default function ChatModal({ isOpen, onClose, listing, currentUserId, receiverId }: ChatModalProps) {
  const [messages, setMessages] = useState<any[]>([])
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
      .order('created_at', { ascending: true })
    
    if (error) {
      console.error('Errore caricamento messaggi:', error)
      return
    }
    
    setMessages(data || [])
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
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: receiverId,
      listing_id: listing.id,
      content: newMessage.trim()
    })
    
    if (!error) {
      setNewMessage('')
      await loadMessages()
    } else {
      console.error('Errore invio messaggio:', error)
      alert('Errore nell\'invio del messaggio')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen && listing && currentUserId && receiverId) {
      console.log('💬 Apertura chat:', { 
        listing: listing.id, 
        tra: currentUserId, 
        e: receiverId 
      })
      
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
            filter: `and(listing_id=eq.${listing.id},sender_id=eq.${receiverId},receiver_id=eq.${currentUserId})`
          },
          (payload) => {
            console.log('📨 Nuovo messaggio ricevuto in tempo reale:', payload.new)
            setMessages((prev) => [...prev, payload.new])
            
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
        <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">
                Conversazione con {listing.profiles?.first_name} {listing.profiles?.last_name}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-0.5">
                <Tag className="w-3 h-3" />
                <span className="truncate max-w-[200px]">{listing.title}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Area messaggi */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <MessageCircle className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nessun messaggio in questa conversazione</p>
              <p className="text-sm mt-1">Inizia tu la conversazione!</p>
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
                          ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${isMe ? 'text-indigo-100' : 'text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleString('it-IT', { 
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
        <div className="p-4 border-t border-gray-200 bg-white">
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
              placeholder={`Scrivi a ${listing.profiles?.first_name}...`}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !newMessage.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full flex items-center gap-2 font-medium shadow-md transition-all"
            >
              <Send className="w-4 h-4" />
              Invia
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}