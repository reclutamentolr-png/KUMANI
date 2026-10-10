'use client'

import { Delete } from 'lucide-react'

// Tastiera di KUMANI NEXUS sul telefono: fissa in basso, così la griglia non
// viene coperta dalla tastiera del sistema.
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']

export default function NexusKeyboard({ onLetter, onDelete, deleteLabel, disabled = false }: { onLetter: (letter: string) => void; onDelete: () => void; deleteLabel: string; disabled?: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--gold)]/20 bg-[#EDE6D6] px-1 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 sm:hidden">
      <div className={`mx-auto flex max-w-md flex-col gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
        {KEY_ROWS.map((row, i) => (
          <div key={row} className="flex justify-center gap-[5px]">
            {row.split('').map((letter) => (
              <button
                key={letter}
                type="button"
                disabled={disabled}
                onClick={() => onLetter(letter)}
                className="h-12 max-w-[36px] flex-1 cursor-pointer rounded-lg bg-white text-base font-bold text-[var(--ink)] shadow-[0_1px_0_rgba(23,23,23,0.2)] active:bg-[var(--gold-pale)] disabled:cursor-default"
              >
                {letter}
              </button>
            ))}
            {i === 2 && (
              <button
                type="button"
                disabled={disabled}
                onClick={onDelete}
                aria-label={deleteLabel}
                className="flex h-12 w-14 cursor-pointer items-center justify-center rounded-lg bg-[#CFC5AF] text-[var(--ink)] active:brightness-95 disabled:cursor-default"
              >
                <Delete className="h-5 w-5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
