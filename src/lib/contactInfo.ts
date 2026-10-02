// Recapiti pubblici di KUMANI mostrati nella pagina Contatti e nella Privacy.
// Da completare prima del lancio: i campi a null vengono mostrati come
// "in arrivo" (Contatti) o come segnaposto da compilare (Privacy).
export const CONTACT_INFO = {
  supportEmail: null as string | null, // es. 'supporto@kumani.io'
  privacyEmail: null as string | null, // es. 'privacy@kumani.io'
  whatsapp: null as string | null, // numero in formato internazionale, es. '+393331234567'
  responseTime: '24–48h',
  company: {
    name: null as string | null, // ragione sociale del titolare
    address: null as string | null, // sede legale
    vatNumber: null as string | null, // P.IVA
    pec: null as string | null,
  },
}
