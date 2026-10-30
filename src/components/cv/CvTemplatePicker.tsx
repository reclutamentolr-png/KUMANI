'use client'

import { useTranslations } from 'next-intl'
import { CV_TEMPLATES, type CvTemplate } from '@/lib/cv'
import { Check } from 'lucide-react'

const PREVIEW_SHAPE: Record<CvTemplate, React.ReactNode> = {
  moderno: (
    <div className="w-full h-full p-2">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5 border-l-2 border-gray-800 pl-1">
          <div className="h-1.5 w-10 bg-gray-800 rounded" />
          <div className="h-1 w-7 bg-gray-300 rounded" />
        </div>
        <div className="h-5 w-5 rounded-full bg-gray-300" />
      </div>
      <div className="mt-2 flex gap-1.5">
        <div className="w-1/3 space-y-1">
          <div className="h-0.5 w-full bg-gray-400" />
          <div className="h-1 w-full bg-gray-100 rounded" />
          <div className="h-1 w-2/3 bg-gray-100 rounded" />
        </div>
        <div className="flex-1 border-l border-gray-300 pl-1.5 space-y-1">
          <div className="h-1 w-full bg-gray-200 rounded" />
          <div className="h-1 w-5/6 bg-gray-100 rounded" />
          <div className="h-1 w-full bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  ),
  professionale: (
    <div className="w-full h-full flex">
      <div className="w-[38%] h-full bg-[#0f2a4a] p-1.5 space-y-1">
        <div className="h-4 w-4 rounded-full bg-white/40" />
        <div className="h-1 w-full bg-white/70 rounded" />
        <div className="h-1 w-2/3 bg-sky-300/70 rounded" />
      </div>
      <div className="flex-1 p-1.5 space-y-1">
        <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-sky-200" /><div className="h-1 flex-1 bg-sky-100" /></div>
        <div className="h-1 w-full bg-gray-100 rounded" />
        <div className="ml-1 border-l border-sky-200 pl-1 space-y-1">
          <div className="h-1 w-5/6 bg-[#0f2a4a]/40 rounded" />
          <div className="h-1 w-2/3 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  ),
  elegante: (
    <div className="w-full h-full p-2 bg-[#fbfbfa]">
      <div className="h-0.5 w-6 bg-gray-300 rounded" />
      <div className="mt-0.5 h-2.5 w-2/3 bg-gray-500 rounded-sm" />
      <div className="mt-1.5 h-px w-full bg-gray-300" />
      <div className="mt-1.5 flex gap-1.5">
        <div className="w-1/3 space-y-1 border-r border-gray-300 pr-1">
          <div className="h-1 w-full bg-gray-200 rounded" />
          <div className="h-1 w-2/3 bg-gray-200 rounded" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="h-1 w-full bg-gray-200 rounded" />
          <div className="h-1 w-5/6 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  ),
  europeo: (
    <div className="w-full h-full p-2">
      <div className="h-1.5 w-1/2 bg-gray-700 rounded" />
      <div className="mt-1 h-0.5 w-full bg-[#1d4f91]" />
      {[0, 1, 2].map((n) => (
        <div key={n} className="mt-1.5 flex gap-1.5">
          <div className="w-1/4 h-1 bg-gray-200 rounded" />
          <div className="flex-1 h-1 bg-gray-100 rounded" />
        </div>
      ))}
      <div className="mt-1.5 h-2 w-full bg-[#1d4f91]/25 rounded-sm" />
    </div>
  ),
  minimal: (
    <div className="w-full h-full p-2 space-y-1">
      <div className="h-2 w-2/3 bg-gray-300 rounded" />
      <div className="h-1.5 w-1/3 bg-[var(--gold)]/60 rounded" />
      <div className="h-1 w-full bg-gray-100 rounded mt-2" />
      <div className="h-1 w-full bg-gray-100 rounded" />
      <div className="h-1 w-2/3 bg-gray-100 rounded" />
    </div>
  ),
  classic: (
    <div className="w-full h-full p-2 flex flex-col items-center space-y-1">
      <div className="h-2 w-1/2 bg-gray-300 rounded" />
      <div className="h-1.5 w-1/3 bg-[var(--gold)]/60 rounded" />
      <div className="h-px w-1/3 bg-[var(--gold)] my-1" />
      <div className="h-1 w-full bg-gray-100 rounded" />
      <div className="h-1 w-2/3 bg-gray-100 rounded" />
    </div>
  ),
  sidebar: (
    <div className="w-full h-full flex">
      <div className="w-1/3 h-full bg-[var(--ink)]" />
      <div className="flex-1 p-2 space-y-1">
        <div className="h-2 w-2/3 bg-gray-300 rounded" />
        <div className="h-1 w-full bg-gray-100 rounded mt-2" />
        <div className="h-1 w-2/3 bg-gray-100 rounded" />
      </div>
    </div>
  ),
}

export default function CvTemplatePicker({ value, onChange }: { value: CvTemplate; onChange: (t: CvTemplate) => void }) {
  const t = useTranslations('kumaniCv')

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {CV_TEMPLATES.map((template) => (
        <button
          key={template}
          type="button"
          onClick={() => onChange(template)}
          className={`relative rounded-xl border-2 overflow-hidden transition-all ${
            value === template ? 'border-[var(--gold)]' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="h-20 bg-white">{PREVIEW_SHAPE[template]}</div>
          <div className={`px-2 py-1.5 text-xs font-medium text-center ${value === template ? 'bg-[var(--gold-pale)] text-[var(--ink)]' : 'bg-gray-50 text-gray-600'}`}>
            {t(`template_${template}`)}
          </div>
          {value === template && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[var(--gold)] flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" />
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
