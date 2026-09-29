import HomeToolsGrid from '@/components/HomeToolsGrid'
import { getFreeToolNames } from '@/lib/freeTools'
import { HOME_TOOL_NAMES } from '@/lib/homeToolNames'

// Griglia pubblica dei servizi con i gratuiti per primi in ogni categoria:
// legge dal server quali sono gratuiti (decisi dall'Admin) e li passa alla
// griglia, che gira nel browser.
export default async function HomeToolsGridServer() {
  const freeToolNames = await getFreeToolNames(HOME_TOOL_NAMES)
  return <HomeToolsGrid freeToolNames={freeToolNames} />
}
