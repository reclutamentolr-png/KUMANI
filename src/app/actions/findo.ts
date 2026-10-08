'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveFindoAccess } from '@/lib/findo-server'
import { buildBreadcrumb, type FindoItemFormData, type FindoLocation } from '@/lib/findo'
import { awardToolPoint } from '@/lib/toolPoints'
import { limitError } from '@/lib/appLimits'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

async function requireActiveFindoAccess(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'notLoggedIn' }
  }

  const hasAccess = await hasActiveFindoAccess(supabase, user.id)
  if (!hasAccess) {
    return { ok: false, message: 'subscriptionRequired' }
  }

  return { ok: true, userId: user.id }
}

export async function createItem(
  id: string,
  form: FindoItemFormData,
  photoPath: string | null
): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveFindoAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('findo_items').insert({
    id,
    user_id: gate.userId,
    location_id: form.locationId,
    name: form.name,
    category: form.category || null,
    tags: form.tags,
    photo_path: photoPath,
  })

  if (error) {
    console.error('[Findo] createItem failed:', error)
    const limit = await limitError(error)
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }

  await awardToolPoint('findo')
  return { success: true, data: { id } }
}

export async function updateItem(
  id: string,
  form: FindoItemFormData,
  photoPath?: string | null
): Promise<ActionResult<null>> {
  const gate = await requireActiveFindoAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const update: Record<string, unknown> = {
    location_id: form.locationId,
    name: form.name,
    category: form.category || null,
    tags: form.tags,
    updated_at: new Date().toISOString(),
  }
  if (photoPath !== undefined) {
    update.photo_path = photoPath
  }

  // Foto precedente, da cancellare se viene sostituita o tolta
  const { data: before } = photoPath !== undefined
    ? await supabase.from('findo_items').select('photo_path').eq('id', id).eq('user_id', gate.userId).maybeSingle()
    : { data: null }

  const { error } = await supabase.from('findo_items').update(update).eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Findo] updateItem failed:', error)
    return { success: false, message: 'saveError' }
  }

  if (before?.photo_path && before.photo_path !== photoPath) {
    await supabase.storage.from('findo-photos').remove([before.photo_path])
  }

  return { success: true, data: null }
}

export async function deleteItem(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveFindoAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()

  const { data: item } = await supabase
    .from('findo_items')
    .select('photo_path')
    .eq('id', id)
    .eq('user_id', gate.userId)
    .single()

  const { error } = await supabase.from('findo_items').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Findo] deleteItem failed:', error)
    return { success: false, message: 'deleteError' }
  }

  if (item?.photo_path) {
    await supabase.storage.from('findo-photos').remove([item.photo_path])
  }

  return { success: true, data: null }
}

export async function toggleFavorite(id: string, current: boolean): Promise<ActionResult<null>> {
  const gate = await requireActiveFindoAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('findo_items')
    .update({ is_favorite: !current, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[Findo] toggleFavorite failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function moveItem(id: string, newLocationId: string | null): Promise<ActionResult<null>> {
  const gate = await requireActiveFindoAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()

  const { data: item, error: fetchError } = await supabase
    .from('findo_items')
    .select('id, location_id')
    .eq('id', id)
    .eq('user_id', gate.userId)
    .single()

  if (fetchError || !item) {
    return { success: false, message: 'saveError' }
  }

  const { data: locations } = await supabase
    .from('findo_locations')
    .select('id, parent_id, name, icon')
    .eq('user_id', gate.userId)
    .returns<FindoLocation[]>()

  const allLocations = locations || []
  const previousPath = buildBreadcrumb(item.location_id, allLocations)
  const newPath = buildBreadcrumb(newLocationId, allLocations)

  const { error: moveError } = await supabase.from('findo_item_moves').insert({
    item_id: id,
    previous_location_path: previousPath || null,
    new_location_path: newPath || null,
  })

  if (moveError) {
    console.error('[Findo] moveItem history log failed:', moveError)
    return { success: false, message: 'saveError' }
  }

  const { error: updateError } = await supabase
    .from('findo_items')
    .update({ location_id: newLocationId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (updateError) {
    console.error('[Findo] moveItem update failed:', updateError)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function createLocation(
  name: string,
  parentId: string | null,
  icon: string
): Promise<ActionResult<{ id: string; name: string; icon: string; parent_id: string | null }>> {
  const gate = await requireActiveFindoAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('findo_locations')
    .insert({ user_id: gate.userId, name, parent_id: parentId, icon })
    .select('id, name, icon, parent_id')
    .single()

  if (error || !data) {
    console.error('[Findo] createLocation failed:', error)
    const limit = await limitError(error)
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }

  return { success: true, data }
}

export async function deleteLocation(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveFindoAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('findo_locations').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Findo] deleteLocation failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}
