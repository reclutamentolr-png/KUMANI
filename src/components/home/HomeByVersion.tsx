import HomeLanding from '@/components/home/HomeLanding'
import HomeV1 from '@/components/home/versions/HomeV1'
import HomeV2 from '@/components/home/versions/HomeV2'
import type { HomeLayoutKey } from '@/lib/homeLayouts'

// La Home da mostrare per ogni versione dell'Admin (Aspetto homepage): le
// versioni memorizzate sono copie congelate, la bozza è quella su cui si lavora.
const VERSIONS: Record<HomeLayoutKey, typeof HomeLanding> = {
  v1: HomeV1,
  v2: HomeV2,
  bozza: HomeLanding,
}

export default function HomeByVersion({ layoutKey }: { layoutKey: HomeLayoutKey }) {
  const Home = VERSIONS[layoutKey] ?? HomeV1
  return <Home layoutKey={layoutKey} />
}
