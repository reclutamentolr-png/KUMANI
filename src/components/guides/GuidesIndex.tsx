'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowRight, BookOpen, Briefcase, Clock, Crown, Footprints, FolderOpen, Megaphone, Leaf, ShieldCheck, Sparkles, Users, Wallet, Wrench } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/client'
import type { GuideCategory } from '@/lib/guides/types'

// Centro guide (src/app/[locale]/guida). La pagina è uguale per tutti e
// tenuta in memoria: arriva pronta per chi non ha fatto l'accesso (solo le
// guide pubbliche, registrazione e accesso). Se nel browser c'è una sessione,
// qui si mostrano anche le guide per gli iscritti, il tour e i Documenti.
// Le guide per gli iscritti restano comunque protette nella loro pagina.

export type GuideCard = {
  slug: string
  category: GuideCategory
  title: string
  summary: string
  minutes: number
  steps: number
  isPublic: boolean
}

type Props = {
  guides: GuideCard[]
  categories: Record<GuideCategory, { title: string; text: string }>
  order: GuideCategory[]
  docsLink: { title: string; text: string }
}

const CATEGORY_ICONS: Record<GuideCategory, typeof Wallet> = {
  start: Footprints,
  promote: Megaphone,
  wallet: Wallet,
  promoteTools: Wrench,
  security: ShieldCheck,
  community: Users,
  organize: Briefcase,
  pro: Crown,
  wellness: Leaf,
}

export default function GuidesIndex({ guides: allGuides, categories, order, docsLink }: Props) {
  const t = useTranslations('guides')
  const [member, setMember] = useState(false)

  useEffect(() => {
    let alive = true
    // Sessione letta in locale (cookie del browser), senza chiamate
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (alive) setMember(!!data.session)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const guides = member ? allGuides : allGuides.filter((guide) => guide.isPublic)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          {/* Chi ha fatto l'accesso torna alla dashboard, gli altri alla home */}
          <Link href={member ? '/dashboard' : '/'} className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {member ? t('backToDashboard') : t('backToHome')}
          </Link>
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <BookOpen className="h-5 w-5 text-[var(--gold-bright)]" /> {t('linkLabel')}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="relative mb-10 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <Sparkles className="h-4 w-4" /> {t('eyebrow')}
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{t('title')}</h1>
            <p className="mt-3 max-w-2xl text-white/75">{t('subtitle')}</p>
          </div>
        </section>

        {member && (
          <Link
            href="/dashboard?tour=1"
            className="mb-10 flex items-center gap-3 rounded-2xl border border-[var(--gold)]/40 bg-white px-5 py-4 shadow-sm transition hover:border-[var(--gold)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-[var(--ink)]">{t('tourTitle')}</span>
              <span className="block text-sm text-[var(--muted)]">{t('tourText')}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--gold)]" />
          </Link>
        )}

        <div className="space-y-10">
          {order.map((category) => {
            const Icon = CATEGORY_ICONS[category]
            const list = guides.filter((guide) => guide.category === category)
            if (list.length === 0) return null
            return (
              <section key={category}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ink)]">{categories[category].title}</h2>
                    <p className="text-sm text-[var(--muted)]">{categories[category].text}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {list.map((guide) => (
                    <Link
                      key={guide.slug}
                      href={`/guida/${guide.slug}`}
                      className="group flex flex-col rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] hover:shadow-md"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-lg font-bold text-[var(--ink)]">{guide.title}</span>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--gold)] transition-transform group-hover:translate-x-1" />
                      </span>
                      <span className="mt-1 text-sm leading-6 text-[var(--muted)]">{guide.summary}</span>
                      <span className="mt-3 flex items-center gap-3 text-xs font-semibold text-[var(--gold)]">
                        <span>{t('steps', { count: guide.steps })}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {t('minutes', { count: guide.minutes })}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {member ? (
          <>
            <Link
              href="/documenti"
              className="group mt-10 flex items-center justify-between gap-4 rounded-2xl border border-[var(--gold)]/40 bg-white px-5 py-4 shadow-sm transition hover:border-[var(--gold)]"
            >
              <span className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                  <FolderOpen className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-bold text-[var(--ink)]">{docsLink.title}</span>
                  <span className="block text-sm text-[var(--muted)]">{docsLink.text}</span>
                </span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-[var(--gold)] transition-transform group-hover:translate-x-1" />
            </Link>
            <p className="mt-4 rounded-2xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)] px-5 py-4 text-sm text-[var(--ink)]">
              {t('comingSoon')}
            </p>
          </>
        ) : (
          <div className="mt-10 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-5 py-5 text-[var(--ink)]">
            <p className="font-bold">{t('membersTitle')}</p>
            <p className="mt-1 text-sm text-[var(--ink)]/75">{t('membersText')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm transition hover:brightness-105"
              >
                {t('membersRegister')}
              </Link>
              <Link
                href="/login?next=%2Fguida"
                className="rounded-xl border border-[var(--ink)]/20 bg-white px-5 py-2.5 text-sm font-bold text-[var(--ink)] transition hover:border-[var(--gold)]"
              >
                {t('membersLogin')}
              </Link>
            </div>
          </div>
        )}
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          {t('help')}{' '}
          <Link href="/contact" className="font-semibold text-[var(--gold)] hover:underline">
            {t('contact')}
          </Link>
        </p>
      </main>
    </div>
  )
}
