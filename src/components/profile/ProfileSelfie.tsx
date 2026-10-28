'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, ScanFace } from 'lucide-react'
import { uploadProfilePhoto } from '@/app/actions/profilePhoto'
import SmartCamera, { type FaceBox } from '@/components/fototessera/SmartCamera'

// Selfie guidato per la foto profilo (Profilo e Link in Bio): la fotocamera
// controlla dal vivo distanza, centro, testa dritta, occhi aperti e luce (il
// sorriso va bene), scatta da sola e ritaglia un quadrato centrato sul viso,
// con testa e spalle. Poi la foto si carica come quella scelta dalla galleria.

const SIDE = 512

async function faceSquare(file: File, face: FaceBox | null): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const W = bitmap.width
  const H = bitmap.height
  // Senza viso (scatto a mano senza nessuno): quadrato al centro come prima
  let side = Math.min(W, H)
  let x = (W - side) / 2
  let y = (H - side) / 2
  if (face) {
    side = Math.min(W, H, face.len * 2.8)
    x = Math.min(W - side, Math.max(0, face.cx - side / 2))
    y = Math.min(H - side, Math.max(0, face.cy - side * 0.46))
  }
  const size = Math.min(SIDE, Math.round(side))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, x, y, side, side, 0, 0, size, size)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('photo'))), 'image/jpeg', 0.88))
}

export default function ProfileSelfie({ onDone, className }: { onDone: (path: string) => void; className?: string }) {
  const t = useTranslations('profilePhoto')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const save = async (file: File, face: FaceBox | null) => {
    setOpen(false)
    setBusy(true)
    setError(false)
    try {
      const form = new FormData()
      form.append('file', new File([await faceSquare(file, face)], 'foto.jpg', { type: 'image/jpeg' }))
      const result = await uploadProfilePhoto(form)
      if (result.success) onDone(result.path)
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {open && <SmartCamera kind="profile" onClose={() => setOpen(false)} onPhoto={(file, face) => void save(file, face)} />}
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen(true)}
        className={className ?? 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--gold)]/50 px-3 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--gold)]/10 disabled:opacity-50'}
      >
        {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <ScanFace className="h-3.5 w-3.5" />} {t('selfie')}
      </button>
      {error && <span className="text-xs font-semibold text-red-600">{t('error')}</span>}
    </>
  )
}
