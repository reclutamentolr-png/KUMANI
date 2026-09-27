'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LoaderCircle, LogIn, Plus } from 'lucide-react'
import { createVeritasRoom } from '@/app/actions/veritas'
import { MENU_LOCALE_NAMES, MENU_LOCALES } from '@/lib/menu'
import { isRoomCode, saveVeritasSeat } from '@/lib/veritas'

// Veritas nel Marketplace: crea una stanza (lingua delle domande, numero di
// turni) oppure entra con il codice ricevuto da un amico.
export default function VeritasHome({ defaultNickname }: { defaultNickname: string }) {
  const t = useTranslations('veritas')
  const locale = useLocale()
  const router = useRouter()
  const [nickname, setNickname] = useState(defaultNickname)
  const [language, setLanguage] = useState((MENU_LOCALES as readonly string[]).includes(locale) ? locale : 'it')
  const [rounds, setRounds] = useState(5)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setBusy(true)
    setError(null)
    const result = await createVeritasRoom(nickname, language, rounds)
    if (!result.success) {
      setBusy(false)
      setError(t('error_error'))
      return
    }
    saveVeritasSeat(result.code, { room_id: result.room_id, token: result.token })
    router.push(`/${locale}/veritas/${result.code}`)
  }

  const input = 'w-full rounded-xl border border-gray-300 px-4 py-3 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <Plus className="h-5 w-5 text-[var(--gold)]" /> {t('createTitle')}
        </h2>
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700">{t('yourNickname')}</label>
          <input className={input} value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">{t('questionsLanguage')}</label>
            <select className={input} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {MENU_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {MENU_LOCALE_NAMES[l]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">{t('rounds')}</label>
            <select className={input} value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {[3, 5, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-sm font-semibold text-amber-700">{error}</p>}
        <button
          type="button"
          onClick={create}
          disabled={busy || !nickname.trim()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" />} {t('createButton')}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (isRoomCode(code)) router.push(`/${locale}/veritas/${code.toUpperCase()}`)
        }}
        className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm"
      >
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <LogIn className="h-5 w-5 text-[var(--gold)]" /> {t('joinWithCode')}
        </h2>
        <input
          className={`${input} text-center font-mono text-2xl uppercase tracking-[0.3em]`}
          value={code}
          maxLength={6}
          placeholder="ABC123"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        />
        <button
          type="submit"
          disabled={!isRoomCode(code)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3.5 font-bold text-white disabled:opacity-50"
        >
          {t('joinButton')}
        </button>
      </form>
    </div>
  )
}
