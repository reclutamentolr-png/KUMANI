'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ChildGender } from '@/lib/kids/catalog'

// Scheda del bambino (la compila il genitore): nome, bambino o bambina, età.
// Resta solo nel telefono.
export default function ProfileForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial?: { name: string; gender: ChildGender; age: number }
  onSave: (value: { name: string; gender: ChildGender; age: number }) => void
  onCancel?: () => void
  onDelete?: () => void
}) {
  const t = useTranslations('kids')
  const [name, setName] = useState(initial?.name ?? '')
  const [gender, setGender] = useState<ChildGender | null>(initial?.gender ?? null)
  const [age, setAge] = useState<number | null>(initial?.age ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const clean = name.replace(/\s+/g, ' ').trim()
  const ready = clean.length > 0 && !!gender && !!age

  const choice = (active: boolean) =>
    `min-h-14 rounded-2xl border-[3px] border-[#2B2D52] px-3 text-lg font-extrabold transition ${active ? 'bg-[#FFC93C] text-[#2B2D52] shadow-[3px_3px_0_#2B2D52]' : 'bg-white text-[#2B2D52]'}`

  return (
    <form
      className="mx-auto grid w-full max-w-md gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) onSave({ name: clean, gender: gender!, age: age! })
      }}
    >
      <div className="grid gap-2">
        <label htmlFor="kid-name" className="text-sm font-extrabold uppercase tracking-wide text-[#61648A]">{t('formName')}</label>
        <input
          id="kid-name"
          value={name}
          maxLength={20}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          placeholder={t('formNamePlaceholder')}
          className="min-h-14 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-4 text-xl font-bold text-[#2B2D52] outline-none focus:ring-4 focus:ring-[#FFC93C]"
        />
        <p className="text-xs text-[#61648A]">{t('formNameHint')}</p>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-extrabold uppercase tracking-wide text-[#61648A]">{t('formGender')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={choice(gender === 'boy')} aria-pressed={gender === 'boy'} onClick={() => setGender('boy')}>
            {t('boy')}
          </button>
          <button type="button" className={choice(gender === 'girl')} aria-pressed={gender === 'girl'} onClick={() => setGender('girl')}>
            {t('girl')}
          </button>
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-sm font-extrabold uppercase tracking-wide text-[#61648A]">{t('formAge')}</p>
        <div className="grid grid-cols-6 gap-2">
          {[3, 4, 5, 6, 7, 8].map((a) => (
            <button key={a} type="button" className={choice(age === a)} aria-pressed={age === a} onClick={() => setAge(a)}>
              {a}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#61648A]">{t('formAgeHint')}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="min-h-12 rounded-2xl px-4 font-bold text-[#61648A]">
            {t('cancel')}
          </button>
        )}
        <button type="submit" disabled={!ready} className="min-h-12 rounded-2xl border-[3px] border-[#2B2D52] bg-[#FF6A3D] px-6 text-lg font-extrabold text-white shadow-[3px_3px_0_#2B2D52] disabled:opacity-40">
          {t('formSave')}
        </button>
      </div>
      {onDelete &&
        (confirmDelete ? (
          <div className="grid gap-2 rounded-2xl border-2 border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-bold">{t('deleteConfirm', { name: clean || initial?.name || '' })}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-xl px-3 py-2 font-bold">
                {t('cancel')}
              </button>
              <button type="button" onClick={onDelete} className="rounded-xl bg-red-600 px-3 py-2 font-bold text-white">
                {t('deleteChild')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="justify-self-start text-sm font-bold text-red-700 underline">
            {t('deleteChild')}
          </button>
        ))}
    </form>
  )
}
