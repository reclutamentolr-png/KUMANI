'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Send, MessageSquare } from 'lucide-react'

type Template = {
  id: number
  title: string
  tone: string
  message: string
}

type WhatsAppTemplatesProps = {
  referralUrl: string
}

export default function WhatsAppTemplates({ referralUrl }: WhatsAppTemplatesProps) {
  const t = useTranslations('whatsappPage')
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const templates: Template[] = [
    {
      id: 1,
      title: t('template1Title'),
      tone: t('template1Tone'),
      message: t('template1Message', { url: referralUrl })
    },
    {
      id: 2,
      title: t('template2Title'),
      tone: t('template2Tone'),
      message: t('template2Message', { url: referralUrl })
    },
    {
      id: 3,
      title: t('template3Title'),
      tone: t('template3Tone'),
      message: t('template3Message', { url: referralUrl })
    },
    {
      id: 4,
      title: t('template4Title'),
      tone: t('template4Tone'),
      message: t('template4Message', { url: referralUrl })
    }
  ]

  const handleCopy = async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.message)
      setCopiedId(template.id)
      setTimeout(() => setCopiedId(null), 2000)
      alert(t('copiedMsg'))
    } catch (err) {
      console.error('Copy error:', err)
    }
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div key={template.id} className="bg-white rounded-2xl border border-[var(--gold)]/25 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--ink)]">{template.title}</h3>
                <span className="inline-block mt-1 text-xs bg-[var(--gold)]/15 text-[var(--ink)] px-2 py-0.5 rounded-full font-semibold">
                  {template.tone}
                </span>
              </div>
              <MessageSquare className="w-6 h-6 shrink-0 text-[var(--gold)]" />
            </div>
            
            <div className="bg-[var(--paper)] rounded-lg p-4 mb-4 border-l-4 border-[var(--gold)]">
              <p className="text-[var(--ink-soft)] text-sm whitespace-pre-wrap break-words">{template.message}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => handleCopy(template)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white rounded-lg font-semibold transition-colors"
              >
                <Copy className="w-4 h-4" />
                {copiedId === template.id ? t('copied') : t('copyMsg')}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(template.message)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#1ebe5a] text-white rounded-lg font-semibold transition-colors"
              >
                <Send className="w-4 h-4" />
                {t('sendWhatsApp')}
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
