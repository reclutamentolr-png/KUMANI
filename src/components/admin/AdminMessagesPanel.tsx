'use client'

import { useState, useEffect } from 'react'
import { notify } from '@/lib/adminNotify'
import {
  createAdminMessage,
  listAdminMessages,
  toggleAdminMessageActive,
  deleteAdminMessage,
  listMessageableUsers,
} from '@/app/actions/adminMessages'
import type { LocalizedText, MessageType, AdminMessageRow } from '@/lib/adminMessages'
import {
  ToggleLeft,
  ToggleRight,
  X,
  Trash2,
  MessageSquare,
  Megaphone,
  Mail,
  Send,
  LoaderCircle,
} from 'lucide-react'
import { askConfirm } from '@/lib/confirm'

// Sezione "messages" dell'Admin, caricata solo quando la si apre.
export default function AdminMessagesPanel() {
  const [messages, setMessages] = useState<AdminMessageRow[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageableUsers, setMessageableUsers] = useState<Awaited<ReturnType<typeof listMessageableUsers>>['users']>([])
  const [messageType, setMessageType] = useState<MessageType>('broadcast')
  const [messageTitle, setMessageTitle] = useState<LocalizedText>({})
  const [messageBody, setMessageBody] = useState<LocalizedText>({})
  const [activeMessageLang, setActiveMessageLang] = useState('it')
  const [messageTargetUserId, setMessageTargetUserId] = useState('')
  const [messageUserSearch, setMessageUserSearch] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [messageError, setMessageError] = useState<string | null>(null)

  const MESSAGE_LANGUAGES = ['it', 'en', 'de', 'es', 'fr', 'pt', 'ru']

  const loadMessagesData = async (silent = false) => {
    if (!silent) setLoadingMessages(true)
    const [messagesResult, usersResult] = await Promise.all([listAdminMessages(), listMessageableUsers()])
    setMessages(messagesResult.messages)
    setMessageableUsers(usersResult.users)
    setLoadingMessages(false)
  }

  const resetMessageForm = () => {
    setMessageTitle({})
    setMessageBody({})
    setActiveMessageLang('it')
    setMessageTargetUserId('')
    setMessageUserSearch('')
    setMessageError(null)
  }

  const filteredMessageUsers = (() => {
    const q = messageUserSearch.trim().toLowerCase()
    if (!q) return []
    return messageableUsers
      .filter((u) => `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 8)
  })()

  const selectMessageUser = (u: Awaited<ReturnType<typeof listMessageableUsers>>['users'][number]) => {
    setMessageTargetUserId(u.id)
    setMessageUserSearch(`${u.first_name || ''} ${u.last_name || ''} — ${u.email || ''}`)
  }

  const handleSendMessage = async () => {
    setMessageError(null)
    if (messageType === 'individual' && !messageTargetUserId) {
      setMessageError('Seleziona un destinatario.')
      return
    }
    const title = messageType === 'broadcast' ? messageTitle : { it: messageTitle.it || '' }
    const body = messageType === 'broadcast' ? messageBody : { it: messageBody.it || '' }
    if (messageType === 'broadcast' && (!title.it?.trim() || !body.it?.trim())) {
      setMessageError('Il testo in Italiano è obbligatorio (almeno una lingua di riferimento).')
      return
    }
    if (messageType === 'individual' && (!title.it?.trim() || !body.it?.trim())) {
      setMessageError('Titolo e testo sono obbligatori.')
      return
    }
    setSendingMessage(true)
    const result = await createAdminMessage(messageType, messageType === 'individual' ? messageTargetUserId : null, title, body)
    setSendingMessage(false)
    if (!result.success) {
      setMessageError(result.error)
      return
    }
    resetMessageForm()
    await loadMessagesData(true)
  }

  const handleToggleMessageActive = async (id: string, currentActive: boolean) => {
    const result = await toggleAdminMessageActive(id, !currentActive)
    if (result.success) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: !currentActive } : m)))
    } else {
      notify(result.error)
    }
  }

  const handleDeleteMessage = async (id: string) => {
    if (!(await askConfirm('Eliminare definitivamente questo messaggio?'))) return
    const result = await deleteAdminMessage(id)
    if (result.success) {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } else {
      notify(result.error)
    }
  }

  // Dati della sezione all'apertura
  useEffect(() => {
    // Caricamento dei dati della sezione (con il segnale "caricamento"):
    // è proprio il compito di questo effetto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessagesData()
  }, [])

  const renderMessages = () => {
    const currentLang = messageType === 'broadcast' ? activeMessageLang : 'it'
    const LANG_LABELS: Record<string, string> = { it: 'IT', en: 'EN', de: 'DE', es: 'ES', fr: 'FR', pt: 'PT', ru: 'RU' }

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-7 h-7" />
            Messaggi
          </h2>
          <p className="text-gray-600 mt-1">
            Invia una comunicazione a tutti gli utenti (in tutte le lingue del sito) o a un singolo utente.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMessageType('broadcast'); resetMessageForm() }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                messageType === 'broadcast' ? 'bg-[var(--ink)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Megaphone className="w-4 h-4" /> A tutti gli utenti
            </button>
            <button
              type="button"
              onClick={() => { setMessageType('individual'); resetMessageForm() }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                messageType === 'individual' ? 'bg-[var(--ink)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Mail className="w-4 h-4" /> A un utente singolo
            </button>
          </div>

          {messageType === 'individual' && (
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Destinatario</label>
              {messageTargetUserId ? (
                <div className="flex items-center justify-between bg-[var(--gold-pale)] border border-[var(--gold)]/30 rounded-lg px-3 py-2">
                  <span className="text-sm text-[var(--ink)]">{messageUserSearch}</span>
                  <button type="button" onClick={() => { setMessageTargetUserId(''); setMessageUserSearch('') }} className="text-gray-500 hover:text-gray-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={messageUserSearch}
                    onChange={(e) => setMessageUserSearch(e.target.value)}
                    placeholder="Cerca per nome o email..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                  />
                  {filteredMessageUsers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {filteredMessageUsers.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => selectMessageUser(u)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                        >
                          <p className="font-medium text-gray-900">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {messageType === 'broadcast' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lingua</label>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveMessageLang(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      activeMessageLang === lang ? 'bg-[var(--gold)] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    } ${messageTitle[lang]?.trim() && messageBody[lang]?.trim() ? 'ring-2 ring-green-400' : ''}`}
                  >
                    {LANG_LABELS[lang]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1.5">L’italiano è obbligatorio; le altre lingue sono facoltative (se lasciate vuote, quell’utente vedrà il testo in italiano).</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titolo {messageType === 'broadcast' ? `(${LANG_LABELS[currentLang]})` : ''}</label>
            <input
              type="text"
              value={messageTitle[currentLang] || ''}
              onChange={(e) => setMessageTitle((prev) => ({ ...prev, [currentLang]: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Testo {messageType === 'broadcast' ? `(${LANG_LABELS[currentLang]})` : ''}</label>
            <textarea
              value={messageBody[currentLang] || ''}
              onChange={(e) => setMessageBody((prev) => ({ ...prev, [currentLang]: e.target.value }))}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
            />
          </div>

          {messageError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{messageError}</div>
          )}

          <button
            onClick={handleSendMessage}
            disabled={sendingMessage}
            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-white rounded-lg hover:bg-[var(--ink-soft)] disabled:opacity-50 font-medium"
          >
            {sendingMessage ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sendingMessage ? 'Invio...' : 'Invia messaggio'}
          </button>
        </div>

        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Destinatario</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Titolo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Stato</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loadingMessages ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Caricamento...</td></tr>
              ) : messages.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nessun messaggio inviato ancora</td></tr>
              ) : (
                messages.map((m) => {
                  const targetUser = messageableUsers.find((u) => u.id === m.target_user_id)
                  const titlePreview = m.title?.it || Object.values(m.title || {})[0] || '—'
                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.type === 'broadcast' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {m.type === 'broadcast' ? <Megaphone className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                          {m.type === 'broadcast' ? 'A tutti' : 'Individuale'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {m.type === 'broadcast' ? 'Tutti gli utenti' : (targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : '—')}
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{titlePreview}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(m.created_at).toLocaleDateString('it-IT')}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleMessageActive(m.id, m.is_active)}
                          className="focus:outline-none"
                          title={m.is_active ? 'Disattiva' : 'Riattiva'}
                        >
                          {m.is_active ? <ToggleRight className="w-9 h-6 text-green-500" /> : <ToggleLeft className="w-9 h-6 text-gray-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteMessage(m.id)} className="text-red-500 hover:text-red-700 text-xs font-medium inline-flex items-center gap-1">
                          <Trash2 className="w-3.5 h-3.5" /> Elimina
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return renderMessages()
}
