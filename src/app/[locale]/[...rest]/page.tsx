import { notFound } from 'next/navigation'

// Qualsiasi indirizzo inesistente sotto una lingua mostra la 404 tradotta
// di [locale]/not-found.tsx invece di quella generica di Next.
export default function CatchAllNotFound() {
  notFound()
}
