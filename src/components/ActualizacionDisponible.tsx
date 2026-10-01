import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { iniciarDeteccionDeActualizacion } from '../lib/actualizarApp'

/**
 * Aviso flotante cuando hay una versión nueva desplegada (ver
 * src/lib/actualizarApp.ts). Montado una sola vez a nivel de App para
 * que funcione en cualquier pantalla, landing incluido. No se recarga
 * sola para no perder algo que el usuario esté escribiendo (nota,
 * caso nuevo, etc.) — queda a un clic de distancia hasta que decide.
 */
export function ActualizacionDisponible() {
  const [disponible, setDisponible] = useState(false)

  useEffect(() => iniciarDeteccionDeActualizacion(() => setDisponible(true)), [])

  if (!disponible) return null

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      <div className="card flex items-center gap-3 px-4 py-3 shadow-[var(--shadow-raised)] animate-in">
        <p className="text-sm text-ink">Hay una nueva versión disponible.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary btn-sm shrink-0"
        >
          <RefreshCw size={14} strokeWidth={1.75} />
          Actualizar
        </button>
      </div>
    </div>
  )
}
