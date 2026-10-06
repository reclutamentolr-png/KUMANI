import FidelityClaim from '@/components/fidelity/FidelityClaim'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

// Pagina aperta dal telefono del cliente quando inquadra il QR usa e getta
// della cassa. Il timbro si applica dal client (server action al mount) e
// non nel render: così anteprime link o prefetch non consumano il QR.
export default async function FidelityClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <FidelityClaim code={code} />
}
