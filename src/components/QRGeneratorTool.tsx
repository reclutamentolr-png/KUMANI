'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import QRCode from 'qrcode'
import { Download, MousePointerClick } from 'lucide-react'

type Props = {
  referralCode: string
  referralUrl: string
  userName: string
}

export default function QRGeneratorTool({ referralCode, referralUrl, userName }: Props) {
  const t = useTranslations('qrGenerator')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [fgColor, setFgColor] = useState('#171717')
  const [bgColor, setBgColor] = useState('#ffffff')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(referralUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: fgColor,
            light: bgColor
          },
          errorCorrectionLevel: 'H'
        })
        setQrDataUrl(url)
        setLoading(false)
      } catch (err) {
        console.error(err)
      }
    }
    generateQR()
  }, [referralUrl, fgColor, bgColor])

  const handleDownload = () => {
    const link = document.createElement('a')
    link.download = `QR-${referralCode}.png`
    link.href = qrDataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2">
        
        {/* COLONNA SINISTRA: Controlli */}
        <div className="p-6 sm:p-8 border-b md:border-b-0 md:border-r border-[var(--gold)]/20 bg-[var(--paper)]">
          <h3 className="text-lg font-bold text-[var(--ink)] mb-6">{t('customizeQR')}</h3>
          
          <div className="space-y-6">
            {/* Info Link */}
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-2">{t('targetLink')}</label>
              <div className="bg-white border border-[var(--gold)]/25 rounded-lg p-3 text-sm text-[var(--ink-soft)] font-mono break-all">
                {referralUrl}
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">
                {t('lockedLink')}
              </p>
            </div>

            {/* Colore QR */}
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-2">{t('qrColor')}</label>
              <div className="flex gap-3 items-center">
                <input 
                  type="color" 
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="h-10 w-14 rounded cursor-pointer border border-[var(--gold)]/30"
                />
                <input 
                  type="text" 
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--gold)]/30 bg-white p-2 text-sm font-mono uppercase shadow-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                />
              </div>
            </div>

            {/* Colore Sfondo */}
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-2">{t('bgColor')}</label>
              <div className="flex gap-3 items-center">
                <input 
                  type="color" 
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-14 rounded cursor-pointer border border-[var(--gold)]/30"
                />
                <input 
                  type="text" 
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--gold)]/30 bg-white p-2 text-sm font-mono uppercase shadow-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
                />
              </div>
            </div>

            {/* Colori Preimpostati */}
            <div>
              <label className="block text-sm font-semibold text-[var(--ink)] mb-2">{t('quickThemes')}</label>
              <div className="flex gap-2">
                <button onClick={() => { setFgColor('#171717'); setBgColor('#f5ecd9') }} className="w-8 h-8 rounded-full bg-[var(--ink)] border-2 border-[var(--gold)] shadow ring-1 ring-[var(--gold)]/30" aria-label="KUMANI"></button>
                <button onClick={() => { setFgColor('#4f46e5'); setBgColor('#ffffff') }} className="w-8 h-8 rounded-full bg-indigo-600 border-2 border-white shadow ring-1 ring-[var(--gold)]/30"></button>
                <button onClick={() => { setFgColor('#000000'); setBgColor('#ffffff') }} className="w-8 h-8 rounded-full bg-black border-2 border-white shadow ring-1 ring-[var(--gold)]/30"></button>
                <button onClick={() => { setFgColor('#ffffff'); setBgColor('#000000') }} className="w-8 h-8 rounded-full bg-white border-2 border-gray-300 shadow ring-1 ring-[var(--gold)]/30"></button>
                <button onClick={() => { setFgColor('#059669'); setBgColor('#ecfdf5') }} className="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow ring-1 ring-[var(--gold)]/30"></button>
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: Anteprima e Download */}
        <div className="p-6 sm:p-8 flex flex-col items-center justify-center bg-white">
          <h3 className="text-lg font-bold text-[var(--ink)] mb-6 w-full text-left">{t('preview')}</h3>
          
          <div className="relative group">
            {loading ? (
              <div className="w-64 h-64 bg-[var(--gold-pale)] rounded-xl flex items-center justify-center animate-pulse">
                <span className="text-[var(--muted)]">{t('generating')}</span>
              </div>
            ) : (
              <div className="p-4 bg-white rounded-xl shadow-sm border border-[var(--gold)]/25">
                <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
              </div>
            )}
          </div>

          <div className="mt-8 w-full max-w-xs space-y-3">
            <button 
              onClick={handleDownload}
              disabled={loading}
              className="w-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold py-3 px-4 rounded-lg hover:brightness-105 transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              {t('downloadPNG')}
            </button>
            
            <div className="text-center">
              <p className="text-xs text-[var(--muted)]">
                {t('generatedFor')} <span className="font-semibold text-[var(--ink)]">{userName}</span>
              </p>
              <p className="text-xs font-mono text-[var(--gold)] mt-1">{referralCode}</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
