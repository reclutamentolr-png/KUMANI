import HubBar from '@/components/hubs/HubBar'

// Servizio unito (vedi lib/serviceHubs): la barra con le schede del servizio
// (Controlla, Proteggi o Segnala) sopra la pagina del controllo
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubBar />
      {children}
    </>
  )
}
