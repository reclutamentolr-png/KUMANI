'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'

// Campo password con l'occhio per vedere cosa si è scritto: sul telefono un
// errore di battitura alla registrazione vuol dire non riuscire più a entrare.
// Va dentro un contenitore `relative` (come gli altri campi con l'icona).
export default function PasswordInput({ className = '', ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const t = useTranslations('passwordChange')
  const [show, setShow] = useState(false)
  return (
    <>
      <input {...props} type={show ? 'text' : 'password'} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t('hide') : t('show')}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 hover:text-[var(--ink)]"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </>
  )
}
