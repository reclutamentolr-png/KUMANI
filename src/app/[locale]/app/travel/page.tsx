import { localizedRedirect } from '@/lib/localizedRedirect'
import { toolMetadata } from '@/lib/toolMetadata'

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('travel')

// KUMANI Travel vive in /viaggi: anche /app/travel porta lì
export default async function TravelRedirect() {
  return localizedRedirect('/viaggi')
}
