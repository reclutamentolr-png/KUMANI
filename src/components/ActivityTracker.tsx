'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { readImpersonation } from '@/lib/impersonation'

type ActivityTrackerProps = {
  userId: string
}

// "Ultimo accesso" (profiles.last_seen): serve all'Admin per contare chi è
// online negli ultimi 15 minuti. Basta aggiornarlo ogni 5 minuti e solo con
// la pagina in primo piano (prima: una scrittura al minuto anche con la
// scheda in secondo piano).
const EVERY_MS = 5 * 60 * 1000

export default function ActivityTracker({ userId }: ActivityTrackerProps) {
  useEffect(() => {
    const supabase = createClient()
    let lastUpdate = 0

    const updateLastSeen = () => {
      if (document.visibilityState !== 'visible') return
      // Lo Staff che impersona non deve far risultare l'utente online
      if (readImpersonation()) return
      if (Date.now() - lastUpdate < EVERY_MS - 1000) return
      lastUpdate = Date.now()
      void supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userId).then(() => {})
    }

    updateLastSeen()
    const interval = setInterval(updateLastSeen, EVERY_MS)
    // Tornando sulla scheda dopo un po', si aggiorna subito
    document.addEventListener('visibilitychange', updateLastSeen)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', updateLastSeen)
    }
  }, [userId])

  return null // Componente invisibile
}
