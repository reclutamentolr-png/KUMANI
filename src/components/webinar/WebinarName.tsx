// Nome di chi partecipa: sfondo oro per i Kumani (entrati con il loro
// account), azzurro per gli invitati da fuori (entrati con il link)
export default function WebinarName({ name, kumano, className = '' }: { name: string; kumano: boolean; className?: string }) {
  return (
    <span className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 align-middle text-xs font-extrabold ${kumano ? 'bg-[var(--gold-bright)] text-[var(--ink)]' : 'bg-sky-300 text-[#0b2540]'} ${className}`}>
      {name}
    </span>
  )
}
