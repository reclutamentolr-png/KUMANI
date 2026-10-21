import type { SolveAnswers, SolveGuide, SolveShowIf, SolveStep } from './types'

// Motore dei percorsi: funzioni pure, senza codice nei contenuti. Una
// condizione vale solo se la domanda ha una risposta tra quelle indicate.

export function matches(condition: SolveShowIf | undefined, answers: SolveAnswers): boolean {
  if (!condition) return true
  return (Array.isArray(condition) ? condition : [condition]).every((c) => {
    const value = answers[c.q]
    return value !== undefined && c.anyOf.includes(value)
  })
}

export const allAnswered = (guide: SolveGuide, answers: SolveAnswers) => guide.questions.every((q) => q.options.some((o) => o.value === answers[q.id]))

// Passi che valgono per le risposte date (tutti finché manca una risposta)
export function visibleSteps(guide: SolveGuide, answers: SolveAnswers): SolveStep[] {
  return guide.steps.filter((step) => matches(step.showIf, answers))
}

export function urgentNotices(guide: SolveGuide, answers: SolveAnswers) {
  return (guide.urgent ?? []).filter((notice) => matches(notice.showIf, answers))
}

// Avanzamento sui soli passi applicabili
export function progressOf(guide: SolveGuide, answers: SolveAnswers, done: string[]): { done: number; total: number } {
  const steps = visibleSteps(guide, answers)
  return { done: steps.filter((s) => done.includes(s.id)).length, total: steps.length }
}

// Risposte e passi validi per la guida (scarta valori estranei o inventati)
export function cleanRun(guide: SolveGuide, answers: unknown, done: unknown): { answers: SolveAnswers; done: string[] } {
  const clean: SolveAnswers = {}
  const raw = answers && typeof answers === 'object' ? (answers as Record<string, unknown>) : {}
  for (const q of guide.questions) {
    const v = raw[q.id]
    if (typeof v === 'string' && q.options.some((o) => o.value === v)) clean[q.id] = v
  }
  const ids = new Set(guide.steps.map((s) => s.id))
  const list = Array.isArray(done) ? [...new Set(done.filter((d): d is string => typeof d === 'string' && ids.has(d)))] : []
  return { answers: clean, done: list }
}
