// Promemoria a voce (Agenda): dalla frase detta («martedì 11 ottobre ho il
// dentista alle 15») si ricavano cosa, giorno e ora, con regole nostre e
// senza IA. Solo italiano per ora. Non salva niente: prepara la bozza, che la
// persona controlla e conferma nel modulo dell'appuntamento.

export type VoiceDraft = {
  kind: 'appointment' | 'task'
  title: string
  date: string | null // AAAA-MM-GG
  time: string | null // HH:MM
  // Il giorno della settimana detto non corrisponde alla data: si propongono le due date
  weekdayMismatch: { said: number; dateAsSaid: string; nearest: string } | null
  // La data detta era già passata quest'anno: si è presa quella dell'anno prossimo
  movedToNextYear: boolean
}

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
// 0 = domenica, come Date.getDay()
const WEEKDAYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato']
const NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, primo: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16, diciassette: 17, diciotto: 18, diciannove: 19,
  venti: 20, ventuno: 21, ventidue: 22, ventitre: 23, ventiquattro: 24, venticinque: 25, ventisei: 26, ventisette: 27, ventotto: 28,
  ventinove: 29, trenta: 30, trentuno: 31,
}
const NUM = `(\\d{1,2}|${Object.keys(NUMBERS).sort((a, b) => b.length - a.length).join('|')})`
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : NUMBERS[s] ?? NaN)

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const validDay = (y: number, m: number, d: number) => {
  const x = new Date(y, m, d)
  return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d
}

// Minuscole e senza accenti, per riconoscere «martedì», «lunedi», «ventitré»…
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")

