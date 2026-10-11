import { localizedRedirect } from '@/lib/localizedRedirect'
import { toolMetadata } from '@/lib/toolMetadata'

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('travel')

// KUMANI Travel vive in /viaggi: anche /marketplace/travel porta lì
export default async function TravelRedirect() {
  return localizedRedirect('/viaggi')
}
