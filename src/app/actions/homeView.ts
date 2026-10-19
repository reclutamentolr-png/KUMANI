'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { HOME_VIEW_COOKIE, isHomeView, MAX_HOME_FOLDERS, type HomeView, type ServicesView } from '@/lib/homeView'
import { SERVICE_HUBS } from '@/lib/serviceHubs'

// Cambia la vista della Home (Lite, Completa, Icone): nel profilo (tutti i
// dispositivi) e nel cookie che usano i servizi per «‹ Home».
export async function setHomeView(view: HomeView): Promise<boolean> {
  if (!isHomeView(view)) return false
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: { home_view: view } })
  if (error) {
    console.error('[home] vista:', error.message)
    return false
  }
  ;(await cookies()).set(HOME_VIEW_COOKIE, view, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/dashboard')
  return true
}

// Categorie nella fascia in basso della Home a icone (cartelle)
export async function setHomeFolders(hubs: string[]): Promise<boolean> {
  const clean = [...new Set(hubs)].filter((hub) => (SERVICE_HUBS as readonly string[]).includes(hub)).slice(0, MAX_HOME_FOLDERS)
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: { home_folders: clean } })
  if (error) {
    console.error('[home] categorie:', error.message)
    return false
  }
  revalidatePath('/dashboard')
  return true
}

// Vista della pagina Servizi: Elenco o Icone
export async function setServicesView(view: ServicesView): Promise<boolean> {
  if (view !== 'list' && view !== 'icons') return false
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: { services_view: view } })
  if (error) {
    console.error('[servizi] vista:', error.message)
    return false
  }
  revalidatePath('/servizi')
  return true
}
