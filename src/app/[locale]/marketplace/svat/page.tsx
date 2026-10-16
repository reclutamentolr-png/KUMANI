import HubBar from '@/components/hubs/HubBar'
import SvatClient from './SvatClient'

// SVAT vive nel browser (SvatClient); la barra delle schede di Speculum è un
// componente server e arriva da qui, per stare sotto l'intestazione
export default function SvatPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  return <SvatClient searchParams={searchParams} hubBar={<HubBar />} />
}
