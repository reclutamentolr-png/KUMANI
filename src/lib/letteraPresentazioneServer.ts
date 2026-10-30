import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isGuestUser } from '@/lib/trials'
import { asLetterLang, asTemplate, type LetterSender } from '@/lib/letteraPresentazione'

// Mittente della lettera: dal KUMANI CV della persona (un CV per persona) se
// c'è, così lettera e CV hanno gli stessi dati, la stessa lingua e lo stesso
// modello; altrimenti dal profilo. L'ospite in prova ha un profilo tecnico:
// niente dati.
export async function loadLetterSender(user: User): Promise<{ sender: LetterSender | null; fromCv: boolean }> {
  if (isGuestUser(user)) return { sender: null, fromCv: false }
  const supabase = await createClient()
  const { data: cv } = await supabase
    .from('cvs')
    .select('full_name, role_title, email, phone, location, template, content_language')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (cv) {
    return {
      fromCv: true,
      sender: {
        name: cv.full_name ?? '',
        role: cv.role_title ?? '',
        email: cv.email ?? '',
        phone: cv.phone ?? '',
        city: cv.location ?? '',
        template: asTemplate(cv.template),
        language: asLetterLang(cv.content_language),
      },
    }
  }
  const { data: profile } = await supabase
    .rpc('get_my_profile')
    .maybeSingle<{ first_name: string | null; last_name: string | null; email: string | null; phone: string | null; city: string | null; province: string | null; occupation: string | null }>()
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  const city = [profile?.city, profile?.province ? `(${profile.province})` : ''].filter(Boolean).join(' ').trim()
  const email = profile?.email ?? user.email ?? ''
  if (!name && !email) return { sender: null, fromCv: false }
  return { fromCv: false, sender: { name, role: profile?.occupation ?? '', email, phone: profile?.phone ?? '', city } }
}
