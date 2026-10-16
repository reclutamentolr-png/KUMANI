import { toolMetadata } from '@/lib/toolMetadata'

// La pagina di SVAT è tutta nel browser: il titolo della scheda lo dà qui
export const generateMetadata = toolMetadata('svat')

export default function SvatLayout({ children }: { children: React.ReactNode }) {
  return children
}
