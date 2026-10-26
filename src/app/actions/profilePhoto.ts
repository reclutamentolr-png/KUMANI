'use server'

import { randomBytes } from 'crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Foto del profilo: il browser la ritaglia quadrata e la rimpicciolisce, qui
// si ricontrollano tipo e peso. La foto vecchia si toglie dalla cartella.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const BUCKET = 'profile-photos'

async function currentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

async function replacePhoto(userId: string, path: string | null) {
  const service = db()
  const { data: before } = await service.from('profiles').select('avatar_path').eq('id', userId).maybeSingle()
  const { error } = await service.from('profiles').update({ avatar_path: path }).eq('id', userId)
  if (error) return false
  const old = before?.avatar_path as string | null | undefined
  if (old && old !== path && old.startsWith(`${userId}/`)) await service.storage.from(BUCKET).remove([old])
  return true
}

export async function uploadProfilePhoto(formData: FormData): Promise<{ success: true; path: string } | { success: false; message: string }> {
  const user = await currentUser()
  if (!user) return { success: false, message: 'auth' }
  const file = formData.get('file')
  if (!(file instanceof File)) return { success: false, message: 'photoError' }
  const allowed: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  const ext = allowed[file.type]
  if (!ext || file.size > 1024 * 1024) return { success: false, message: 'photoError' }

  const path = `${user.id}/${randomBytes(10).toString('hex')}.${ext}`
  const { error } = await db().storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return { success: false, message: 'photoError' }
  if (!(await replacePhoto(user.id, path))) {
    await db().storage.from(BUCKET).remove([path])
    return { success: false, message: 'photoError' }
  }
  return { success: true, path }
}

export async function removeProfilePhoto(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  return replacePhoto(user.id, null)
}
