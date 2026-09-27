'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveCvAccess } from '@/lib/cv-server'
import { generateShortCode } from '@/lib/shortLink'
import type { CvFormData } from '@/lib/cv'
import { awardToolPoint } from '@/lib/toolPoints'

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }

async function requireActiveCvAccess(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, message: 'notLoggedIn' }

  const hasAccess = await hasActiveCvAccess(supabase, user.id)
  if (!hasAccess) return { ok: false, message: 'subscriptionRequired' }

  return { ok: true, userId: user.id }
}

function toRow(form: CvFormData) {
  return {
    title: form.title,
    template: form.template,
    content_language: form.contentLanguage,
    full_name: form.fullName,
    role_title: form.roleTitle || null,
    summary: form.summary || null,
    email: form.email || null,
    phone: form.phone || null,
    location: form.location || null,
    links: form.links,
    experiences: form.experiences,
    education: form.education,
    skills: form.skills,
    languages: form.languages,
    certifications: form.certifications,
  }
}

// Accetta solo percorsi foto nella cartella dell'utente (come saveMenuItem):
// altrimenti si potrebbe puntare (e poi cancellare) la foto di un altro utente.
function ownPhotoPath(path: string | null, userId: string): string | null {
  return path && path.startsWith(`${userId}/`) && !path.includes('..') ? path : null
}

export async function createCv(form: CvFormData, rawPhotoPath: string | null): Promise<ActionResult<{ id: string; code: string }>> {
  const gate = await requireActiveCvAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const photoPath = ownPhotoPath(rawPhotoPath, gate.userId)
  const supabase = await createClient()

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortCode()
    const { data, error } = await supabase
      .from('cvs')
      .insert({ user_id: gate.userId, code, photo_path: photoPath, ...toRow(form) })
      .select('id, code')
      .single()

    if (!error && data) {
      await awardToolPoint('kumani-cv')
      return { success: true, data: { id: data.id, code: data.code } }
    }

    if (error && error.code !== '23505') {
      console.error('[Cv] createCv failed:', error)
      return { success: false, message: 'saveError' }
    }
  }

  return { success: false, message: 'saveError' }
}

export async function updateCv(id: string, form: CvFormData, rawPhotoPath: string | null): Promise<ActionResult<null>> {
  const gate = await requireActiveCvAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const photoPath = ownPhotoPath(rawPhotoPath, gate.userId)

  const supabase = await createClient()

  const payload: ReturnType<typeof toRow> & { updated_at: string; photo_path?: string } = {
    ...toRow(form),
    updated_at: new Date().toISOString(),
  }
  // Only overwrite photo_path when a new photo was actually uploaded in
  // this save — passing null here would wipe a previously saved photo
  // every time the CV is edited without touching the photo field.
  if (photoPath) payload.photo_path = photoPath

  const { error } = await supabase.from('cvs').update(payload).eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Cv] updateCv failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function deleteCv(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveCvAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()

  const { data: cv } = await supabase.from('cvs').select('photo_path').eq('id', id).eq('user_id', gate.userId).single()

  const { error } = await supabase.from('cvs').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Cv] deleteCv failed:', error)
    return { success: false, message: 'deleteError' }
  }

  if (cv?.photo_path) {
    await supabase.storage.from('cv-photos').remove([cv.photo_path])
  }

  return { success: true, data: null }
}
