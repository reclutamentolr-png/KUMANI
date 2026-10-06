'use client'

import { useEffect, useSyncExternalStore } from 'react'
import SignatureEditor, { type Prefill } from '@/components/firmaEmail/SignatureEditor'
import { DRAFT_KEY } from '@/components/firmaEmail/draft'
import type { BusinessProfile } from '@/lib/businessProfile'

// La bozza si legge da localStorage una sola volta per visita della pagina:
// sul server (e al primo render di idratazione) non c'è, poi l'editor
// viene rimontato con la bozza salvata. La cache si azzera all'uscita, così
// tornando sulla pagina si rilegge l'ultima versione.
let draftCache: string | null | undefined

function readDraftOnce(): string | null {
  if (draftCache === undefined) {
    try {
      draftCache = window.localStorage.getItem(DRAFT_KEY)
    } catch {
      draftCache = null
    }
  }
  return draftCache
}

const subscribe = () => () => {}
const serverSnapshot = () => null

export default function SignatureBuilder({
  prefill,
  cardUrl,
  business,
}: {
  prefill: Prefill
  cardUrl: string | null
  business: BusinessProfile | null
}) {
  const rawDraft = useSyncExternalStore(subscribe, readDraftOnce, serverSnapshot)

  useEffect(
    () => () => {
      draftCache = undefined
    },
    [],
  )

  return <SignatureEditor key={rawDraft ? 'draft' : 'fresh'} prefill={prefill} cardUrl={cardUrl} rawDraft={rawDraft} business={business} />
}
