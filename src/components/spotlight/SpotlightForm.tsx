'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { deleteSpotlightProfile, revokeSpotlightHomeConsent, revokeSpotlightOptIn, upsertSpotlightProfile } from '@/app/actions/spotlight'
import { SPOTLIGHT_STORY_MAX_LENGTH, type SpotlightModerationStatus, type SpotlightProfile } from '@/lib/spotlight'
import Link from '@/components/LocalizedLink'
import { CheckCircle2, Clock, Home, Pencil, Trash2 } from 'lucide-react'
import { askConfirm } from '@/lib/confirm'

type FormState = {
  displayName: string
  city: string
  country: string
  profession: string
  story: string
  favoriteTools: string[]
}

function emptyForm(profile: SpotlightProfile | null): FormState {
  return {
    displayName: profile?.display_name ?? '',
    city: profile?.city ?? '',
    country: profile?.country ?? '',
    profession: profile?.profession ?? '',
    story: profile?.story ?? '',
    favoriteTools: profile?.favorite_tools ?? [],
  }
}

const grayButton = 'rounded-lg border border-[var(--gold)]/40 bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)] disabled:opacity-50'

export default function SpotlightForm({
  profile,
  availableTools,
  canEdit,
}: {
  profile: SpotlightProfile | null
  availableTools: { toolName: string; title: string }[]
  // false = abbonamento non attivo: niente scrittura/modifica, la storia
  // (se c'è) è fuori rotazione ma si può sempre eliminare.
  canEdit: boolean
}) {
  const t = useTranslations('spotlight')
  const router = useRouter()
  const locale = useLocale()
  const [form, setForm] = useState<FormState>(emptyForm(profile))
  const [consent, setConsent] = useState(profile?.is_opted_in ?? false)
  const [showOnHome, setShowOnHome] = useState(profile?.show_on_home ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Chi ha già una storia la vede chiusa in un box di riepilogo; il form
  // si apre solo con la matita (o se non c'è ancora nessuna storia).
  const [editing, setEditing] = useState(false)
  const [popupStatus, setPopupStatus] = useState<SpotlightModerationStatus | null>(null)

  const showForm = canEdit && (editing || !profile)
  const toolTitle = new Map(availableTools.map((tool) => [tool.toolName, tool.title]))

  const toggleTool = (toolName: string) => {
    setForm((prev) => ({
      ...prev,
      favoriteTools: prev.favoriteTools.includes(toolName)
        ? prev.favoriteTools.filter((t) => t !== toolName)
        : [...prev.favoriteTools, toolName],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!consent) {
      setError(t('consentRequired'))
      return
    }
    if (!form.displayName.trim() || !form.story.trim()) {
      setError(t('saveError'))
      return
    }
    setSaving(true)
    const result = await upsertSpotlightProfile({ ...form, showOnHome, storyLocale: locale })
    setSaving(false)
    if (!result.success) {
      setError(t(result.message))
      return
    }
    // Si resta qui (in vetrina pubblica una storia in revisione non
    // comparirebbe): popup con lo stato reale deciso dal DB, poi il box
    // di riepilogo al posto del form.
    setEditing(false)
    setPopupStatus(result.moderationStatus)
    router.refresh()
  }

  const handleCancelEdit = () => {
    setForm(emptyForm(profile))
    setConsent(profile?.is_opted_in ?? false)
    setShowOnHome(profile?.show_on_home ?? false)
    setError(null)
    setEditing(false)
  }

  const handleRevoke = async () => {
    if (!(await askConfirm(t('revokeConfirm')))) return
    const result = await revokeSpotlightOptIn()
    if (result.success) {
      setConsent(false)
      setEditing(false)
      router.refresh()
    }
  }

  const handleRevokeHome = async () => {
    const result = await revokeSpotlightHomeConsent()
    if (result.success) {
      setShowOnHome(false)
      setEditing(false)
      router.refresh()
    }
  }

  const handleDelete = async () => {
    if (!(await askConfirm(t('deleteConfirm')))) return
    const result = await deleteSpotlightProfile()
    if (result.success) {
      setForm(emptyForm(null))
      setConsent(false)
      setShowOnHome(false)
      setEditing(false)
      router.refresh()
    }
  }

  const remaining = SPOTLIGHT_STORY_MAX_LENGTH - form.story.length

  const statusBanner = !canEdit ? (
    <div className="mb-4 rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
      <p className="font-semibold">{profile ? t('subscriptionExpiredStory') : t('subscriptionRequired')}</p>
      <Link href="/dashboard" className="mt-1 inline-block font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        {t('subscriptionCta')}
      </Link>
    </div>
  ) : profile && !showForm && (
    profile.is_opted_in && profile.moderation_status === 'pending' ? (
      <p className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-3 text-sm font-semibold text-[var(--ink)] animate-pulse">
        <Clock className="h-4 w-4 flex-shrink-0" />
        {t('statusPending')}
      </p>
    ) : (
      <p className={`mb-4 rounded-lg px-4 py-2.5 text-sm font-medium ${profile.is_opted_in && profile.moderation_status === 'approved' ? 'bg-[var(--gold-pale)] text-[var(--ink)]' : 'bg-[var(--background)] text-[var(--muted)]'}`}>
        {!profile.is_opted_in ? t('statusInactive') : profile.moderation_status === 'rejected' ? t('statusRejected') : t('statusActive')}
      </p>
    )
  )

  return (
    <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-6 sm:p-8">
      {statusBanner}

      {profile && !showForm ? (
        <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--background)] p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--gold)]">{t('yourStoryTitle')}</p>
              <h3 className="mt-1 text-lg font-bold text-[var(--ink)]">{profile.display_name}</h3>
              <p className="text-sm text-[var(--muted)]">
                {[profile.profession, [profile.city, profile.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                title={t('edit')}
                aria-label={t('edit')}
                className="rounded-lg border border-[var(--gold)]/30 bg-white p-2 text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)]"
              >
                <Pencil className="h-4 w-4" />
              </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                title={t('delete')}
                aria-label={t('delete')}
                className="rounded-lg bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="whitespace-pre-line text-sm leading-6 text-[var(--ink)]">{profile.story}</p>
          {profile.favorite_tools.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.favorite_tools.map((name) => (
                <span key={name} className="rounded-full border border-[var(--gold)]/30 px-2.5 py-1 text-xs font-medium text-[var(--ink)]">
                  {toolTitle.get(name) ?? name}
                </span>
              ))}
            </div>
          )}
          {profile.show_on_home && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <Home className="h-3.5 w-3.5" /> {t('homeVisibleNote')}
            </p>
          )}
        </div>
      ) : showForm && (
        <>
          <h2 className="mb-1 text-lg font-bold text-[var(--ink)]">{t('formTitle')}</h2>
          <p className="mb-6 text-sm text-[var(--muted)]">{t('formDescription')}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('displayNameField')}</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                maxLength={60}
                className="w-full rounded-lg border border-[var(--gold)]/30 p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                required
              />
              <p className="mt-1 text-xs text-[var(--muted)]">{t('displayNameHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('cityField')}</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full rounded-lg border border-[var(--gold)]/30 p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('countryField')}</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full rounded-lg border border-[var(--gold)]/30 p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('professionField')}</label>
              <input
                type="text"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                className="w-full rounded-lg border border-[var(--gold)]/30 p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-medium text-[var(--ink)]">{t('storyField')}</label>
                <span className={`text-xs ${remaining < 0 ? 'text-red-600' : 'text-[var(--muted)]'}`}>{form.story.length}/{SPOTLIGHT_STORY_MAX_LENGTH}</span>
              </div>
              <textarea
                value={form.story}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
                maxLength={SPOTLIGHT_STORY_MAX_LENGTH}
                rows={4}
                className="w-full resize-none rounded-lg border border-[var(--gold)]/30 p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                required
              />
              <p className="mt-1 text-xs text-[var(--muted)]">{t('storyHint')}</p>
            </div>

            {availableTools.length > 0 && (
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--ink)]">{t('favoriteToolsField')}</label>
                <div className="flex flex-wrap gap-2">
                  {availableTools.map((tool) => {
                    const selected = form.favoriteTools.includes(tool.toolName)
                    return (
                      <button
                        key={tool.toolName}
                        type="button"
                        onClick={() => toggleTool(tool.toolName)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'border-transparent bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]'
                            : 'border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10'
                        }`}
                      >
                        {tool.title}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <label className="flex items-start gap-2.5 rounded-lg border border-[var(--gold)]/20 bg-[var(--background)] p-3 text-sm text-[var(--ink)]">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[var(--gold)]" />
              {t('consentLabel')}
            </label>

            {/* Consenso separato per la vetrina massima (landing pubblica):
                facoltativo, revocabile in 1 click anche senza risalvare. */}
            <label className="flex items-start gap-2.5 rounded-lg border border-[var(--gold)]/20 bg-[var(--background)] p-3 text-sm text-[var(--ink)]">
              <input type="checkbox" checked={showOnHome} onChange={(e) => setShowOnHome(e.target.checked)} className="mt-0.5 accent-[var(--gold)]" />
              <span>
                {t('homeConsentLabel')}
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{t('homeConsentHint')}</span>
              </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] disabled:opacity-50"
              >
                {saving ? t('saving') : t('save')}
              </button>
              {profile && (
                <button type="button" onClick={handleCancelEdit} className={grayButton}>
                  {t('cancelEdit')}
                </button>
              )}
            </div>

            {profile && (
              <div className="flex flex-wrap gap-3 border-t border-[var(--gold)]/15 pt-4">
                {profile.is_opted_in && (
                  <button type="button" onClick={handleRevoke} className={grayButton}>
                    {t('revoke')}
                  </button>
                )}
                {profile.show_on_home && (
                  <button type="button" onClick={handleRevokeHome} className={grayButton}>
                    {t('revokeHome')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded-lg bg-red-100 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
                >
                  {t('delete')}
                </button>
              </div>
            )}
          </form>
        </>
      )}

      {/* Popup di conferma subito dopo il salvataggio. */}
      {popupStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setPopupStatus(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl bg-[var(--paper)] p-6 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {popupStatus === 'approved' ? (
              <>
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" />
                <p className="text-lg font-bold text-[var(--ink)]">{t('savedApprovedTitle')}</p>
                <Link href="/spotlight" className="mt-2 inline-block text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                  {t('viewPublicPage')}
                </Link>
              </>
            ) : (
              <>
                <Clock className="mx-auto mb-3 h-12 w-12 text-[var(--gold)]" />
                <p className="text-lg font-bold text-[var(--ink)]">{t('savedPendingTitle')}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('savedPendingText')}</p>
              </>
            )}
            <button
              type="button"
              onClick={() => setPopupStatus(null)}
              autoFocus
              className="mt-5 w-full rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-bold text-[var(--ink)]"
            >
              {t('popupOk')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
