import MaintenanceGate from '@/components/MaintenanceGate'
import ProfileReminder from '@/components/ProfileReminder'
import ImpersonationBanner from '@/components/ImpersonationBanner'

// Questo layout applica SOLO il MaintenanceGate ai children del locale
// I tag <html> e <body> sono gestiti dal layout root (src/app/layout.tsx)
// I meta PWA (manifest, icone, theme-color) sono gestiti dal metadata del layout root
export default function LocaleLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <MaintenanceGate>
      {/* Fascia "stai impersonando": in cima a ogni pagina, solo per lo Staff */}
      <ImpersonationBanner />
      {children}
      {/* Popup "completa il profilo" dopo 15 minuti sulla piattaforma */}
      <ProfileReminder />
    </MaintenanceGate>
  )
}