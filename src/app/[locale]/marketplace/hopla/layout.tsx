import HubBar from '@/components/hubs/HubBar'

// Servizio unito (vedi lib/serviceHubs): la barra con le sue schede sopra la pagina
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubBar />
      {children}
    </>
  )
}
