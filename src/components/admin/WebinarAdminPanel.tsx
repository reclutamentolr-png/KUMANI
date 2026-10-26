'use client'

import { Hand, Users, Video } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Admin → Comunicazioni → Webinar: come funziona e accesso alla pagina dove si
// creano i webinar, si invitano i Kumani e si va in diretta
export default function WebinarAdminPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <Video className="h-6 w-6 text-[var(--gold)]" /> KUMANI Webinar
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Videoconferenze dentro KUMANI fino a 20 persone: parli tu con videocamera, microfono e schermo; gli altri guardano, scrivono in chat e alzano la mano.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-700">
          <li className="flex gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
            <span>
              <strong>Invita i Kumani</strong> per nome: ricevono l’avviso sul telefono e nella campanella, e un altro quando vai in diretta. Per chi non è iscritto c’è il link da mandare.
            </span>
          </li>
          <li className="flex gap-2">
            <Hand className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
            <span>
              <strong>Dai la parola</strong> a chi alza la mano: sceglie se parlare con microfono e videocamera o solo con la voce.
            </span>
          </li>
        </ul>
        <Link
          href="/app/webinar"
          className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--ink)] px-6 font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]"
        >
          <Video className="h-5 w-5" /> Apri i Webinar
        </Link>
        <p className="mt-3 text-xs text-gray-500">Organizzano lo Staff e i tester del Webinar. Consiglio: per andare in diretta usa il computer.</p>
      </div>
    </div>
  )
}
