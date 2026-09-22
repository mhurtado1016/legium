import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Modal genérico (overlay + panel centrado), sin dependencias externas.
 * Cierra con click en el fondo o tecla Escape.
 */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="card shadow-[var(--shadow-raised)] w-full max-w-lg max-h-[80vh] overflow-y-auto p-5 animate-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex items-center justify-center h-7 w-7 -m-1 rounded-full text-slate
              hover:text-ink hover:bg-paper-sunken transition-colors"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
