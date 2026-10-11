// «I miei dati nei servizi» (Profilo): i dati personali di ogni servizio, da
// vedere, scaricare e cancellare anche senza piano attivo. Per ogni servizio
// le tabelle (in ordine di cancellazione: prima le righe che dipendono dalle
// altre) e gli spazi dei file (cartella <id utente>/).
// Restano fuori i servizi che coinvolgono altre persone (Shop, Menu, Kumi
// Card, Travel, Events…): lì i dati servono anche a clienti e partecipanti.

export type MyDataTable = { table: string; column: 'user_id' | 'owner_id'; casa?: boolean | 'only' }
export type MyDataService = { key: string; tool: string; tables: MyDataTable[]; buckets: string[] }

const t = (table: string, column: 'user_id' | 'owner_id' = 'user_id', casa?: boolean | 'only'): MyDataTable => ({ table, column, casa })

export const MY_DATA_SERVICES: MyDataService[] = [
  { key: 'memolife', tool: 'memolife', tables: [t('appointments'), t('tasks'), t('notes'), t('contacts')], buckets: [] },
  { key: 'life-calendar', tool: 'life-calendar', tables: [t('life_calendar_items', 'user_id', false), t('life_calendar_profiles')], buckets: [] },
  { key: 'casa', tool: 'casa', tables: [t('life_calendar_items', 'user_id', 'only'), t('casa_documents'), t('casa_appliances'), t('casa_utilities'), t('casa_homes')], buckets: ['casa-files'] },
  { key: 'garage', tool: 'garage', tables: [t('garage_documents'), t('garage_expenses'), t('garage_readings'), t('garage_deadlines'), t('garage_vehicles')], buckets: ['garage-files'] },
  { key: 'findo', tool: 'findo', tables: [t('findo_items'), t('findo_locations')], buckets: ['findo-photos'] },
  { key: 'digital-receipt', tool: 'digital-receipt', tables: [t('digital_receipts')], buckets: ['receipt-photos-v2'] },
  { key: 'spendly', tool: 'spendly', tables: [t('spendly_fixed_payments'), t('spendly_variable_expenses'), t('spendly_income'), t('spendly_fixed_expenses')], buckets: [] },
  { key: 'fincheck', tool: 'fincheck', tables: [t('fincheck_results')], buckets: [] },
  { key: 'kumani-cv', tool: 'kumani-cv', tables: [t('cvs')], buckets: ['cv-photos'] },
  { key: 'link-in-bio', tool: 'link-in-bio', tables: [t('link_in_bio')], buckets: [] },
  { key: 'qr-code-pro', tool: 'qr-code-pro', tables: [t('qr_pro_codes')], buckets: [] },
  { key: 'trova-lavoro', tool: 'trova-lavoro', tables: [t('job_favorites'), t('job_searches')], buckets: [] },
  { key: 'preventivi', tool: 'preventivi', tables: [t('quotes'), t('quote_clients')], buckets: [] },
  { key: 'magazzino', tool: 'magazzino', tables: [t('inventory_movements', 'owner_id'), t('inventory_products', 'owner_id'), t('inventory_categories', 'owner_id')], buckets: [] },
  { key: 'aureya', tool: 'aureya', tables: [t('aureya_test_results')], buckets: [] },
]

export const myDataService = (key: string) => MY_DATA_SERVICES.find((s) => s.key === key) ?? null
