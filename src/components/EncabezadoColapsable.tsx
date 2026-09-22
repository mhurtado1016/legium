import { ChevronDown } from 'lucide-react'

export function EncabezadoColapsable({
  titulo,
  abierto,
  onToggle,
}: {
  titulo: string
  abierto: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 w-full text-left group"
    >
      <h2 className="font-display text-base font-semibold group-hover:text-ink transition-colors">
        {titulo}
      </h2>
      <ChevronDown
        size={18}
        strokeWidth={1.75}
        className={'text-slate transition-transform ' + (abierto ? 'rotate-180' : '')}
      />
    </button>
  )
}
