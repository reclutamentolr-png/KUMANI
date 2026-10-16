import { toolMetadata } from '@/lib/toolMetadata'
import HubBar from '@/components/hubs/HubBar'

// La pagina di SVAT è tutta nel browser: il titolo della scheda lo dà qui
export const generateMetadata = toolMetadata('svat')

// Sopra la pagina: la barra delle schede di «Controlla» (lib/serviceHubs)
export default function SvatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubBar />
      {children}
    </>
  )
}
