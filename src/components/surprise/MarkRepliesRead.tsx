'use client'

import { useEffect } from 'react'
import { markSurpriseRepliesRead } from '@/app/actions/surprise'

// Aprendo la sorpresa i ringraziamenti diventano letti: dal browser, quando
// la pagina si vede davvero (non quando il server la prepara in anticipo)
export default function MarkRepliesRead({ giftId }: { giftId: string }) {
  useEffect(() => {
    markSurpriseRepliesRead(giftId).catch(() => {})
  }, [giftId])
  return null
}
