import type { Finding, RiskLevel } from '@/lib/checkmail/engine'
import type { AiAssessment } from '@/lib/checkmail/ai'

// Risposta di /api/checkmail
export type CheckMailResponse =
  | {
      status: 'ok'
      score: number
      level: RiskLevel
      findings: Finding[]
      ai: AiAssessment | null
      aiAvailable: boolean
      hasHeaders: boolean
      leftToday: number
    }
  | { status: 'not_allowed' | 'user_limit' | 'empty' | 'too_large' | 'unreadable' | 'error'; leftToday?: number }
