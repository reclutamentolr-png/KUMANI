// Dati anagrafici del profilo: stessa regola del database
// (profile_fields_complete / profiles_guard_privileged_columns).
// Usato sia dal server (promemoria) sia dai form del profilo.

// Campi che, a profilo completato, l'utente non può più cambiare da solo.
export const LOCKABLE_PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'gender',
  'phone',
  'country_code',
  'city',
  'province',
  'address',
  'postal_code',
  'occupation',
] as const

export type LockableProfileField = (typeof LOCKABLE_PROFILE_FIELDS)[number]

// Campi obbligatori per considerare il profilo completo (solo il genere è
// facoltativo). Stessa regola di profile_fields_complete nel database.
export const REQUIRED_PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'phone',
  'country_code',
  'city',
  'province',
  'postal_code',
  'address',
  'occupation',
] as const satisfies readonly LockableProfileField[]

// Campi mostrati nei form (il genere non ha ancora un campo nell'interfaccia).
export const FORM_PROFILE_FIELDS = [
  'first_name',
  'last_name',
  'phone',
  'date_of_birth',
  'occupation',
  'country_code',
  'address',
  'city',
  'province',
  'postal_code',
] as const satisfies readonly LockableProfileField[]

export type FormProfileField = (typeof FORM_PROFILE_FIELDS)[number]
export type ProfileFormValues = Record<FormProfileField, string>

// Data di nascita provvisoria messa alla registrazione.
export const PLACEHOLDER_BIRTH_DATE = '2000-01-01'

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function toProfileFormValues(profile: Record<string, unknown> | null | undefined): ProfileFormValues {
  const values = {} as ProfileFormValues
  for (const field of FORM_PROFILE_FIELDS) values[field] = text(profile?.[field])
  if (values.date_of_birth === PLACEHOLDER_BIRTH_DATE) values.date_of_birth = ''
  return values
}

// Campi obbligatori ancora vuoti (la data provvisoria conta come vuota).
export function missingProfileFields(profile: Record<string, unknown> | null | undefined): LockableProfileField[] {
  return REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = text(profile?.[field]).trim()
    if (!value) return true
    return field === 'date_of_birth' && value === PLACEHOLDER_BIRTH_DATE
  })
}

// Errore del database quando si prova a cambiare un dato bloccato.
export function isProfileLockedError(error: unknown): boolean {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: unknown }).message) : String(error ?? '')
  return message.includes('profile_locked')
}

// Etichette: chiave nel namespace "dashboard" oppure "profileLock".
export const PROFILE_FIELD_LABELS: Record<LockableProfileField, { ns: 'dashboard' | 'profileLock'; key: string }> = {
  first_name: { ns: 'dashboard', key: 'firstName' },
  last_name: { ns: 'dashboard', key: 'lastName' },
  date_of_birth: { ns: 'dashboard', key: 'dateOfBirth' },
  gender: { ns: 'profileLock', key: 'gender' },
  phone: { ns: 'dashboard', key: 'phone' },
  country_code: { ns: 'dashboard', key: 'country' },
  city: { ns: 'dashboard', key: 'city' },
  province: { ns: 'dashboard', key: 'province' },
  address: { ns: 'dashboard', key: 'address' },
  postal_code: { ns: 'profileLock', key: 'postalCode' },
  occupation: { ns: 'dashboard', key: 'occupation' },
}
