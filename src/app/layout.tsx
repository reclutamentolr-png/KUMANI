// Layout di partenza "passante": <html> e <body> li scrive il layout della
// lingua (src/app/[locale]/layout.tsx, con la lingua presa dall'indirizzo e
// non dalla richiesta, così le pagine pubbliche possono essere preparate in
// anticipo e tenute in memoria) e, fuori dalle lingue, src/app/billing/layout.tsx.
// Qui niente impostazioni di pagina (dynamic, revalidate): ogni pagina che
// mostra dati personali o che cambiano le dichiara da sé.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
