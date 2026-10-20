'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import VoucherPrintCard, { formatPx, type VoucherDesign, type VoucherPrintTexts } from '@/components/voucherPrint/VoucherPrintCard'

// Il fronte del voucher (la stessa grafica della stampa) rimpicciolito alla
// larghezza disponibile: per l'anteprima e per la pagina del biglietto.
const ScaledVoucherFront = forwardRef<HTMLDivElement, { design: VoucherDesign; plan: 'base' | 'pro'; texts: VoucherPrintTexts; className?: string }>(
  function ScaledVoucherFront({ design, plan, texts, className = '' }, cardRef) {
    const box = useRef<HTMLDivElement>(null)
    const px = formatPx('card')
    const [scale, setScale] = useState(0)
    useEffect(() => {
      const el = box.current
      if (!el) return
      const update = () => setScale(el.clientWidth / px.fullW)
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [px.fullW])
    return (
      <div ref={box} className={`relative w-full overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.45)] ${className}`} style={{ aspectRatio: `${px.fullW} / ${px.fullH}` }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
          <VoucherPrintCard ref={cardRef} design={design} format="card" side="front" plan={plan} phrase="" code="" qrSvg="" texts={texts} />
        </div>
      </div>
    )
  }
)

export default ScaledVoucherFront
