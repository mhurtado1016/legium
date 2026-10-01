import { useEffect, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'

// Visor dentro del sitio: PDF e imágenes se muestran embebidos (iframe /
// <img>), sin navegar a otra pestaña ni forzar una descarga. Para tipos que
// ningún navegador renderiza de forma nativa (Word, etc.) no hay forma
// honesta de "previsualizar" sin subir el archivo a un servicio externo —
// se avisa y se deja la descarga como única vía.
//
// `obtenerUrl` es explícito (en vez de asumir el bucket `documentos`) para
// poder reusar este visor con otros buckets privados, p. ej. el de
// Documentos IA (ver urlDescargaIA en src/lib/documentosIA.ts).
export function DocumentoPreviewModal({
  storagePath,
  mimeType,
  nombre,
  obtenerUrl,
  onClose,
}: {
  storagePath: string
  mimeType: string | null
  nombre: string
  obtenerUrl: (storagePath: string) => Promise<string>
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [archivoListo, setArchivoListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Resuelve la signed URL acá (no antes de abrir el modal) para que el
  // spinner sea visible desde el primer click, sin ese hueco de "no pasó
  // nada" mientras se espera la respuesta de Supabase.
  useEffect(() => {
    let cancelado = false
    setUrl(null)
    setArchivoListo(false)
    setError(null)
    obtenerUrl(storagePath)
      .then((u) => {
        if (!cancelado) setUrl(u)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el documento.')
      })
    return () => {
      cancelado = true
    }
  }, [storagePath, obtenerUrl])

  const esPdf = mimeType === 'application/pdf'
  const esImagen = mimeType?.startsWith('image/') ?? false
  // Para tipos sin visor embebido no hay nada que "cargar" en el iframe/img
  // — el spinner solo debe esperar a la signed URL, no a un onLoad que
  // nunca va a llegar.
  const cargando = !error && (!url || ((esPdf || esImagen) && !archivoListo))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-raised)] animate-in overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-line shrink-0">
          <p className="font-medium text-sm text-ink break-words min-w-0">{nombre}</p>
          <div className="flex items-center gap-3 shrink-0">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate hover:text-ink transition-colors"
              >
                <Download size={14} strokeWidth={1.75} />
                Descargar
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 -m-1.5 rounded-md text-slate hover:text-ink hover:bg-paper-sunken transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0 bg-paper-sunken">
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate">
              <Loader2 size={18} className="animate-spin" strokeWidth={1.75} />
              Cargando documento…
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-danger px-6 text-center">
              {error}
            </div>
          )}

          {url && esPdf && (
            <iframe
              src={url}
              title={nombre}
              onLoad={() => setArchivoListo(true)}
              className={`w-full h-full border-0 transition-opacity ${archivoListo ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {url && esImagen && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={url}
                alt={nombre}
                onLoad={() => setArchivoListo(true)}
                className={`max-w-full max-h-full object-contain transition-opacity ${archivoListo ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          )}
          {url && !esPdf && !esImagen && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-sm text-slate">
                Este tipo de archivo no se puede previsualizar en el navegador.
              </p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                <Download size={14} strokeWidth={1.75} />
                Descargar para verlo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
