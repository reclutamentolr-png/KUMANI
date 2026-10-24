import { KIDS_LOCK_COOKIE } from './lock'
import type { ChildGender } from './catalog'

// Angolo Bambini: tutto resta nel telefono (localStorage, per account). Nome,
// età e disegni dei bambini non vanno mai al server di KUMANI.

export type CurrentDrawing = { drawingId: string; fills: Record<string, string>; awake: boolean; mission?: { part: string; color: string } | null }

export type KidProfile = {
  id: string
  name: string
  gender: ChildGender
  age: number
  color: string
  stars: number
  done: string[]
  recent: string[]
  current: CurrentDrawing | null
}

export type KidsStore = {
  v: 1
  pin: { salt: string; hash: string } | null
  profiles: KidProfile[]
  activeId: string | null
  sound: boolean
  voice: boolean
}

const keyFor = (userId: string) => `kumani-kids-v1:${userId}`

export const emptyStore = (): KidsStore => ({ v: 1, pin: null, profiles: [], activeId: null, sound: true, voice: true })

export function loadStore(userId: string): KidsStore {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as Partial<KidsStore>
    return { ...emptyStore(), ...parsed, v: 1, profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [] }
  } catch {
    return emptyStore()
  }
}

export function saveStore(userId: string, store: KidsStore) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(store))
  } catch {
    // memoria del browser piena o bloccata: si gioca lo stesso
  }
}

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function hashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`kumani-kids:${salt}:${pin}`)
  return hex(await crypto.subtle.digest('SHA-256', data))
}

export async function makePin(pin: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  return { salt, hash: await hashPin(pin, salt) }
}

export async function checkPin(store: KidsStore, pin: string) {
  if (!store.pin) return false
  return (await hashPin(pin, store.pin.salt)) === store.pin.hash
}

export function setKidsLock(userId: string) {
  document.cookie = `${KIDS_LOCK_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=31536000; samesite=lax`
}

export function clearKidsLock() {
  document.cookie = `${KIDS_LOCK_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

// Colori dell'avatar (cerchio con l'iniziale)
export const AVATAR_COLORS = ['#FF8A5B', '#5DB14E', '#4EA8DE', '#B07CE0', '#F2B33D', '#EF6F9A']
