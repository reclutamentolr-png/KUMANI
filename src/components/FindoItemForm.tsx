'use client'

import { useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { CheckCircle, LoaderCircle, XCircle, Camera, PlusCircle, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createItem, updateItem, createLocation } from '@/app/actions/findo'
import { buildBreadcrumb, validatePhotoFile, photoExtension, type FindoLocation, type FindoItemFormData } from '@/lib/findo'

type Props =
  | { mode: 'create'; locations: FindoLocation[] }
  | { mode: 'edit'; id: string; locations: FindoLocation[]; initial: FindoItemFormData; initialPhotoUrl: string | null }

function defaultForm(): FindoItemFormData {
  return { name: '', locationId: null, category: '', tags: [] }
}

export default function FindoItemForm(props: Props) {
  const t = useTranslations('findo')
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [itemId] = useState(() => (props.mode === 'edit' ? props.id : crypto.randomUUID()))
  const [form, setForm] = useState<FindoItemFormData>(props.mode === 'edit' ? props.initial : defaultForm())
  const [locations, setLocations] = useState(props.locations)
  const [tagsInput, setTagsInput] = useState(props.mode === 'edit' ? props.initial.tags.join(', ') : '')
  const [newLocationName, setNewLocationName] = useState('')
  const [addingLocation, setAddingLocation] = useState(false)

  const [photoUrl, setPhotoUrl] = useState<string | null>(props.mode === 'edit' ? props.initialPhotoUrl : null)
  const [photoPath, setPhotoPath] = useState<string | null | undefined>(undefined) // undefined = unchanged
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locationOptions = useMemo(
    () =>
      locations
        .map((loc) => ({ id: loc.id, breadcrumb: buildBreadcrumb(loc.id, locations) }))
        .sort((a, b) => a.breadcrumb.localeCompare(b.breadcrumb)),
    [locations]
  )

  const isValid = form.name.trim().length > 0

  const handlePhotoSelect = async (file: File) => {
    const validationError = validatePhotoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setUploadingPhoto(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUploadingPhoto(false)
      return
    }

    const path = `${user.id}/${itemId}.${photoExtension(file)}`
    const { error: uploadError } = await supabase.storage.from('findo-photos').upload(path, file, { upsert: true })
    setUploadingPhoto(false)

    if (uploadError) {
      console.error('[Findo] photo upload failed:', uploadError)
      setError('photoUploadError')
      return
    }

    setPhotoPath(path)
    setPhotoUrl(URL.createObjectURL(file))
  }

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return
    const result = await createLocation(newLocationName.trim(), null, 'Home')
    if (result.success) {
      setLocations((prev) => [...prev, { id: result.data.id, name: result.data.name, icon: result.data.icon, parent_id: null }])
      setForm((prev) => ({ ...prev, locationId: result.data.id }))
      setNewLocationName('')
      setAddingLocation(false)
    } else {
      alert(t(result.message))
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    const finalForm: FindoItemFormData = {
      ...form,
      tags: tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    }
    try {
      if (props.mode === 'create') {
        const result = await createItem(itemId, finalForm, photoPath ?? null)
        if (!result.success) {
          setError(result.message)
          return
        }
      } else {
        const result = await updateItem(props.id, finalForm, photoPath)
        if (!result.success) {
          setError(result.message)
          return
        }
      }
      router.push('/marketplace/findo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-28 h-28 rounded-xl border-2 border-dashed border-[var(--gold)]/40 flex items-center justify-center cursor-pointer hover:border-[var(--gold)] transition-all overflow-hidden bg-[var(--paper)]"
        >
          {uploadingPhoto ? (
            <LoaderCircle className="w-6 h-6 text-[var(--gold)] animate-spin" />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-8 h-8 text-[var(--gold)]" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePhotoSelect(file)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm font-medium text-[var(--gold)] hover:underline"
        >
          {photoUrl ? t('changePhoto') : t('addPhoto')}
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('nameField')}</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder={t('namePlaceholder')}
          className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--ink)] mb-2">{t('locationLabel')}</label>
        <select
          value={form.locationId ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value || null }))}
          className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm bg-white mb-2"
        >
          <option value="">{t('noLocation')}</option>
          {locationOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.breadcrumb}
            </option>
          ))}
        </select>

        {addingLocation ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              placeholder={t('locationNamePlaceholder')}
              className="flex-1 px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg text-sm focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30"
              autoFocus
            />
            <button
              type="button"
              onClick={handleAddLocation}
              disabled={!newLocationName.trim()}
              className="px-3 py-2 rounded-lg text-sm bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-sm hover:brightness-105 transition-all disabled:opacity-50"
            >
              {t('add')}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setAddingLocation(true)}
              className="flex items-center gap-1 text-sm font-medium text-[var(--gold)] hover:underline"
            >
              <PlusCircle className="w-4 h-4" />
              {t('quickAddLocation')}
            </button>
            <Link
              href="/marketplace/findo/locations"
              className="flex items-center gap-1 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] hover:underline"
            >
              <MapPin className="w-4 h-4" />
              {t('manageLocations')}
            </Link>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('categoryLabel')}</label>
        <input
          type="text"
          value={form.category}
          onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          placeholder={t('categoryPlaceholder')}
          className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--ink)] mb-1">{t('tagsLabel')}</label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder={t('tagsPlaceholder')}
          className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          {t(error)}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid || saving || uploadingPhoto}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
      >
        {saving ? (
          <>
            <LoaderCircle className="w-5 h-5 animate-spin" />
            {t('saving')}
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            {props.mode === 'create' ? t('create') : t('saveChanges')}
          </>
        )}
      </button>
    </div>
  )
}
