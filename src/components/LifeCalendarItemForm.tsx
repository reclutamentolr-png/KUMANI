'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  LoaderCircle,
  XCircle,
  User,
  Car,
  Home,
  Users,
  FileText,
  ShieldCheck,
  CreditCard,
  Briefcase,
  Plane,
  MoreHorizontal,
  PlusCircle,
} from 'lucide-react'
import { createItem, updateItem, createProfile } from '@/app/actions/lifeCalendar'
import {
  CATEGORIES,
  RECURRENCE_OPTIONS,
  REMINDER_PRESETS,
  type Category,
  type Recurrence,
  type LifeCalendarItemFormData,
} from '@/lib/lifeCalendar'

type Profile = { id: string; name: string; icon: string }

type Props =
  | { mode: 'create'; profiles: Profile[] }
  | { mode: 'edit'; id: string; initial: LifeCalendarItemFormData; profiles: Profile[] }

const CATEGORY_ICONS: Record<Category, typeof User> = {
  person: User,
  auto: Car,
  home: Home,
  family: Users,
  contracts: FileText,
  warranties: ShieldCheck,
  subscriptions: CreditCard,
  work: Briefcase,
  travel: Plane,
  other: MoreHorizontal,
}

const REMINDER_CHOICES = [180, 90, 60, 30, 14, 7, 1]

function defaultForm(): LifeCalendarItemFormData {
  return {
    title: '',
    category: 'other',
    profileId: null,
    dueDate: '',
    notes: '',
    reminderOffsets: REMINDER_PRESETS.other,
    recurrence: 'none',
    recurrenceCustomDays: null,
  }
}

export default function LifeCalendarItemForm(props: Props) {
  const t = useTranslations('lifeCalendar')
  const router = useRouter()
  const [form, setForm] = useState<LifeCalendarItemFormData>(props.mode === 'edit' ? props.initial : defaultForm())
  const [profiles, setProfiles] = useState<Profile[]>(props.profiles)
  const [newProfileName, setNewProfileName] = useState('')
  const [addingProfile, setAddingProfile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = form.title.trim().length > 0 && form.dueDate.length > 0

  const setCategory = (category: Category) => {
    setForm((prev) => ({ ...prev, category, reminderOffsets: REMINDER_PRESETS[category] }))
  }

  const toggleReminder = (days: number) => {
    setForm((prev) => ({
      ...prev,
      reminderOffsets: prev.reminderOffsets.includes(days)
        ? prev.reminderOffsets.filter((d) => d !== days)
        : [...prev.reminderOffsets, days].sort((a, b) => b - a),
    }))
  }

  const handleAddProfile = async () => {
    if (!newProfileName.trim()) return
    setAddingProfile(true)
    const result = await createProfile(newProfileName.trim(), 'User')
    setAddingProfile(false)
    if (result.success) {
      setProfiles((prev) => [...prev, result.data])
      setForm((prev) => ({ ...prev, profileId: result.data.id }))
      setNewProfileName('')
    }
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      if (props.mode === 'create') {
        const result = await createItem(form)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push('/marketplace/life-calendar')
      } else {
        const result = await updateItem(props.id, form)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push('/marketplace/life-calendar')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('titleField')}</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          placeholder={t('titlePlaceholder')}
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('categoryLabel')}</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category]
            return (
              <button
                key={category}
                type="button"
                onClick={() => setCategory(category)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg text-xs font-medium border-2 transition-all ${
                  form.category === category
                    ? 'border-amber-600 bg-amber-50 text-amber-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                {t(`category_${category}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('profileLabel')}</label>
        <p className="text-xs text-gray-500 mb-2">{t('profileHint')}</p>
        <div className="flex flex-wrap gap-2 mb-2">
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, profileId: null }))}
            className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              form.profileId === null
                ? 'border-amber-600 bg-amber-50 text-amber-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {t('noProfile')}
          </button>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, profileId: profile.id }))}
              className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                form.profileId === profile.id
                  ? 'border-amber-600 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {profile.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder={t('newProfilePlaceholder')}
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          />
          <button
            type="button"
            onClick={handleAddProfile}
            disabled={addingProfile || !newProfileName.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4" />
            {t('addProfile')}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('dueDateLabel')}</label>
        <input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('recurrenceLabel')}</label>
        <div className="space-y-2">
          {RECURRENCE_OPTIONS.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="radio"
                name="recurrence"
                checked={form.recurrence === option}
                onChange={() => setForm((prev) => ({ ...prev, recurrence: option as Recurrence }))}
                className="text-amber-600 focus:ring-amber-500"
              />
              {t(`recurrence_${option}`)}
            </label>
          ))}
          {form.recurrence === 'custom' && (
            <input
              type="number"
              min={1}
              value={form.recurrenceCustomDays ?? ''}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, recurrenceCustomDays: e.target.value ? Number(e.target.value) : null }))
              }
              placeholder={t('customDaysPlaceholder')}
              className="ml-6 w-40 px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('reminderLabel')}</label>
        <div className="flex flex-wrap gap-3">
          {REMINDER_CHOICES.map((days) => (
            <label key={days} className="flex items-center gap-1.5 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.reminderOffsets.includes(days)}
                onChange={() => toggleReminder(days)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              {t('daysBefore', { count: days })}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('reminderHint')}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesLabel')}</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
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
        disabled={!isValid || saving}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-semibold hover:from-amber-700 hover:to-orange-700 transition-all disabled:opacity-50"
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
