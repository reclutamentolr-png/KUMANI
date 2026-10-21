import { CalendarClock, Car, FileLock2, KeyRound, LifeBuoy, MessageSquareWarning, Receipt, type LucideIcon } from 'lucide-react'

// Icone delle guide di KUMANI Risolvi (campo `icon` in src/lib/solve)
export const SOLVE_ICONS: Record<string, LucideIcon> = { MessageSquareWarning, KeyRound, FileLock2, Car, Receipt, CalendarClock }
export const solveIcon = (name: string): LucideIcon => SOLVE_ICONS[name] ?? LifeBuoy
