'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { saveLinkInBio } from '@/app/actions/linkInBio'
import { normalizeLinkUrl, displayLinkValue } from '@/lib/linkUtils'
import { BIO_THEMES, ALL_BIO_THEME_KEYS, DEFAULT_BIO_THEME, PREMIUM_BIO_THEME_KEYS, resolveBioTheme, type BioThemeKey } from '@/lib/linkInBioThemes'
import { KU_UNLOCK_LINKINBIO_THEMES, linkInBioThemeUnlockKey } from '@/lib/ku'
import { buyKuUnlock } from '@/app/actions/ku'
import Link from '@/components/LocalizedLink'
import BioThemeScene from '@/components/BioThemeScene'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import { businessWebsiteUrl, type BusinessProfile } from '@/lib/businessProfile'
import { Plus, Trash2, Save, Link as LinkIcon, Check, ExternalLink, Globe, Mail, Phone, MessageCircle, Lock, Loader2, Eye, Sparkles, X } from 'lucide-react'

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

export default function LinkInBioEditor({
  userId,
  firstName,
  lastName,
  businessProfile = null,
}: {
  userId: string
  firstName?: string
  lastName?: string
  businessProfile?: BusinessProfile | null
}) {
  const t = useTranslations('marketplace')
  const supabase = createClient()
  const [bioText, setBioText] = useState('')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [theme, setTheme] = useState<BioThemeKey>(DEFAULT_BIO_THEME)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  // Temi speciali: ognuno si sblocca a parte con i KU Karma (popup qui
  // nello strumento). owned = temi già sbloccati; costs = costo dei temi
  // acquistabili (assente = sblocco non attivo); kuBalance = KU Karma disponibili.
  const [ownedThemes, setOwnedThemes] = useState<string[]>([])
  const [themeCosts, setThemeCosts] = useState<Record<string, number>>({})
  const [kuBalance, setKuBalance] = useState(0)
  const [unlockTheme, setUnlockTheme] = useState<BioThemeKey | null>(null)
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  // Tema speciale in prova: l'anteprima lo mostra senza toccare il tema
  // salvato, così l'utente lo vede prima di spendere i KU Karma.
  const [previewTheme, setPreviewTheme] = useState<BioThemeKey | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('link_in_bio')
        .select('bio_text, links, theme')
        .eq('user_id', userId)
        .single()

      const themeKeys = PREMIUM_BIO_THEME_KEYS.map(linkInBioThemeUnlockKey)
      const [{ data: purchases }, { data: feature }, { data: unlocks }, { data: me }] = await Promise.all([
        supabase.from('ku_unlock_purchases').select('unlock_key').in('unlock_key', [...themeKeys, KU_UNLOCK_LINKINBIO_THEMES]),
        supabase.from('ku_features').select('enabled').eq('key', 'unlocks').maybeSingle(),
        supabase.from('ku_unlocks').select('key, cost_ku, enabled').in('key', themeKeys),
        supabase.from('profiles').select('daily_points').eq('id', userId).maybeSingle(),
      ])
      const bought = (purchases ?? []).map((row) => row.unlock_key as string)
      // Il vecchio pacchetto apre tutti e tre i temi
      setOwnedThemes(
        PREMIUM_BIO_THEME_KEYS.filter((key) => bought.includes(KU_UNLOCK_LINKINBIO_THEMES) || bought.includes(linkInBioThemeUnlockKey(key)))
      )
      setThemeCosts(
        feature?.enabled
          ? Object.fromEntries((unlocks ?? []).filter((u) => u.enabled).map((u) => [String(u.key).replace('linkinbio_theme_', ''), u.cost_ku as number]))
          : {}
      )
      setKuBalance(me?.daily_points ?? 0)

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

  // «Usa i dati della Scheda attività»: frase dalla Scheda e link mancanti
  // (sito, WhatsApp, email, telefono); quelli già presenti non si duplicano
  const importProfile = (p: BusinessProfile) => {
    if (p.tagline.trim()) setBioText(p.tagline.trim())
    const candidates: { icon: string; url: string; title: string }[] = [
      { icon: 'website', url: businessWebsiteUrl(p.website), title: t('website') },
      { icon: 'whatsapp', url: p.whatsapp.trim(), title: t('whatsapp') },
      { icon: 'email', url: p.email.trim(), title: t('email') },
      { icon: 'phone', url: p.phone.trim(), title: t('phone') },
    ]
    setLinks((prev) => {
      const existing = new Set(prev.map((l) => normalizeLinkUrl(l.icon, l.url)).filter(Boolean))
      const added = candidates
        .filter((c) => c.url && !existing.has(normalizeLinkUrl(c.icon, c.url)))
        .map((c) => ({ id: crypto.randomUUID(), title: c.title, url: c.url, icon: c.icon, enabled: true }))
      return [...prev, ...added]
    })
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

  if (loading) return <div className="text-center py-8 text-[var(--muted)]">{t('loadingEditor')}</div>

  const previewStyle = resolveBioTheme(previewTheme ?? theme)
  const baseThemes = ALL_BIO_THEME_KEYS.filter((key) => !PREMIUM_BIO_THEME_KEYS.includes(key))
  // Un tema speciale si mostra se è già tuo, se si può sbloccare o se è
  // quello in uso (sblocchi spenti dopo averlo scelto).
  const specialThemes = PREMIUM_BIO_THEME_KEYS.filter(
    (key) => ownedThemes.includes(key) || themeCosts[key] !== undefined || theme === key
  )
  const themeName = (key: BioThemeKey) => (BIO_THEMES[key].scene ? t(`themeName_${BIO_THEMES[key].scene}`) : BIO_THEMES[key].label)
  const tryTheme = (key: BioThemeKey) => {
    setPreviewTheme(key)
    // Su telefono l'anteprima sta sotto l'editor: portala in vista
    if (window.innerWidth < 1024) previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const displayName = [firstName, lastName].filter(Boolean).join(' ')

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 items-start">
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-5 sm:p-6">
        <h3 className="text-lg font-bold text-[var(--ink)] mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-[var(--gold)]" />
          {t('editPage')}
        </h3>

        <BusinessProfileImport profile={businessProfile} onImport={importProfile} className="mb-6" />

        {/* Bio Text */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">{t('bioTextLabel')}</label>
          <textarea
            value={bioText}
            onChange={(e) => setBioText(e.target.value)}
            placeholder={t('bioTextPlaceholder')}
            className="w-full p-3 border border-[var(--gold)]/30 rounded-lg focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 h-24 resize-none"
          />
        </div>

        {/* Theme Picker */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">{t('bioThemeLabel')}</label>
          <div className="flex flex-wrap gap-2">
            {baseThemes.map((key) => {
              const style = BIO_THEMES[key]
              const selected = theme === key && !previewTheme
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTheme(key)
                    setPreviewTheme(null)
                  }}
                  title={style.label}
                  className={`relative w-9 h-9 rounded-full ${style.swatchClass} transition-transform hover:scale-110 ${selected ? 'ring-2 ring-offset-2 ring-[var(--gold)]' : ''}`}
                >
                  {selected && (
                    <Check className={`w-4 h-4 absolute inset-0 m-auto ${key === 'bianco' || key === 'giallo' ? 'text-gray-900' : 'text-white'}`} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Temi speciali: schede con mini-anteprima, da provare prima di sbloccarli */}
          {specialThemes.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--gold)]" />
                <span className="text-sm font-semibold text-[var(--ink)]">{t('specialThemesTitle')}</span>
              </div>
              <p className="mb-3 text-xs text-[var(--muted)]">{t('specialThemesHint')}</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {specialThemes.map((key) => {
                  const style = BIO_THEMES[key]
                  const owned = ownedThemes.includes(key)
                  const inUse = theme === key && !previewTheme
                  const trying = previewTheme === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (owned) {
                          setTheme(key)
                          setPreviewTheme(null)
                        } else {
                          tryTheme(key)
                        }
                      }}
                      className={`group relative overflow-hidden rounded-xl text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${inUse || trying ? 'ring-2 ring-[var(--gold)] ring-offset-2' : 'ring-1 ring-black/10'}`}
                    >
                      <div className={`relative flex h-28 items-center justify-center overflow-hidden p-2 ${style.pageBg}`}>
                        {style.scene && <BioThemeScene scene={style.scene} crop className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105" />}
                        <div className={`relative w-14 rounded-lg p-1.5 ${style.cardBg}`}>
                          <div className={`mx-auto h-4 w-4 rounded-full ${style.avatarBg}`} />
                          <div className={`mx-auto mt-1 h-1 w-8 rounded-full ${style.linkIconBg}`} />
                          <div className={`mt-1.5 h-2 rounded ${style.linkBg}`} />
                          <div className={`mt-1 h-2 rounded ${style.linkBg}`} />
                        </div>
                      </div>
                      {!owned && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
                          {trying ? <Eye className="h-3.5 w-3.5" /> : <Lock className="h-3 w-3" />}
                        </span>
                      )}
                      <div className="flex flex-col gap-1 bg-white px-2 py-1.5">
                        <span className="truncate text-xs font-bold text-[var(--ink)]">{themeName(key)}</span>
                        {owned ? (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <Check className="h-3 w-3" /> {inUse ? t('themeInUse') : t('themeOwned')}
                          </span>
                        ) : (
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-[var(--gold-bright)]">
                            {themeCosts[key] !== undefined ? `${themeCosts[key]} KU Karma` : t('themeLocked')}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Links Manager */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-semibold text-[var(--ink)]">{t('customLinks')}</label>
            <button
              onClick={addLink}
              className="text-sm flex items-center gap-1 rounded-lg border border-[var(--gold)]/40 px-3 py-1.5 text-[var(--ink)] hover:bg-[var(--gold)]/10 font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('addLink')}
            </button>
          </div>

          <div className="space-y-3">
            {links.map((link) => (
              <div key={link.id} className="flex gap-2 items-start bg-[var(--paper)] p-3 rounded-lg border border-[var(--gold)]/20">
                <select
                  value={link.icon}
                  onChange={(e) => updateLink(link.id, 'icon', e.target.value)}
                  className="w-36 shrink-0 p-2 border border-[var(--gold)]/30 rounded-lg bg-white text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
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
                    className="w-full p-2 border border-[var(--gold)]/30 rounded-lg bg-white text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                  />
                  <input
                    type="text"
                    placeholder={URL_PLACEHOLDER_MAP[link.icon] || t('linkUrlPlaceholder')}
                    value={link.url}
                    onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                    className="w-full p-2 border border-[var(--gold)]/30 rounded-lg bg-white text-sm font-mono focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
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
              <p className="text-sm text-[var(--muted)] text-center py-4 bg-[var(--paper)] rounded-lg border border-dashed border-[var(--gold)]/30">
                {t('noCustomLinks')}
              </p>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-[var(--gold)]/20">
          {justSaved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <Check className="w-4 h-4" /> {t('savedSuccess')}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-105 disabled:opacity-50 text-[var(--ink)] rounded-lg font-bold transition"
          >
            <Save className="w-4 h-4" />
            {saving ? t('saving') : t('savePage')}
          </button>
        </div>
      </div>

      {/* Live Preview — driven by this component's own state, so it reflects
          every keystroke and every save immediately, unlike the old static
          mockup that never read the real bio/links at all. */}
      <div ref={previewRef} className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-5 sm:p-6 lg:sticky lg:top-24 scroll-mt-24">
        <h3 className="text-lg font-bold text-[var(--ink)] mb-4 flex items-center gap-2">
          {t('previewOf')}
        </h3>
        {previewTheme && (
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--ink)] px-3 py-2.5 text-sm text-white">
            <Eye className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
            <span className="flex-1">{t('themePreviewText', { name: themeName(previewTheme) })}</span>
            <button type="button" onClick={() => setPreviewTheme(null)} title={t('themePreviewClose')} className="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className={`relative overflow-hidden rounded-2xl p-6 text-center ${previewStyle.pageBg}`}>
          {previewStyle.scene && <BioThemeScene scene={previewStyle.scene} className="absolute inset-0 h-full w-full" />}
          {previewTheme && (
            <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
              <Sparkles className="h-3 w-3" /> {t('themePreviewBadge')}
            </span>
          )}
          <div className={`relative rounded-3xl p-6 ${previewStyle.cardBg}`}>
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
        {previewTheme && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {themeCosts[previewTheme] !== undefined ? (
              <button
                type="button"
                onClick={() => {
                  setUnlockError(null)
                  setUnlockTheme(previewTheme)
                }}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-3 font-bold text-[var(--ink)] shadow-sm hover:brightness-105"
              >
                <Lock className="h-4 w-4" /> {t('themeUnlockButton', { cost: themeCosts[previewTheme] })}
              </button>
            ) : (
              <p className="flex-1 rounded-xl bg-gray-50 p-3 text-center text-sm text-[var(--muted)]">{t('themeUnlockUnavailable')}</p>
            )}
            <button
              type="button"
              onClick={() => setPreviewTheme(null)}
              className="rounded-xl border border-[var(--gold)]/40 px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold)]/10"
            >
              {t('themePreviewClose')}
            </button>
          </div>
        )}
      </div>

      {/* Popup di sblocco di un tema speciale */}
      {unlockTheme && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={() => !unlocking && setUnlockTheme(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`relative mx-auto h-36 overflow-hidden rounded-xl ${BIO_THEMES[unlockTheme].pageBg}`}>
              {BIO_THEMES[unlockTheme].scene && <BioThemeScene scene={BIO_THEMES[unlockTheme].scene!} crop className="absolute inset-0 h-full w-full" />}
            </div>
            <h3 className="mt-4 text-center text-lg font-bold text-[var(--ink)]">{t('themeUnlockTitle', { name: themeName(unlockTheme) })}</h3>
            <p className="mt-1 text-center text-sm text-[var(--muted)]">{t('themeUnlockText')}</p>
            {themeCosts[unlockTheme] === undefined ? (
              <p className="mt-4 rounded-lg bg-gray-50 p-3 text-center text-sm text-[var(--muted)]">{t('themeUnlockUnavailable')}</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-[var(--gold-pale)] p-2">
                    <p className="text-xs text-[var(--muted)]">{t('themeUnlockCostLabel')}</p>
                    <p className="text-lg font-bold text-[var(--ink)]">{themeCosts[unlockTheme]} KU Karma</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <p className="text-xs text-[var(--muted)]">{t('themeUnlockBalanceLabel')}</p>
                    <p className="text-lg font-bold text-[var(--ink)]">{kuBalance} KU Karma</p>
                  </div>
                </div>
                {kuBalance < themeCosts[unlockTheme] && (
                  <p className="mt-3 text-center text-sm font-semibold text-red-600">{t('themeUnlockMissing', { missing: themeCosts[unlockTheme] - kuBalance })}</p>
                )}
              </>
            )}
            {unlockError && <p className="mt-3 text-center text-sm text-red-600">{unlockError}</p>}
            <div className="mt-5 flex flex-col gap-2">
              {themeCosts[unlockTheme] !== undefined && kuBalance >= themeCosts[unlockTheme] && (
                <button
                  type="button"
                  disabled={unlocking}
                  onClick={async () => {
                    const key = unlockTheme
                    setUnlocking(true)
                    setUnlockError(null)
                    const result = await buyKuUnlock(linkInBioThemeUnlockKey(key))
                    setUnlocking(false)
                    if (!result.success && result.reason !== 'already_owned') {
                      setUnlockError(t('themeUnlockError'))
                      return
                    }
                    setOwnedThemes((prev) => [...prev, key])
                    if (result.success) setKuBalance((prev) => prev - (themeCosts[key] ?? 0))
                    setTheme(key)
                    setPreviewTheme(null)
                    setUnlockTheme(null)
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-3 font-bold text-[var(--ink)] disabled:opacity-50"
                >
                  {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {t('themeUnlockButton', { cost: themeCosts[unlockTheme] })}
                </button>
              )}
              <Link href="/wallet" className="text-center text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                {t('themeUnlockWallet')}
              </Link>
              <button type="button" disabled={unlocking} onClick={() => setUnlockTheme(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
                {t('themeUnlockCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
