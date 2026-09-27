'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { getIncompleteProfile } from '@/app/actions/profileReminder'
import {
  FORM_PROFILE_FIELDS,
  REQUIRED_PROFILE_FIELDS,
  isProfileLockedError,
  missingProfileFields,
  toProfileFormValues,
  type FormProfileField,
  type LockableProfileField,
} from '@/lib/profileFields'

const REQUIRED = new Set<string>(REQUIRED_PROFILE_FIELDS)

// Completamento del profilo: tutti i dati obbligatori, poi conferma
// ("dopo il salvataggio non potrai più modificarli"), poi salvataggio.
// Niente salvataggi parziali: se manca qualcosa si mostra l'elenco.
export function useProfileCompletion(initialData: Record<string, unknown> | null | undefined, userId: string, onSaved?: () => void) {
  const lockT = useTranslations('profileLock')
  const router = useRouter()
  const [values, setValues] = useState(() => toProfileFormValues(initialData))
  const [missing, setMissing] = useState<LockableProfileField[]>([])
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Campi mancanti ancora vuoti (spariscono dall'elenco mentre si compilano).
  const stillMissing = missing.filter((field) => missingProfileFields(values).includes(field))

  const setField = (field: FormProfileField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setConfirming(false)
  }

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)
    const nowMissing = missingProfileFields(values)
    setMissing(nowMissing)
    setConfirming(nowMissing.length === 0)
  }

  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, string | null> = {}
      for (const field of FORM_PROFILE_FIELDS) {
        const value = values[field].trim()
        payload[field] = value || (REQUIRED.has(field) ? '' : null)
      }
      const { error: updateError } = await createClient().from('profiles').update(payload).eq('id', userId)
      if (updateError) {
        setConfirming(false)
        setError(isProfileLockedError(updateError) ? lockT('lockedError') : updateError.message || lockT('errGeneric'))
        return
      }
      // Controllo dal server: il profilo risulta davvero completo?
      const check = await getIncompleteProfile().catch(() => null)
      if (check?.status === 'incomplete') {
        setConfirming(false)
        setMissing(check.missing)
        // Dati non accettati dal server ma pieni nel form: messaggio generico.
        if (!check.missing.some((field) => missingProfileFields(values).includes(field))) setError(lockT('requiredTitle'))
        return
      }
      setSaved(true)
      setConfirming(false)
      onSaved?.()
      router.refresh()
    } catch {
      setConfirming(false)
      setError(lockT('errGeneric'))
    } finally {
      setSaving(false)
    }
  }

  return {
    values,
    setField,
    missing: stillMissing,
    confirming,
    cancelConfirm: () => setConfirming(false),
    saving,
    error,
    saved,
    submit,
    confirm,
  }
}
