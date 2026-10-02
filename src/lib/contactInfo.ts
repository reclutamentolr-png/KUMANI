// Recapiti pubblici di KUMANI mostrati nella pagina Contatti e nella Privacy.
// Da completare prima del lancio: i campi a null vengono mostrati come
// "in arrivo" (Contatti) o come segnaposto da compilare (Privacy).
export const CONTACT_INFO = {
  supportEmail: 'support@kumani.io' as string | null,
  privacyEmail: 'privacy@kumani.io' as string | null,
  infoEmail: 'info@kumani.io' as string | null,
  whatsapp: null as string | null, // numero in formato internazionale, es. '+393331234567'
  responseTime: '24–48h',
  company: {
    name: null as string | null, // ragione sociale del titolare
    address: null as string | null, // sede legale
    vatNumber: null as string | null, // P.IVA
    pec: null as string | null,
  },
}

// Indirizzi @kumani.io gestiti in Admin → Gestione Email: Cloudflare Email
// Routing li inoltra alla casella Gmail di KUMANI.
export const KUMANI_MAILBOXES = [
  { address: 'support@kumani.io', name: 'KUMANI Supporto', label: 'Assistenza agli utenti' },
  { address: 'privacy@kumani.io', name: 'KUMANI Privacy', label: 'Privacy e richieste GDPR' },
  { address: 'info@kumani.io', name: 'KUMANI Info', label: 'Informazioni generali' },
] as const
