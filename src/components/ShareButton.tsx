'use client'

import NativeShareButton from '@/components/NativeShareButton'

// Pagina pubblica Link in Bio: condivisione del profilo con il menu del
// telefono (Instagram, WhatsApp e le altre app); sul computer copia il link.
export default function ShareButton({ url }: { url: string }) {
  return <NativeShareButton url={url} variant="glass" className="rounded-full" />
}
