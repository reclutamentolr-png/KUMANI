'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { saveLinkInBio } from '@/app/actions/linkInBio'
import { normalizeLinkUrl, displayLinkValue } from '@/lib/linkUtils'
import { BIO_THEMES, ALL_BIO_THEME_KEYS, DEFAULT_BIO_THEME, PREMIUM_BIO_THEME_KEYS, resolveBioTheme, type BioThemeKey } from '@/lib/linkInBioThemes'
import { KU_UNLOCK_LINKINBIO_THEMES } from '@/lib/ku'
import Link from '@/components/LocalizedLink'
import { Plus, Trash2, Save, Link as LinkIcon, Check, ExternalLink, Globe, Mail, Phone, MessageCircle, Lock } from 'lucide-react'

type LinkItem = {
  id: string
  title: string
  url: string
  icon: string
  enabled: boolean
}

const ICON_MAP: Record<string, typeof Globe> = {
  website: Globe,
  email: Mail,
  phone: Phone,
  whatsapp: MessageCircle,
  default: LinkIcon,
}

const URL_PLACEHOLDER_MAP: Record<string, string> = {
  email: 'email@esempio.com',
  phone: '+39 333 1234567',
  whatsapp: '+39 333 1234567',
}

export default function LinkInBioEditor({ userId, firstName, lastName }: { userId: string; firstName?: string; lastName?: string }) {
  const t = useTranslations('marketplace')
  const supabase = createClient()
  const [bioText, setBioText] = useState('')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [theme, setTheme] = useState<BioThemeKey>(DEFAULT_BIO_THEME)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  // Temi speciali (sblocco KU): 'owned' = già sbloccati, 'available' =
  // acquistabili nel Portafoglio, 'hidden' = sblocco non attivo.
  const [premiumState, setPremiumState] = useState<'owned' | 'available' | 'hidden'>('hidden')
  const [premiumHint, setPremiumHint] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('link_in_bio')
        .select('bio_text, links, theme')
        .eq('user_id', userId)
        .single()

      const [{ data: purchase }, { data: feature }, { data: unlock }] = await Promise.all([
        supabase.from('ku_unlock_purchases').select('unlock_key').eq('unlock_key', KU_UNLOCK_LINKINBIO_THEMES).maybeSingle(),
        supabase.from('ku_features').select('enabled').eq('key', 'unlocks').maybeSingle(),
        supabase.from('ku_unlocks').select('enabled').eq('key', KU_UNLOCK_LINKINBIO_THEMES).maybeSingle(),
      ])
      setPremiumState(purchase ? 'owned' : feature?.enabled && unlock?.enabled ? 'available' : 'hidden')

      if (data) {
        setBioText(data.bio_text || '')
        try {
          // Tollerante: links può essere una stringa JSON o già un array (jsonb)
          const raw: unknown = typeof data.links === 'string' ? JSON.parse(data.links) : data.links
          const parsed: LinkItem[] = Array.isArray(raw) ? (raw as LinkItem[]) : []
          // Show the bare value (email/number) in the input, not the stored
          // mailto:/tel:/wa.me form — also cleans up rows saved before this
          // fix existed (which had the wrong scheme prepended).
          setLinks(parsed.map((l) => ({ ...l, url: displayLinkValue(l.icon, l.url) })))
        } catch {
          setLinks([])
        }
        if (data.theme && ALL_BIO_THEME_KEYS.includes(data.theme as BioThemeKey)) {
          setTheme(data.theme as BioThemeKey)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [userId, supabase])

  const addLink = () => {
    setLinks([
      ...links,
      { id: crypto.randomUUID(), title: '', url: '', icon: 'default', enabled: true }
    ])
  }

  const updateLink = (id: string, field: keyof LinkItem, value: string) => {
    setLinks(links.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const removeLink = (id: string) => {
    setLinks(links.filter(l => l.id !== id))
  }

  const handleSave = async () => {
    setSaving(true)
    setJustSaved(false)
    try {
      const result = await saveLinkInBio(bioText, links, theme)
      if (!result.success) throw new Error('save failed')
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 3000)
    } catch (error) {
      console.error('Save error:', error)
      alert(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">{t('loadingEditor')}</div>

  const previewStyle = resolveBioTheme(theme)
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-[var(--gold)]" />
          {t('editPage')}
        </h3>

        {/* Bio Text */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('bioTextLabel')}</label>
          <textarea
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            placeholder={t('bioTextPlaceholder')}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)] focus:outline-none h-24 resize-none"
          />
        </div>

        {/* Theme Picker */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('bioThemeLabel')}</label>
          <div className="flex flex-wrap gap-2">
            {ALL_BIO_THEME_KEYS.map((key) => {
              const style = BIO_THEMES[key]
              const selected = theme === key
              const premium = PREMIUM_BIO_THEME_KEYS.includes(key)
              if (premium && premiumState === 'hidden' && !selected) return null
              const locked = premium && premiumState !== 'owned'
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => (locked ? setPremiumHint(true) : setTheme(key))}
                  title={style.label}
                  className={`relative w-9 h-9 rounded-full ${style.swatchClass} transition-transform hover:scale-110 ${selected ? 'ring-2 ring-offset-2 ring-[var(--gold)]' : ''} ${locked ? 'opacity-60' : ''}`}
                >
                  {selected && (
                    <Check className={`w-4 h-4 absolute inset-0 m-auto ${key === 'bianco' || key === 'giallo' ? 'text-gray-900' : 'text-white'}`} />
                  )}
                  {locked && <Lock className="w-3.5 h-3.5 absolute inset-0 m-auto text-white" />}
                </button>
              )
            })}
          </div>
          {premiumHint && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t('premiumThemesHint')}{' '}
              <Link href="/wallet" className="font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                {t('premiumThemesCta')}
              </Link>
            </p>
          )}
        </div>

        {/* Links Manager */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-medium text-gray-700">{t('customLinks')}</label>
            <button
              onClick={addLink}
              className="text-sm flex items-center gap-1 text-[var(--gold)] hover:text-[var(--ink)] font-medium"
            >
              <Plus className="w-4 h-4" /> {t('addLink')}
            </button>
          </div>

          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="flex gap-2 items-start bg-gray-50 p-3 rounded-lg border border-gray-200">
                <select
                  value={link.icon}
                  onChange={(e) => updateLink(link.id, 'icon', e.target.value)}
                  className="w-36 shrink-0 p-2 border border-gray-300 rounded bg-white text-sm"
                >
                  <option value="default">🔗 {t('link')}</option>
                  <option value="website">🌍 {t('website')}</option>
                  <option value="email">✉️ {t('email')}</option>
                  <option value="phone">📞 {t('phone')}</option>
                  <option value="whatsapp">💬 {t('whatsapp')}</option>
                </select>

                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder={t('linkTitlePlaceholder')}
                    value={link.title}
                    onChange={(e) => updateLink(link.id, 'title', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                  <input
                    type="text"
                    placeholder={URL_PLACEHOLDER_MAP[link.icon] || t('linkUrlPlaceholder')}
                    value={link.url}
                    onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm font-mono"
                  />
                </div>

                <button
                  onClick={() => removeLink(link.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded transition-colors mt-1"
                  title={t('removeLink')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {links.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                {t('noCustomLinks')}
              </p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          {justSaved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <Check className="w-4 h-4" /> {t('savedSuccess')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--ink)] hover:bg-[var(--ink-soft)] disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? t('saving') : t('savePage')}
          </button>
        </div>
      </div>

      {/* Live Preview — driven by this component's own state, so it reflects
          every keystroke and every save immediately, unlike the old static
          mockup that never read the real bio/links at all. */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 lg:sticky lg:top-24">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          {t('previewOf')}
        </h3>
        <div className={`rounded-2xl p-6 text-center ${previewStyle.pageBg}`}>
          <div className={`rounded-3xl p-6 ${previewStyle.cardBg}`}>
            <div className={`w-20 h-20 rounded-full ${previewStyle.avatarBg} ${previewStyle.avatarText} flex items-center justify-center mx-auto mb-3 text-3xl font-bold shadow-lg`}>
              {(firstName || 'U').charAt(0).toUpperCase()}
            </div>
            <h3 className={`text-xl font-bold mb-1 ${previewStyle.nameText}`}>{displayName || t('networkMarketer')}</h3>
            <p className={`text-sm mb-4 ${previewStyle.secondaryText}`}>
              {bioText || t('networkMarketer')}
            </p>

            <div className="space-y-2">
              {links.filter((l) => l.enabled !== false && l.title).length === 0 ? (
                <p className={`text-xs ${previewStyle.secondaryText}`}>{t('noCustomLinks')}</p>
              ) : (
                links
                  .filter((l) => l.enabled !== false && l.title)
                  .map((link) => {
                    const Icon = ICON_MAP[link.icon] || ICON_MAP.default
                    return (
                      <a
                        key={link.id}
                        href={normalizeLinkUrl(link.icon, link.url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-3 rounded-xl p-3 transition-colors ${previewStyle.linkBg}`}
                      >
                        <div className={`w-8 h-8 rounded-full ${previewStyle.linkIconBg} flex items-center justify-center shrink-0`}>
                          <Icon className={`w-4 h-4 ${previewStyle.linkIconText}`} />
                        </div>
                        <span className={`flex-1 text-sm font-semibold text-center ${previewStyle.linkText}`}>
                          {link.title}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      </a>
                    )
                  })
              )}
            </div>

            <p className={`text-xs mt-5 ${previewStyle.footerText}`}>
              Powered by <span className="font-semibold">Kumani</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
