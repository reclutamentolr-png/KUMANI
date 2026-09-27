import { Construction, Clock } from 'lucide-react'

type MaintenanceScreenProps = {
  message: string
}

export default function MaintenanceScreen({ message }: MaintenanceScreenProps) {
  return (
    <div className="min-h-screen bg-[var(--ink)] bg-[radial-gradient(circle_at_50%_0%,rgba(199,154,59,0.25),transparent_55%)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-[var(--paper)] rounded-2xl border border-[var(--gold)]/35 shadow-2xl p-10 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center shadow-lg">
          <Construction className="w-10 h-10 text-[var(--ink)]" />
        </div>
        
        <h1 className="text-3xl font-extrabold text-[var(--ink)] mb-3">
          Torneremo presto!
        </h1>
        
        <p className="text-[var(--ink-soft)] whitespace-pre-wrap mb-8 leading-relaxed">
          {message}
        </p>
        
        <div className="flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
          <Clock className="w-4 h-4" />
          Manutenzione programmata
        </div>
      </div>
    </div>
  )
}