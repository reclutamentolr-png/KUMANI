'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { subscribeAdminNotices, type AdminNotice } from '@/lib/adminNotify'

const STYLE = {
  success: { Icon: CheckCircle2, title: 'Fatto', bar: 'bg-emerald-500', icon: 'text-emerald-600 bg-emerald-50' },
  error: { Icon: AlertCircle, title: 'Attenzione', bar: 'bg-red-500', icon: 'text-red-600 bg-red-50' },
  info: { Icon: Info, title: 'Informazione', bar: 'bg-[var(--gold)]', icon: 'text-[var(--gold)] bg-[var(--gold-pale)]' },
} as const

// Box delle notifiche Admin: in alto a destra (in basso su telefono), si
// chiude da solo dopo qualche secondo (gli errori restano più a lungo).
export default function AdminToaster() {
  const [notices, setNotices] = useState<AdminNotice[]>([])

  useEffect(
    () =>
      subscribeAdminNotices((notice) => {
        setNotices((prev) => [...prev.slice(-3), notice])
        setTimeout(() => setNotices((prev) => prev.filter((n) => n.id !== notice.id)), notice.kind === 'error' ? 8000 : 3500)
      }),
    []
  )

  const close = (id: number) => setNotices((prev) => prev.filter((n) => n.id !== id))

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-4 z-[300] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:items-end">
      {notices.map((notice) => {
        const style = STYLE[notice.kind]
        return (
          <div
            key={notice.id}
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className="admin-toast pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-9 shadow-[0_18px_40px_rgba(23,23,23,0.18)]"
          >
            <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.icon}`}>
              <style.Icon className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm font-bold text-gray-900">{style.title}</p>
              {notice.message && <p className="mt-0.5 whitespace-pre-line break-words text-sm text-gray-600">{notice.message}</p>}
            </div>
            <button type="button" onClick={() => close(notice.id)} aria-label="Chiudi" className="absolute right-2 top-2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
      <style>{`
        .admin-toast { animation: admin-toast-in .28s cubic-bezier(.2,.8,.2,1); }
        @keyframes admin-toast-in { from { opacity: 0; transform: translateY(-8px) scale(.98); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  )
}
