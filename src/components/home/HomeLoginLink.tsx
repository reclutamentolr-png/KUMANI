'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'

// La homepage è uguale per tutti (preparata in anticipo): «Accedi» diventa
// «Vai alla Dashboard» nel browser di chi è già collegato, così non sembra
// di dover rifare l'accesso.
export default function HomeLoginLink({ loginLabel, dashboardLabel, className }: { loginLabel: string; dashboardLabel: string; className: string }) {
  const [loggedIn, setLoggedIn] = useState(false)
  useEffect(() => {
    // Legge la sessione dai cookie del browser, senza chiamate al server
    createClient()
      .auth.getSession()
      .then(({ data }) => setLoggedIn(!!data.session))
      .catch(() => {})
  }, [])
  return (
    <Link href={loggedIn ? '/dashboard' : '/login'} className={className}>
      {loggedIn ? dashboardLabel : loginLabel}
    </Link>
  )
}
