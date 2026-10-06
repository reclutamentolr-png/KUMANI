// Dati della presentazione condivisi tra il server (getDeckTexts) e il
// browser (buildDeck)

// Lite = presentazione breve; Full = in più tutti i servizi, uno per uno
export type DeckVariant = 'lite' | 'full'
export type DeckPlan = 'free' | 'base' | 'pro'

export type DeckCatalogItem = { name: string; description: string; plan: DeckPlan; iconName: string }

// Un gruppo di servizi (stessi gruppi della pagina Servizi, più la Community)
export type DeckCatalogGroup = {
  key: string
  label: string
  // "7 servizi" (plurale della lingua)
  count: string
  sub: string
  notes: string
  items: DeckCatalogItem[]
}
