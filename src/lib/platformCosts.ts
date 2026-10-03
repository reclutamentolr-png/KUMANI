// Costi della piattaforma (Admin → Costi e margini): categorie ed etichette.

export const COST_CATEGORIES = ['hosting', 'database', 'email', 'dominio', 'proxy', 'ai', 'software', 'consulenze', 'marketing', 'banca', 'altro'] as const
export type CostCategory = (typeof COST_CATEGORIES)[number]
export type CostFrequency = 'monthly' | 'yearly' | 'one_off'

export const COST_CATEGORY_LABEL: Record<CostCategory, string> = {
  hosting: 'Hosting',
  database: 'Database',
  email: 'Email',
  dominio: 'Dominio e DNS',
  proxy: 'Proxy',
  ai: 'Intelligenza artificiale',
  software: 'Software e licenze',
  consulenze: 'Consulenze',
  marketing: 'Marketing e pubblicità',
  banca: 'Banca e pagamenti',
  altro: 'Altro',
}

export const FREQUENCY_LABEL: Record<CostFrequency, string> = { monthly: 'Mensile', yearly: 'Annuale', one_off: 'Una tantum' }
