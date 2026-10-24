'use client'

import { KUMI_CSS, KUMI_MARKUP } from '@/lib/kids/kumi'

export type KumiMood = 'happy' | 'o' | 'w' | 'wink'
export type KumiMove = 'idle' | 'wave' | 'dance' | 'jump' | 'sleep'

// KUMI, la guida dell'Angolo Bambini: solo disegno e CSS, niente IA. Lo stile
// è uno solo anche con più KUMI nella pagina (React lo mette nell'<head> una volta).
export default function Kumi({ mood = 'happy', move = 'idle', deco = false, label, className = '' }: { mood?: KumiMood; move?: KumiMove; deco?: boolean; label?: string; className?: string }) {
  return (
    <>
      <style href="kumani-kumi" precedence="default">
        {KUMI_CSS}
      </style>
      <svg
        viewBox="0 0 400 440"
        className={`kumi-svg e-${mood} ${move === 'idle' ? '' : `m-${move}`} ${deco ? '' : 'no-deco'} ${className}`}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        dangerouslySetInnerHTML={{ __html: KUMI_MARKUP }}
      />
    </>
  )
}
