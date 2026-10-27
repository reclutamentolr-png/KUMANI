'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Ban, Check, ImagePlus, Loader2, X } from 'lucide-react'
import { drawTheme, readImage, sameChoice, saveImage, THEMES, type BackgroundChoice, type ThemeId } from '@/components/webinar/background'
import { initials } from '@/components/webinar/rtc'

// Pezzi comuni a regia e pagina di chi guarda: pulsanti della barra in
// basso (come Meet e Zoom), riquadri delle videocamere, scelta dello sfondo.

// selected: pannello aperto o scelta attiva (meno acceso di active)
type Tone = 'normal' | 'off' | 'selected' | 'active' | 'danger'

const TONES: Record<Tone, string> = {
  normal: 'bg-[#3a352d] text-white hover:bg-[#4a443a]',
  off: 'bg-red-600 text-white hover:bg-red-700',
  selected: 'bg-[#4a443a] text-[var(--gold-bright)] ring-2 ring-inset ring-[var(--gold)]/70',
  active: 'bg-[var(--gold-bright)] text-[var(--ink)]',
  danger: 'bg-red-700 text-white hover:bg-red-800',
}

export function CallButton({
  icon: Icon,
  label,
  onClick,
  tone = 'normal',
  pressed,
  disabled,
  badge,
  busy,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  onClick: () => void
  tone?: Tone
  pressed?: boolean
  disabled?: boolean
  badge?: number
  busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className="group flex w-[4.25rem] shrink-0 flex-col items-center gap-1 text-[11px] font-bold leading-tight text-white disabled:opacity-40 sm:w-[4.75rem]"
    >
      <span
        className={`relative flex h-12 w-12 items-center justify-center rounded-full transition group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--gold-bright)] ${TONES[tone]}`}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Icon className="h-5 w-5" aria-hidden />}
        {!!badge && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--gold-bright)] px-1 text-center text-[10px] font-extrabold leading-5 text-[var(--ink)]">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-center">{label}</span>
    </button>
  )
}

export type FaceTile = { key: string; label: string; stream: MediaStream | null; mirror?: boolean }

// Videocamere di chi parla: riquadri piccoli. Colonna accanto alla chat sul
// computer, striscia orizzontale sul telefono. className dice anche quando si
// vede (es. «flex lg:hidden»).
export function FaceStrip({ tiles, className = 'flex' }: { tiles: FaceTile[]; className?: string }) {
  if (tiles.length === 0) return null
  return (
    <div className={`gap-2 overflow-x-auto lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden ${className}`}>
      {tiles.map((f) => (
        <div key={f.key} className="relative w-24 shrink-0 overflow-hidden rounded-xl border-2 border-emerald-400 bg-[#2a2620] lg:w-full">
          {f.stream ? (
            <video
              ref={(el) => {
                if (el && el.srcObject !== f.stream) {
                  el.srcObject = f.stream
                  el.play().catch(() => {})
                }
              }}
              autoPlay
              playsInline
              muted
              className={`aspect-[4/3] w-full object-cover ${f.mirror ? '-scale-x-100' : ''}`}
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b352b] text-sm font-extrabold text-[var(--gold-bright)]">{initials(f.label)}</span>
            </div>
          )}
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-center text-[10px] font-bold text-white">{f.label}</span>
        </div>
      ))}
    </div>
  )
}

const THEME_LABEL: Record<ThemeId, string> = {
  gold: 'themeGold',
  night: 'themeNight',
  studio: 'themeStudio',
  nature: 'themeNature',
  office: 'themeOffice',
}

function themePreviews() {
  const out = {} as Record<ThemeId, string>
  const canvas = document.createElement('canvas')
  canvas.width = 160
  canvas.height = 90
  const ctx = canvas.getContext('2d')
  for (const id of THEMES) {
    if (ctx) drawTheme(ctx, id, 160, 90)
    out[id] = ctx ? canvas.toDataURL() : ''
  }
  return out
}

// Scelta dello sfondo: nessuno, sfocato, un tema o un'immagine propria
export function BackgroundPicker({
  value,
  onChange,
  onClose,
  busy,
  error,
}: {
  value: BackgroundChoice
  onChange: (c: BackgroundChoice) => void
  onClose: () => void
  busy: boolean
  error: string | null
}) {
  const t = useTranslations('webinar')
  // Anteprime dei temi: disegnate nel browser dopo l'apertura
  const [previews, setPreviews] = useState<Record<ThemeId, string> | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviews(themePreviews())
  }, [])
  const [image, setImage] = useState(readImage)
  const fileRef = useRef<HTMLInputElement>(null)

  const tile = (choice: BackgroundChoice, label: string, content: React.ReactNode) => {
    const selected = sameChoice(choice, value)
    return (
      <button
        type="button"
        onClick={() => onChange(choice)}
        disabled={busy}
        aria-pressed={selected}
        className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-2 text-[11px] font-bold text-white disabled:opacity-60 ${
          selected ? 'border-[var(--gold-bright)]' : 'border-white/15 hover:border-white/40'
        }`}
      >
        {content}
        <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5">{label}</span>
        {selected && <Check className="absolute right-1 top-1 h-4 w-4 rounded-full bg-[var(--gold-bright)] p-0.5 text-[var(--ink)]" aria-hidden />}
      </button>
    )
  }

  return (
    <div role="dialog" aria-label={t('bgTitle')} className="w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#1b1915] p-3 text-white shadow-2xl">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-sm font-extrabold">{t('bgTitle')}</p>
        {busy && (
          <span className="inline-flex items-center gap-1 text-xs text-white/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('bgLoading')}
          </span>
        )}
        <button type="button" onClick={onClose} aria-label={t('bgClose')} className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {tile({ kind: 'none' }, t('bgNone'), <Ban className="h-6 w-6 text-white/60" aria-hidden />)}
        {tile({ kind: 'blur', level: 'light' }, t('bgBlurLight'), <span className="h-full w-full bg-gradient-to-br from-[#6b6152] to-[#2f2a22] blur-[2px]" />)}
        {tile({ kind: 'blur', level: 'strong' }, t('bgBlurStrong'), <span className="h-full w-full bg-gradient-to-br from-[#6b6152] to-[#2f2a22] blur-md" />)}
        {THEMES.map((id) => (
          <span key={id} className="contents">
            {/* eslint-disable-next-line @next/next/no-img-element -- anteprima disegnata nel browser */}
            {tile({ kind: 'theme', id }, t(THEME_LABEL[id]), previews ? <img src={previews[id]} alt="" className="h-full w-full object-cover" /> : null)}
          </span>
        ))}
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- immagine scelta dalla persona, solo nel browser
          tile({ kind: 'image' }, t('bgMyImage'), <img src={image} alt="" className="h-full w-full object-cover" />)
        ) : null}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/25 text-[11px] font-bold text-white/80 hover:border-white/50 disabled:opacity-60"
        >
          <ImagePlus className="h-5 w-5" aria-hidden />
          {t('bgUpload')}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          try {
            setImage(await saveImage(file))
            onChange({ kind: 'image' })
          } catch {
            // Immagine non leggibile: resta lo sfondo di prima
          }
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
