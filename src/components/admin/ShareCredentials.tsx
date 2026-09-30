'use client'

import { Mail, MessageCircle } from 'lucide-react'

// Invio delle credenziali di un nuovo account (agente, traduttore) via
// WhatsApp o email, con il messaggio già scritto. Con il telefono si apre
// direttamente la chat di quella persona.
export default function ShareCredentials({
  message,
  subject,
  email,
  phone,
}: {
  message: string
  subject: string
  email?: string
  phone?: string
}) {
  const digits = (phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '')
  // Numero italiano senza prefisso internazionale: si aggiunge il 39
  const waNumber = digits && digits.length <= 10 && digits.startsWith('3') ? `39${digits}` : digits
  const whatsapp = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
  const mail = `mailto:${encodeURIComponent(email ?? '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`
  const button = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110'
  return (
    <>
      <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${button} bg-[#25d366]`}>
        <MessageCircle className="h-4 w-4" /> Invia su WhatsApp
      </a>
      <a href={mail} className={`${button} bg-[var(--ink)]`}>
        <Mail className="h-4 w-4" /> Invia per email
      </a>
    </>
  )
}
