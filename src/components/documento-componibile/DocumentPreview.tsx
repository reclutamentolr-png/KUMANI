'use client'

// Anteprima del foglio A4: le parti fisse in nero, quelle da compilare su
// fondo dorato (nel PDF diventano campi veri)
import { useTranslations } from 'next-intl'
import { ChevronDown } from 'lucide-react'
import { isField, type DocBlock, type DocContent } from '@/lib/documentoComponibile'

export default function DocumentPreview({ doc }: { doc: DocContent }) {
  const t = useTranslations('documentoComponibile')
  const { blocks } = doc
  const rows: DocBlock[][] = []
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    const next = blocks[i + 1]
    if (isField(b) && b.half && next && isField(next) && next.half) {
      rows.push([b, next])
      i++
    } else rows.push([b])
  }
  const hintOf = (b: DocBlock) => (b.type === 'date' ? b.hint || t('pdfDateHint') : b.hint)

  const field = (b: DocBlock) => (
    <div className="min-w-0 flex-1">
      <p className="mb-1 truncate text-[10px] font-bold text-gray-500">
        {b.label}
        {b.required && ' *'}
      </p>
      {b.type === 'checkbox' ? (
        <div className="flex items-start gap-2 whitespace-pre-wrap text-[11px] text-gray-800">
          <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border border-[#c8bda8] ${b.checked ? 'bg-[var(--gold)]' : 'bg-[#faf5e6]'}`} />
          <span className="min-w-0 break-words">{b.text}</span>
        </div>
      ) : b.type === 'select' ? (
        <div className="flex h-6 items-center justify-between gap-1 rounded-sm border border-[#c8bda8] bg-[#faf5e6] px-2 text-[11px] text-gray-800">
          <span className="truncate">{b.value || ''}</span> <ChevronDown className="h-3 w-3 shrink-0 text-gray-500" />
        </div>
      ) : (
        <div
          className="overflow-hidden whitespace-pre-wrap break-words rounded-sm border border-[#c8bda8] bg-[#faf5e6] px-2 py-1 text-[11px] text-gray-800"
          style={{ minHeight: b.type === 'textarea' ? (b.lines ?? 4) * 15 + 8 : 24 }}
        >
          {b.value}
        </div>
      )}
      {hintOf(b) && <p className="mt-0.5 truncate text-[8px] text-gray-400">{hintOf(b)}</p>}
    </div>
  )

  return (
    <div className="rounded-2xl bg-gray-300/50 p-3 sm:p-5">
      <div className="mx-auto flex aspect-[210/297] w-full max-w-[640px] flex-col bg-white px-[8%] pb-[4%] pt-[7%] shadow-xl">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {rows.length === 0 && <p className="pt-10 text-center text-xs text-gray-400">{t('previewEmpty')}</p>}
          {rows.map((row) => {
            const b = row[0]
            if (row.length === 2)
              return (
                <div key={b.id} className="flex gap-3">
                  {field(row[0])}
                  {field(row[1])}
                </div>
              )
            if (b.type === 'title')
              return (
                <div key={b.id}>
                  <h2 className="break-words text-xl font-bold text-gray-900">{b.text}</h2>
                  <span className="mt-1 block h-[3px] w-10 bg-[var(--gold)]" />
                </div>
              )
            if (b.type === 'heading')
              return (
                <h3 key={b.id} className="break-words pt-2 text-xs font-bold uppercase tracking-wide text-gray-900">
                  {b.text}
                </h3>
              )
            if (b.type === 'text')
              return (
                <p key={b.id} className="whitespace-pre-wrap break-words text-[11.5px] leading-5 text-gray-800">
                  {b.text}
                </p>
              )
            if (b.type === 'divider') return <hr key={b.id} className="border-[#c8bda8]" />
            if (b.type === 'image')
              return b.image ? (
                <div key={b.id} className={`flex ${b.align === 'center' ? 'justify-center' : b.align === 'right' ? 'justify-end' : ''}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.image} alt="" style={{ width: `${b.width ?? 40}%` }} />
                </div>
              ) : (
                <div key={b.id} className="rounded border border-dashed border-gray-300 p-3 text-center text-[10px] text-gray-400">
                  {t('type_image')}
                </div>
              )
            if (b.type === 'signature')
              return (
                <div key={b.id} className={`flex ${b.align === 'left' ? '' : 'justify-end'} pt-2`}>
                  <div className="w-[45%]">
                    <p className="truncate text-[10px] font-bold text-gray-500">{b.label || t('def_signature')}</p>
                    <div className="mt-9 border-b border-gray-800" />
                    {b.text && <p className="mt-1 truncate text-[9px] text-gray-500">{b.text}</p>}
                  </div>
                </div>
              )
            if (isField(b))
              return (
                <div key={b.id} className={b.half ? 'w-1/2 pr-1.5' : ''}>
                  {field(b)}
                </div>
              )
            return null
          })}
        </div>
        <p className="mt-2 truncate border-t border-gray-100 pt-1 text-[8px] text-gray-400">{doc.footer || doc.title}</p>
      </div>
      <p className="mt-3 text-center text-xs text-gray-600">{t('previewNote')}</p>
    </div>
  )
}
