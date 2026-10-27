// CARTE ANTITRUFFA: per ogni tentativo 3 domande sulle 5 della carta. La
// scelta dipende da persona, giorno e carta: chi riprova il giorno dopo trova
// domande diverse e non può scegliersele (il server la ricalcola).

export const QUIZ_SIZE = 3

// Numero da un testo (FNV-1a), sempre uguale per lo stesso testo
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

// Le domande (posizioni) da fare oggi a questa persona per questa carta
export function pickQuestions(userId: string, day: string, cardNo: number, total: number): number[] {
  const order = Array.from({ length: total }, (_, i) => i)
  let seed = hash(`${userId}:${day}:${cardNo}`)
  for (let i = order.length - 1; i > 0; i--) {
    seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) >>> 0
    const j = seed % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order.slice(0, Math.min(QUIZ_SIZE, total))
}
