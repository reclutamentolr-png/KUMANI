// Dati strutturati per Google (schema.org): aiutano a mostrare risultati più
// ricchi (eventi con data, guide passo passo, scheda dell'app…).
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  // "<" scritto come <: il contenuto non può chiudere il tag script
  const json = JSON.stringify(data).replace(/</g, '\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
