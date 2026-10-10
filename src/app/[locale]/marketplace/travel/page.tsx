import { localizedRedirect } from '@/lib/localizedRedirect'

// KUMANI Travel vive in /viaggi: anche /marketplace/travel porta lì
export default async function TravelRedirect() {
  return localizedRedirect('/viaggi')
}
