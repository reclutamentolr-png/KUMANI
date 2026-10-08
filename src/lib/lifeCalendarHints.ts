import type { Category } from './lifeCalendar'

// Riconosce nei promemoria di MemoLife le cose che in realtà sono scadenze
// da rinnovare (documenti, auto, assicurazioni, contratti, garanzie) e
// suggerisce la categoria di Life Calendar. Parole nelle 7 lingue del sito,
// confrontate senza accenti e senza maiuscole; l'ordine conta (prima le più
// specifiche: «assicurazione auto» è Auto, «assicurazione» da sola è Contratti).

const RULES: [Category, string[]][] = [
  [
    'auto',
    [
      'revisione', 'bollo auto', 'assicurazione auto', 'rc auto', 'tagliando', 'cambio gomme',
      'mot test', 'car insurance', 'road tax', 'car service',
      'controle technique', 'assurance auto', 'vignette',
      'itv', 'seguro del coche', 'seguro de coche',
      'inspecao', 'seguro automovel', 'iuc',
      'tuv', 'hauptuntersuchung', 'kfz-versicherung', 'kfz-steuer', 'autoversicherung',
      'техосмотр', 'осаго', 'каско',
    ],
  ],
  [
    'person',
    [
      "carta d'identita", 'carta di identita', 'passaporto', 'patente', 'tessera sanitaria', 'permesso di soggiorno',
      'passport', 'driving licence', 'driving license', "driver's license", 'id card', 'identity card',
      "carte d'identite", 'passeport', 'permis de conduire', 'carte vitale', 'titre de sejour',
      'pasaporte', 'carnet de conducir', 'dni', 'permiso de conducir', 'tarjeta sanitaria',
      'passaporte', 'carta de conducao', 'cartao de cidadao',
      'reisepass', 'personalausweis', 'fuhrerschein', 'aufenthaltstitel',
      'паспорт', 'водительск', 'права', 'загранпаспорт',
    ],
  ],
  ['warranties', ['garanzia', 'warranty', 'guarantee', 'garantie', 'garantia', 'гарантия']],
  [
    'contracts',
    [
      'assicurazione', 'polizza', 'contratto', 'insurance', 'contract', 'assurance', 'contrat',
      'seguro', 'contrato', 'versicherung', 'vertrag', 'страховк', 'полис', 'договор',
    ],
  ],
  ['home', ['caldaia', 'canone rai', 'boiler service', 'chaudiere', 'caldera', 'caldeira', 'heizungswartung', 'котел']],
  [
    'other',
    ['rinnovo', 'rinnovare', 'scadenza', 'renewal', 'renew', 'expires', 'renouvel', 'renovar', 'renovacion', 'renovacao', 'verlangern', 'erneuern', 'продлить', 'продление'],
  ],
]

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ё/g, 'е')
    .replace(/[’`]/g, "'")

export function suggestLifeCalendarCategory(title: string): Category | null {
  const text = ` ${normalize(title)} `
  if (text.trim().length < 3) return null
  for (const [category, words] of RULES)
    for (const word of words) {
      const w = normalize(word)
      // Parole brevi (dni, itv, iuc, mot…) solo come parola intera
      if (w.length <= 4 ? new RegExp(`[^\\p{L}]${w}[^\\p{L}]`, 'u').test(text) : text.includes(w)) return category
    }
  return null
}
