import type { CSSProperties, ReactNode } from 'react'
import { Clock, Mail, MapPin, MessageCircle, Phone, Star, UtensilsCrossed } from 'lucide-react'
import { ctaHref, landingPhotoUrl, landingTheme, type LandingContent, type LandingTemplate, type SectionKey } from '@/lib/landing'

// Aspetto della Landing Page: lo stesso componente disegna la pagina
// pubblica e l'anteprima nell'editor (niente stato, niente hook).

export type LandingLabels = {
  services: string
  about: string
  method: string
  testimonials: string
  testimonialsNote: string
  googleReviews: string
  gallery: string
  hours: string
  contacts: string
  call: string
  whatsapp: string
  email: string
  openMap: string
  seeMenu: string
  vat: string
  madeWith: string
  createYours: string
}

type Props = {
  content: LandingContent
  template: LandingTemplate
  accent: string
  labels: LandingLabels
  lang: string
  menuUrl?: string | null
  createHref?: string
  // Pulsante "Segnala" (solo sulla pagina pubblica)
  reportSlot?: ReactNode
  // Nell'anteprima i link non portano fuori dall'editor
  preview?: boolean
}

const SOCIAL_LABELS: Record<keyof LandingContent['social'], string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  website: 'Web',
}

export default function LandingView({ content: c, template, accent, labels, lang, menuUrl, createHref, reportSlot, preview }: Props) {
  const th = landingTheme(template, accent)
  const vars = {
    '--lp-bg': th.bg,
    '--lp-surface': th.surface,
    '--lp-text': th.text,
    '--lp-muted': th.muted,
    '--lp-line': th.line,
    '--lp-accent': th.accent,
    '--lp-on-accent': th.onAccent,
  } as CSSProperties
  const linkProps = preview ? { tabIndex: -1, onClick: undefined } : { target: '_blank', rel: 'noopener noreferrer' }
  const cta = ctaHref(c.hero.ctaKind, c.hero.ctaValue)
  const socials = (Object.keys(SOCIAL_LABELS) as (keyof LandingContent['social'])[]).filter((k) => c.social[k])
  const mapUrl = [c.contacts.address, c.contacts.city].filter(Boolean).join(', ')
  const showMenu = c.links.menu && menuUrl

  const heading = (text: string, fallback: string) => (
    <h2 className="mb-6 text-2xl font-bold @xl:text-3xl" style={{ color: 'var(--lp-text)' }}>
      <span className="mb-3 block h-1 w-10 rounded-full" style={{ background: 'var(--lp-accent)' }} />
      {text || fallback}
    </h2>
  )
  const card = 'rounded-2xl border p-5'
  const cardStyle = { background: 'var(--lp-surface)', borderColor: 'var(--lp-line)' }

  const sections: Record<SectionKey, ReactNode> = {
    services:
      c.services.on && c.services.items.length > 0 ? (
        <section key="services" className="px-5 py-12 @xl:px-8">
          {heading(c.services.title, labels.services)}
          <div className="grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
            {c.services.items.map((item, i) => (
              <div key={i} className={card} style={cardStyle}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ background: 'var(--lp-accent)', color: 'var(--lp-on-accent)' }}>
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                {item.text && <p className="mt-2 whitespace-pre-line leading-relaxed" style={{ color: 'var(--lp-muted)' }}>{item.text}</p>}
              </div>
            ))}
          </div>
        </section>
      ) : null,
    about:
      c.about.on && (c.about.text || c.about.photo) ? (
        <section key="about" className="px-5 py-12 @xl:px-8">
          <div className={`grid items-center gap-8 ${c.about.photo ? 'md:grid-cols-2' : ''}`}>
            {c.about.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={landingPhotoUrl(c.about.photo)} alt="" className="aspect-[4/3] w-full rounded-2xl object-cover" loading="lazy" />
            )}
            <div>
              {heading(c.about.title, labels.about)}
              <p className="whitespace-pre-line text-lg leading-relaxed" style={{ color: 'var(--lp-muted)' }}>{c.about.text}</p>
            </div>
          </div>
        </section>
      ) : null,
    method:
      c.method.on && c.method.items.length > 0 ? (
        <section key="method" className="px-5 py-12 @xl:px-8">
          {heading(c.method.title, labels.method)}
          <ol className="grid gap-4 @xl:grid-cols-2">
            {c.method.items.map((item, i) => (
              <li key={i} className="flex gap-4">
                <span className="w-12 shrink-0 text-3xl font-bold leading-none" style={{ color: 'var(--lp-accent)' }}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  {item.text && <p className="mt-1 whitespace-pre-line leading-relaxed" style={{ color: 'var(--lp-muted)' }}>{item.text}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null,
    testimonials:
      c.testimonials.on && c.testimonials.items.length > 0 ? (
        <section key="testimonials" className="px-5 py-12 @xl:px-8">
          {heading(c.testimonials.title, labels.testimonials)}
          <div className="grid gap-4 @xl:grid-cols-2">
            {c.testimonials.items.map((item, i) => (
              <figure key={i} className={card} style={cardStyle}>
                {item.stars > 0 && (
                  <div className="mb-2 flex gap-0.5" aria-label={`${item.stars}/5`}>
                    {Array.from({ length: 5 }, (_, s) => (
                      <Star key={s} className="h-4 w-4" style={{ color: 'var(--lp-accent)', fill: s < item.stars ? 'var(--lp-accent)' : 'transparent' }} />
                    ))}
                  </div>
                )}
                <blockquote className="whitespace-pre-line leading-relaxed">“{item.text}”</blockquote>
                {item.name && <figcaption className="mt-3 text-sm font-semibold" style={{ color: 'var(--lp-muted)' }}>{item.name}</figcaption>}
              </figure>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs" style={{ color: 'var(--lp-muted)' }}>
            <span>{labels.testimonialsNote}</span>
            {c.testimonials.googleUrl && (
              <a href={preview ? undefined : c.testimonials.googleUrl} {...linkProps} className="font-semibold underline" style={{ color: 'var(--lp-accent)' }}>
                {labels.googleReviews}
              </a>
            )}
          </div>
        </section>
      ) : null,
    gallery:
      c.gallery.on && c.gallery.photos.length > 0 ? (
        <section key="gallery" className="px-5 py-12 @xl:px-8">
          {heading(c.gallery.title, labels.gallery)}
          <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
            {c.gallery.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={landingPhotoUrl(p)} alt="" className="aspect-square w-full rounded-xl object-cover" loading="lazy" />
            ))}
          </div>
        </section>
      ) : null,
    hours:
      c.hours.on && c.hours.rows.length > 0 ? (
        <section key="hours" className="px-5 py-12 @xl:px-8">
          {heading(c.hours.title, labels.hours)}
          <div className={`${card} max-w-xl`} style={cardStyle}>
            <dl className="divide-y" style={{ borderColor: 'var(--lp-line)' }}>
              {c.hours.rows.map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-2.5" style={{ borderColor: 'var(--lp-line)' }}>
                  <dt className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" style={{ color: 'var(--lp-accent)' }} /> {row.day}
                  </dt>
                  <dd style={{ color: 'var(--lp-muted)' }}>{row.hours}</dd>
                </div>
              ))}
            </dl>
            {c.hours.note && <p className="mt-3 text-sm" style={{ color: 'var(--lp-muted)' }}>{c.hours.note}</p>}
          </div>
        </section>
      ) : null,
    contacts:
      c.contacts.on && (c.contacts.phone || c.contacts.whatsapp || c.contacts.email || mapUrl) ? (
        <section key="contacts" className="px-5 py-12 @xl:px-8">
          {heading(c.contacts.title, labels.contacts)}
          <div className="grid gap-3 @xl:grid-cols-2">
            {c.contacts.whatsapp && (
              <a href={preview ? undefined : ctaHref('whatsapp', c.contacts.whatsapp)} {...linkProps} className={`${card} flex items-center gap-3`} style={cardStyle}>
                <MessageCircle className="h-5 w-5 shrink-0" style={{ color: 'var(--lp-accent)' }} />
                <span><span className="block text-sm" style={{ color: 'var(--lp-muted)' }}>{labels.whatsapp}</span>{c.contacts.whatsapp}</span>
              </a>
            )}
            {c.contacts.phone && (
              <a href={preview ? undefined : ctaHref('phone', c.contacts.phone)} className={`${card} flex items-center gap-3`} style={cardStyle}>
                <Phone className="h-5 w-5 shrink-0" style={{ color: 'var(--lp-accent)' }} />
                <span><span className="block text-sm" style={{ color: 'var(--lp-muted)' }}>{labels.call}</span>{c.contacts.phone}</span>
              </a>
            )}
            {c.contacts.email && (
              <a href={preview ? undefined : ctaHref('email', c.contacts.email)} className={`${card} flex items-center gap-3 break-all`} style={cardStyle}>
                <Mail className="h-5 w-5 shrink-0" style={{ color: 'var(--lp-accent)' }} />
                <span><span className="block text-sm" style={{ color: 'var(--lp-muted)' }}>{labels.email}</span>{c.contacts.email}</span>
              </a>
            )}
            {mapUrl && (
              <a
                href={preview ? undefined : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapUrl)}`}
                {...linkProps}
                className={`${card} flex items-center gap-3`}
                style={cardStyle}
              >
                <MapPin className="h-5 w-5 shrink-0" style={{ color: 'var(--lp-accent)' }} />
                <span><span className="block text-sm" style={{ color: 'var(--lp-muted)' }}>{labels.openMap}</span>{mapUrl}</span>
              </a>
            )}
          </div>
        </section>
      ) : null,
  }

  return (
    <div lang={lang} style={{ ...vars, background: 'var(--lp-bg)', color: 'var(--lp-text)' }} className="@container min-h-full">
      {/* Presentazione */}
      <header style={{ background: th.heroBg, color: th.heroText }}>
        <div className="mx-auto max-w-5xl px-5 pb-12 pt-8 @xl:px-8">
          <div className="mb-10 flex items-center gap-3">
            {c.hero.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={landingPhotoUrl(c.hero.logo)} alt="" className="h-11 w-11 rounded-xl object-cover" />
            )}
            <span className="text-lg font-bold">{c.hero.name}</span>
          </div>
          <div className={`grid items-center gap-8 ${c.hero.photo ? 'md:grid-cols-[1.2fr_1fr]' : ''}`}>
            <div>
              {c.hero.title && <h1 className="text-4xl font-bold leading-tight @xl:text-5xl">{c.hero.title}</h1>}
              {c.hero.subtitle && <p className="mt-4 text-xl font-medium" style={{ color: template === 'colore' ? th.heroText : 'var(--lp-accent)' }}>{c.hero.subtitle}</p>}
              {c.hero.text && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed" style={{ color: th.heroMuted }}>{c.hero.text}</p>}
              <div className="mt-7 flex flex-wrap gap-3">
                {cta && c.hero.ctaLabel && (
                  <a
                    href={preview ? undefined : cta}
                    {...(c.hero.ctaKind === 'link' || c.hero.ctaKind === 'whatsapp' ? linkProps : {})}
                    className="inline-flex items-center justify-center rounded-xl px-6 py-3.5 font-bold shadow-lg transition hover:brightness-110"
                    style={template === 'colore' ? { background: th.onAccent, color: th.accent } : { background: 'var(--lp-accent)', color: 'var(--lp-on-accent)' }}
                  >
                    {c.hero.ctaLabel}
                  </a>
                )}
                {showMenu && (
                  <a
                    href={preview ? undefined : menuUrl}
                    {...linkProps}
                    className="inline-flex items-center gap-2 rounded-xl border px-5 py-3.5 font-semibold"
                    style={{ borderColor: template === 'colore' ? th.heroText : 'var(--lp-accent)', color: template === 'colore' ? th.heroText : 'var(--lp-accent)' }}
                  >
                    <UtensilsCrossed className="h-5 w-5" /> {labels.seeMenu}
                  </a>
                )}
              </div>
            </div>
            {c.hero.photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={landingPhotoUrl(c.hero.photo)} alt={c.hero.name} className="aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl">{c.order.map((key) => sections[key])}</main>

      <footer className="border-t px-5 py-8 text-sm @xl:px-8" style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-muted)' }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          {socials.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {socials.map((k) => (
                <a key={k} href={preview ? undefined : c.social[k]} {...linkProps} className="rounded-full border px-3 py-1.5 font-semibold" style={{ borderColor: 'var(--lp-line)', color: 'var(--lp-text)' }}>
                  {SOCIAL_LABELS[k]}
                </a>
              ))}
            </div>
          )}
          <div>
            {(c.footer.businessName || c.hero.name) && <p className="font-semibold" style={{ color: 'var(--lp-text)' }}>{c.footer.businessName || c.hero.name}</p>}
            {c.footer.vat && <p>{labels.vat} {c.footer.vat}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs" style={{ borderColor: 'var(--lp-line)' }}>
            <span>
              {labels.madeWith}{' '}
              {createHref ? (
                <a href={preview ? undefined : createHref} className="font-semibold underline" style={{ color: 'var(--lp-accent)' }}>
                  {labels.createYours}
                </a>
              ) : null}
            </span>
            {reportSlot}
          </div>
        </div>
      </footer>
    </div>
  )
}
