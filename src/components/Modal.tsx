import { useEffect, type ReactNode } from 'react'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg max-h-[80vh] overflow-y-auto p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="text-slate hover:text-ink text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
