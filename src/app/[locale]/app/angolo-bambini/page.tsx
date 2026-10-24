import { redirect } from 'next/navigation'
import KidsCorner from '@/components/kids/KidsCorner'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'

export const generateMetadata = toolMetadata('angolo-bambini')

// Angolo Bambini (piano Plus): colorare e animare i disegni, senza IA. Tutto
// gira nel telefono: bambini, codice del genitore e disegni non vanno mai al
// server. La pagina è protetta dal proxy come gli altri strumenti; il gioco
// copre l'intero schermo (niente menu di KUMANI da cui uscire).
export default async function AngoloBambiniPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  return <KidsCorner userId={user.id} />
}
