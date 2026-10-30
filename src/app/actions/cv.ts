'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveCvAccess } from '@/lib/cv-server'
import { generateShortCode } from '@/lib/shortLink'
import { CEFR_LEVELS, CEFR_SKILLS, cleanExtras, type CefrLevel, type CvFormData } from '@/lib/cv'
import { awardToolPoint } from '@/lib/toolPoints'
import { normalizeExternalUrl } from '@/lib/linkUtils'

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

// Dati puliti prima di salvarli (anche il database ha gli stessi limiti):
// testi accorciati, elenchi con un massimo di voci, link con https://
const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)
const cefr = (value: unknown): CefrLevel | null => ((CEFR_LEVELS as readonly string[]).includes(String(value)) ? (String(value) as CefrLevel) : null)
const list = <T,>(value: unknown, max: number, map: (item: Record<string, unknown>) => T): T[] =>
  (Array.isArray(value) ? value : []).slice(0, max).map((item) => map((item ?? {}) as Record<string, unknown>))

function toRow(form: CvFormData) {
  return {
    title: text(form.title, 120),
    template: form.template,
    content_language: text(form.contentLanguage, 10) || 'it',
    full_name: text(form.fullName, 120),
    role_title: text(form.roleTitle, 160) || null,
    summary: text(form.summary, 3000) || null,
    email: text(form.email, 200) || null,
    phone: text(form.phone, 40) || null,
    location: text(form.location, 120) || null,
    links: list(form.links, 10, (l) => ({ label: text(l.label, 60), url: normalizeExternalUrl(text(l.url, 500)) })).filter((l) => l.url),
    experiences: list(form.experiences, 30, (e) => ({
      company: text(e.company, 120),
      role: text(e.role, 120),
      location: text(e.location, 120),
      startDate: text(e.startDate, 10),
      endDate: text(e.endDate, 10),
      current: e.current === true,
      description: text(e.description, 1500),
    })),
    education: list(form.education, 20, (e) => ({
      institution: text(e.institution, 160),
      degree: text(e.degree, 160),
      field: text(e.field, 160),
      startDate: text(e.startDate, 10),
      endDate: text(e.endDate, 10),
      current: e.current === true,
    })),
    skills: list(form.skills, 40, (s) => ({ name: text(s.name, 60), level: [1, 2, 3, 4].includes(Number(s.level)) ? Number(s.level) : 2 })),
    languages: list(form.languages, 15, (l) => ({
      name: text(l.name, 40),
      level: cefr(l.level) || 'B1',
      ...(l.native === true ? { native: true } : {}),
      ...(l.detail && typeof l.detail === 'object' && !l.native
        ? { detail: Object.fromEntries(CEFR_SKILLS.map((k) => [k, cefr((l.detail as Record<string, unknown>)[k])]).filter(([, v]) => v)) }
        : {}),
    })),
    certifications: list(form.certifications, 30, (c) => ({ name: text(c.name, 160), issuer: text(c.issuer, 120), date: text(c.date, 10) })),
    extras: cleanExtras(form.extras),
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

  // Un solo CV per persona: chi ce l'ha già lo modifica
  const { data: existing } = await supabase.from('cvs').select('id').eq('user_id', gate.userId).limit(1).maybeSingle()
  if (existing) return { success: false, message: 'oneCvOnly' }

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
    // Codice doppio o CV creato nello stesso momento da un'altra scheda
    if (error) {
      const { data: again } = await supabase.from('cvs').select('id').eq('user_id', gate.userId).limit(1).maybeSingle()
      if (again) return { success: false, message: 'oneCvOnly' }
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

  // Foto precedente: con una nuova non deve restare nello spazio file
  const { data: before } = photoPath
    ? await supabase.from('cvs').select('photo_path').eq('id', id).eq('user_id', gate.userId).maybeSingle()
    : { data: null }

  const { error } = await supabase.from('cvs').update(payload).eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Cv] updateCv failed:', error)
    return { success: false, message: 'saveError' }
  }

  if (before?.photo_path && before.photo_path !== photoPath) {
    await supabase.storage.from('cv-photos').remove([before.photo_path])
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
