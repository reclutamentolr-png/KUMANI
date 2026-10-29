// «Vocale sospetto?»: il testo di un messaggio vocale (trascritto nel
// telefono) si controlla con regole nostre, senza IA. Le regole cercano i
// segnali tipici delle truffe al telefono e su WhatsApp, in italiano. Non
// dicono se una voce è vera o fatta con l'IA: nessuno oggi lo sa fare in
// modo affidabile.

export type VoiceSignalKey = 'family' | 'accident' | 'money' | 'iban' | 'code' | 'remote' | 'urgency' | 'secrecy' | 'authority' | 'bank' | 'courier' | 'investment' | 'prize' | 'link'
export type VoiceSignal = { key: VoiceSignalKey; weight: number; quote: string }
export type VoiceRisk = 'high' | 'medium' | 'low' | 'none'
export type VoiceVerdict = { risk: VoiceRisk; score: number; signals: VoiceSignal[] }

// Peso: 3 = segnale forte, 2 = medio, 1 = debole
const RULES: { key: VoiceSignalKey; weight: number; re: RegExp }[] = [
  // «Ciao mamma, ho cambiato numero»
  { key: 'family', weight: 3, re: /\b(?:(?:ho|abbiamo) cambiato (?:il )?numero|numero nuovo|nuovo numero|questo e il mio (?:nuovo )?numero|(?:mi si e|ho) (?:rotto|perso|caduto) (?:il )?telefono|telefono (?:rotto|caduto|perso))\b/ },
  { key: 'accident', weight: 3, re: /\b(?:incidente|in ospedale|al pronto soccorso|arrestat[oa]|in prigione|in carcere|cauzione|mi hanno fermat[oa])\b/ },
  { key: 'money', weight: 3, re: /\b(?:bonifico|ricaric(?:a|are|ami)|postepay|paysafe|gift ?card|buono amazon|bitcoin|cripto\w*|western union|moneygram|mandami (?:dei |i )?soldi|prestami|mi servono (?:dei |i )?soldi|mi serve(?:rebbe)? (?:un )?(?:prestito|bonifico)|devi (?:pagare|versare)|paga(?:re)? subito)\b/ },
  { key: 'iban', weight: 3, re: /\biban\b|\bit ?\d{2} ?[a-z](?: ?\d){5}/ },
  // Codici: i truffatori chiedono di leggere l'sms appena arrivato
  { key: 'code', weight: 3, re: /\b(?:codice|codici|otp|pin|password|credenziali)\b[^.?]{0,60}\b(?:arrivat\w*|sms|messaggio|dimmi|dammi|mi dica|leggimi|mi legga|legga|me lo (?:puo |puoi )?legg\w*|mandami|comunicami|mi comunichi|comunichi|dettami|mi detti|detti|ripeta)\b|\b(?:mi legga|me lo legga|leggimi|dimmi|mi dica|mi detti|dettami|mi comunichi|comunicami|mi dia|dammi)\b[^.?]{0,30}\b(?:codice|codici|otp|pin|password|credenziali)\b|\b(?:ti|le|vi) (?:e |sta per |stara per )?arriva(?:to|re|ra)? un (?:sms|messaggio|codice)\b/ },
  { key: 'remote', weight: 3, re: /\b(?:anydesk|teamviewer|quick ?support|assistenza (?:da )?remot\w*|installa(?:re)? (?:questa |l')?app|scarica(?:re)? (?:questa |l')?app)\b/ },
  { key: 'urgency', weight: 2, re: /\b(?:subito|urgente\w*|immediatamente|entro oggi|entro un'ora|entro stasera|il prima possibile|non c'e tempo|di corsa|altrimenti|ultim[oa] (?:avviso|possibilita))\b/ },
  { key: 'secrecy', weight: 2, re: /\b(?:non (?:dir(?:lo|e niente)|dica niente|lo dica|dirlo)(?: a nessuno)?|resti tra noi|non (?:chiamare|chiami|avvisare|avvisi|parlarne con|ne parli con) (?:nessuno|papa|mamma|la banca)|non chiamarmi|non posso parlare)\b/ },
  { key: 'authority', weight: 2, re: /\b(?:carabinier\w*|polizia(?: postale)?|guardia di finanza|questura|maresciallo|avvocato|tribunale|agenzia delle entrate|inps|ufficio (?:sicurezza|antifrode)|antifrode)\b/ },
  { key: 'bank', weight: 2, re: /\b(?:conto (?:corrente )?(?:bloccato|sospeso|(?:e )?a rischio|in pericolo)|operazione sospetta|accesso anomalo|carta (?:bloccata|clonata|sospesa)|movimento sospetto|addebito non autorizzato|(?:la|dalla|della|alla|nella|sua|tua|vostra) banca|poste italiane|intesa sanpaolo|unicredit|bnl|bper|fineco|n26|revolut|paypal)\b/ },
  { key: 'courier', weight: 2, re: /\b(?:pacco|spedizione|corriere|consegna)\b[^.]{0,60}\b(?:pagare|spese|tassa|dogana|giacenza|sbloccare|link)\b/ },
  // Guadagni promessi: segnale forte; un investimento nominato e basta: debole
  { key: 'investment', weight: 3, re: /\b(?:guadagn\w* (?:e |sono )?(?:sicur\w*|garantit\w*)|rendiment\w* (?:sicur\w*|garantit\w*)|raddoppi\w* (?:i soldi|l'investimento|il capitale)|senza (?:alcun )?rischio)\b/ },
  { key: 'investment', weight: 1, re: /\b(?:investiment\w*|trading|broker|piattaforma di (?:investimento|trading))\b/ },
  { key: 'prize', weight: 1, re: /\b(?:hai vinto|sei stat[oa] estratt[oa]|vincitor\w*|premio|regalo per te|buono omaggio)\b/ },
  { key: 'link', weight: 2, re: /\b(?:clicca\w*|(?:apri|apra|segui|segua|ti mando|le mando) (?:il|questo) link|link che (?:ti|le|vi) (?:mando|ho mandato|invio|arriva))\b/ },
]

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, ' ')

export function scanVoiceText(text: string): VoiceVerdict {
  const plain = normalize(text)
  const original = text.replace(/\s+/g, ' ')
  const signals: VoiceSignal[] = []
  for (const rule of RULES) {
    // Una regola per tipo di segnale: la più forte, se c'è, vince
    if (signals.some((s) => s.key === rule.key)) continue
    const m = plain.match(rule.re)
    if (!m || m.index === undefined) continue
    // La frase detta, per mostrare dove sta il segnale (stessa posizione: la normalizzazione non cambia la lunghezza)
    const from = Math.max(0, m.index - 30)
    const to = Math.min(original.length, m.index + m[0].length + 30)
    const quote = `${from > 0 ? '…' : ''}${original.slice(from, to).trim()}${to < original.length ? '…' : ''}`
    signals.push({ key: rule.key, weight: rule.weight, quote })
  }
  const score = signals.reduce((n, s) => n + s.weight, 0)
  const has = (k: VoiceSignalKey) => signals.some((s) => s.key === k)
  const strong = signals.some((s) => s.weight === 3)
  // Le combinazioni classiche: familiare con numero nuovo + soldi, finta autorità + soldi o codici
  const classic = (has('family') && (has('money') || has('iban') || has('urgency'))) || (has('accident') && has('money')) || ((has('authority') || has('bank')) && (has('money') || has('code') || has('remote')))
  const risk: VoiceRisk = classic || (strong && score >= 5) ? 'high' : score >= 3 || strong ? 'medium' : score > 0 ? 'low' : 'none'
  return { risk, score, signals: signals.sort((a, b) => b.weight - a.weight) }
}
