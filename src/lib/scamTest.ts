// «Mi stanno truffando?»: il test in 5 schede da 3 domande (dal test di
// MC TEKNOLOGY, con in più le truffe del finto parente, del pacco o della
// multa e del finto carabiniere). Testi nel namespace "scamTest".
// Sì = 2 punti, Non so = 1, No = 0 (massimo 30). Alcune risposte contano da
// sole: chi ha già pagato o dato i propri dati è a rischio alto qualunque sia
// il punteggio, e vede subito cosa fare.

export type ScamAnswer = 'no' | 'maybe' | 'yes'

export const SCAM_TEST_CARDS = [
  { key: 'contact', questions: ['bank', 'tech', 'easy'] },
  { key: 'common', questions: ['family', 'parcel', 'police'] },
  { key: 'requests', questions: ['remote', 'codes', 'secret'] },
  { key: 'pressure', questions: ['hurry', 'untraceable', 'profit'] },
  { key: 'damage', questions: ['data', 'paid', 'search'] },
] as const

export type ScamQuestion = (typeof SCAM_TEST_CARDS)[number]['questions'][number]
export const SCAM_QUESTIONS: ScamQuestion[] = SCAM_TEST_CARDS.flatMap((c) => [...c.questions])

const POINTS: Record<ScamAnswer, number> = { no: 0, maybe: 1, yes: 2 }
export const SCAM_TEST_MAX = SCAM_QUESTIONS.length * 2

export type ScamLevel = 'low' | 'medium' | 'high'

export function scamTestResult(answers: Partial<Record<ScamQuestion, ScamAnswer>>) {
  const score = SCAM_QUESTIONS.reduce((sum, q) => sum + POINTS[answers[q] ?? 'no'], 0)
  const yes = (q: ScamQuestion) => answers[q] === 'yes'
  // Danno già fatto: soldi o dati consegnati
  const damage = yes('paid') || yes('data')
  let level: ScamLevel = score <= 4 ? 'low' : score <= 10 ? 'medium' : 'high'
  if (damage) level = 'high'
  else if (level === 'low' && (yes('remote') || yes('codes'))) level = 'medium'
  // Consigli mirati: una riga per ogni «Sì» (e per i «Non so» delle domande sul danno)
  const tips = SCAM_QUESTIONS.filter((q) => answers[q] === 'yes' || (answers[q] === 'maybe' && (q === 'paid' || q === 'data' || q === 'remote')))
  return { score, level, damage, remote: yes('remote'), dataGiven: yes('data'), tips }
}
