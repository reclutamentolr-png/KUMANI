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
      // Per l'avviso della Rete Anti-Truffa: mittente e domini dei link (max 10)
      community?: { sender: string | null; domains: string[] }
    }
  | { status: 'not_allowed' | 'user_limit' | 'empty' | 'too_large' | 'unreadable' | 'error'; leftToday?: number }