export function parseVoiceReminder(spoken: string, now: Date = new Date()): VoiceDraft {
  const original = spoken.replace(/\s+/g, ' ').trim()
  let text = normalize(original)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  // Le parti riconosciute si tolgono dal testo: quello che resta è il titolo
  const cut = (re: RegExp) => {
    text = text.replace(re, ' ')
  }

  let date: Date | null = null
  let weekday: number | null = null
  let movedToNextYear = false

  // --- Fra qualche ora: «fra due ore», «tra un'ora», «tra mezz'ora»
  let time: string | null = null
  const relHoursRe = new RegExp(`\\b(?:tra|fra) (?:(mezz'|mezza )ora|(?:un'|una )ora(?: e mezza)?|${NUM} ore(?: e mezza)?)\\b`)
  const relHours = text.match(relHoursRe)
  if (relHours) {
    const half = /mezz/.test(relHours[0])
    const n = relHours[1] ? 0 : relHours[2] ? toNum(relHours[2]) : 1
    const at = new Date(now.getTime() + (n * 60 + (half ? 30 : 0)) * 60000)
    date = new Date(at.getFullYear(), at.getMonth(), at.getDate())
    time = `${pad(at.getHours())}:${pad(at.getMinutes())}`
    cut(relHoursRe)
  }

  // --- Parte del giorno detta a parte: «domani sera alle 8», «stamattina alle 10»
  let dayPart = ''
  const partRe = /\b(?:(stamattina|stamani|stanotte)|(?:di |la |in |nel |del |della )?(mattin[ao]|pomeriggio|sera|notte))\b/
  const part = text.match(partRe)
  if (part) {
    dayPart = part[1] ? (part[1] === 'stanotte' ? 'notte' : 'mattina') : part[2]
    if (part[1]) date = today
    cut(partRe)
  }

  // --- Ora: «alle 15», «alle 15:30», «alle otto e mezza», «a mezzogiorno», «alle 3 del pomeriggio»
  const noon = text.match(/\b(a |verso )?mezzogiorno\b/)
  const midnight = text.match(/\b(a |verso )?mezzanotte\b/)
  if (time) {
    // già presa da «fra due ore»
  } else if (noon) {
    time = '12:00'
    cut(/\b(a |verso )?mezzogiorno\b/)
  } else if (midnight) {
    time = '00:00'
    cut(/\b(a |verso )?mezzanotte\b/)
  } else {
    const re = new RegExp(`\\b(?:alle|all'|verso le|per le|ore|alle ore)\\s*${NUM}(?:\\s*(?:[:.]|e)\\s*(\\d{1,2}|mezza|mezzo|un quarto|quarto|tre quarti|cinque|dieci|quindici|venti|venticinque|trenta|quaranta|cinquanta)\\b)?(?:\\s*(del mattino|di mattina|della mattina|del pomeriggio|di pomeriggio|di sera|della sera|di notte))?`)
    const m = text.match(re)
    if (m) {
      let h = toNum(m[1])
      const part = m[2]
      let min = 0
      if (part) min = part === 'mezza' || part === 'mezzo' ? 30 : part === 'un quarto' || part === 'quarto' ? 15 : part === 'tre quarti' ? 45 : toNum(part)
      const when = m[3] ?? dayPart
      if (/pomeriggio|sera/.test(when) && h < 12) h += 12
      else if (!/mattin|notte/.test(when) && h >= 1 && h <= 7) h += 12 // «alle 3» per un appuntamento è quasi sempre il pomeriggio
      if (h >= 0 && h <= 23 && min >= 0 && min <= 59) time = `${pad(h)}:${pad(min)}`
      cut(re)
    }
  }
  if (/\bstasera\b/.test(text)) {
    date = today
    if (time && Number(time.slice(0, 2)) < 12) time = `${pad(Number(time.slice(0, 2)) + 12)}${time.slice(2)}`
    cut(/\bstasera\b/)
  }

  // --- Giorno della settimana («martedì», «martedì prossimo»)
  const wdRe = new RegExp(`\\b(?:il |la |questo |questa |prossimo |prossima )?(${WEEKDAYS.join('|')})(?: prossim[oa])?\\b`)
  const wd = text.match(wdRe)
  if (wd) {
    weekday = WEEKDAYS.indexOf(wd[1])
    cut(wdRe)
  }

  // --- Data: «11 ottobre», «l'11 ottobre 2027», «il primo marzo», «11/10»
  const dmRe = new RegExp(`\\b(?:il |l'|per il |per l')?${NUM}\\s+(?:di\\s+)?(${MONTHS.join('|')})(?:\\s+(\\d{4}))?\\b`)
  const dm = text.match(dmRe)
  const slash = text.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/)
  let explicit: { d: number; m: number; y: number | null } | null = null
  if (dm) {
    explicit = { d: toNum(dm[1]), m: MONTHS.indexOf(dm[2]), y: dm[3] ? Number(dm[3]) : null }
    cut(dmRe)
  } else if (slash) {
    const y = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : null
    explicit = { d: Number(slash[1]), m: Number(slash[2]) - 1, y }
    cut(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/)
  }
  if (explicit && explicit.m >= 0) {
    let y = explicit.y ?? today.getFullYear()
    if (validDay(y, explicit.m, explicit.d)) {
      let d = new Date(y, explicit.m, explicit.d)
      // Senza anno e già passata: l'anno prossimo
      if (!explicit.y && d < today) {
        y += 1
        if (validDay(y, explicit.m, explicit.d)) {
          d = new Date(y, explicit.m, explicit.d)
          movedToNextYear = true
        }
      }
      date = d
    }
  }

  // --- Giorni relativi
  if (!date) {
    const rel: [RegExp, (m: RegExpMatchArray) => Date][] = [
      [/\bdopodomani\b/, () => addDays(today, 2)],
      [/\bdomani\b/, () => addDays(today, 1)],
      [/\boggi\b/, () => today],
      [new RegExp(`\\b(?:tra|fra) ${NUM} giorn[oi]\\b`), (m) => addDays(today, toNum(m[1]))],
      [/\b(?:tra|fra) (?:una|1) settimana\b/, () => addDays(today, 7)],
      [new RegExp(`\\b(?:tra|fra) ${NUM} settimane\\b`), (m) => addDays(today, 7 * toNum(m[1]))],
      [/\b(?:la )?settimana prossima\b|\b(?:la )?prossima settimana\b/, () => addDays(today, 7)],
    ]
    for (const [re, fn] of rel) {
      const m = text.match(re)
      if (m) {
        date = fn(m)
        cut(re)
        break
      }
    }
  }

  // --- Giorno della settimana: da solo è il prossimo; con la data si controlla che torni
  let weekdayMismatch: VoiceDraft['weekdayMismatch'] = null
  if (weekday !== null) {
    if (!date) {
      // Oggi stesso solo se l'ora detta deve ancora arrivare (e non «giovedì prossimo»)
      let diff = (weekday - today.getDay() + 7) % 7
      if (diff === 0) {
        const ahead = time !== null && Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) > now.getHours() * 60 + now.getMinutes()
        diff = ahead && !/prossim/.test(wd?.[0] ?? '') ? 0 : 7
      }
      date = addDays(today, diff)
    } else if (date.getDay() !== weekday) {
      // La data con quel giorno della settimana più vicina a quella detta (entro 3 giorni)
      let nearest = date
      for (let k = 1; k <= 3; k++) {
        if (addDays(date, k).getDay() === weekday) {
          nearest = addDays(date, k)
          break
        }
        if (addDays(date, -k).getDay() === weekday && addDays(date, -k) >= today) {
          nearest = addDays(date, -k)
          break
        }
      }
      weekdayMismatch = { said: weekday, dateAsSaid: key(date), nearest: key(nearest) }
    }
  }

  // Solo l'ora: oggi se non è ancora passata, altrimenti domani
  if (!date && time) {
    const [h, m] = time.split(':').map(Number)
    date = h * 60 + m > now.getHours() * 60 + now.getMinutes() ? today : addDays(today, 1)
  }

  // --- Titolo: quello che resta, senza le parole di contorno
  const fillers = /\b(?:ricordami|ricordarmi|ricorda(?:mi)?|promemoria|appuntamento|segna(?:mi)?|metti(?:mi)?|aggiungi|nota|ho|c'e|devo|dovro|che|di|il|lo|la|l'|i|gli|le|un|uno|una|per|e|alle|a|al|ore|del|della|dal|dalla|giorno|prossim[oa])\b/g
  const words = text.replace(/[,.;:!?]+/g, ' ').replace(/\s+/g, ' ').trim()
  // Si toglie il contorno solo all'inizio e alla fine, così «chiamare il dentista» resta intero
  let title = words
  for (let i = 0; i < 6; i++) title = title.replace(/^(?:ricordami di|ricordami|ricordarmi di|ricorda di|devo|dovro|ho un|ho una|ho il|ho la|ho lo|ho l'|ho|c'e il|c'e la|c'e|appuntamento con il|appuntamento con la|appuntamento con|appuntamento dal|appuntamento dalla|appuntamento|promemoria|segnami|segna|mettimi|metti|aggiungi|di|che|e|il|la|lo|l')\s+/, '')
  title = title.replace(/\s+(?:e|di|il|la|alle|a|al|per|del|della|che)$/, '').trim()
  if (!title || !title.replace(fillers, '').trim()) title = ''
  // Il titolo riprende le parole della frase originale (maiuscole e accenti)
  title = restoreCase(original, title)

  const hasTime = !!time
  return {
    kind: hasTime ? 'appointment' : 'task',
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : '',
    date: date ? key(date) : null,
    time,
    weekdayMismatch,
    movedToNextYear,
  }
}

// Riprende dal testo detto le parole del titolo con le loro maiuscole e accenti
function restoreCase(original: string, plainTitle: string): string {
  if (!plainTitle) return ''
  const tokens = original.split(/\s+/).map((t) => t.replace(/^[,.;:!?«»"]+|[,.;:!?«»"]+$/g, ''))
  const plainTokens = tokens.map((t) => normalize(t))
  // Parola per parola, nell'ordine: anche se in mezzo c'erano giorno e ora
  let from = 0
  return plainTitle
    .split(' ')
    .map((w) => {
      const i = plainTokens.indexOf(w, from)
      if (i < 0) return w
      from = i + 1
      return tokens[i]
    })
    .join(' ')
}

export const WEEKDAY_NAMES_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
