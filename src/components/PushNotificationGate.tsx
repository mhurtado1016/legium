import { useEffect, useState, type ReactNode } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { useUsuario } from '../lib/useUsuario'
import { suscribirsePush } from '../lib/plazos'

type Estado = 'verificando' | 'activo' | 'requerido' | 'activando' | 'error' | 'denegado' | 'no_soportado'

// En iOS, PushManager solo existe cuando la página corre instalada en la
// pantalla de inicio (modo standalone) — en una pestaña normal de Safari
// "no soporta push" aunque el dispositivo sí pueda, y el usuario necesita
// una instrucción distinta ("agregar a inicio") a la de un navegador que
// simplemente no implementa Push API.
function esIOSSinInstalar() {
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const enStandalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  return esIOS && !enStandalone
}

/**
 * Bloquea toda la app (cualquier usuario autenticado, no solo
 * administradores) hasta que acepte las notificaciones push. Sin esto,
 * quien queda como responsable de un plazo o cita nunca recibe su
 * recordatorio porque nunca llegó a existir una fila en push_subscriptions
 * (ver suscribirsePush en src/lib/plazos.ts).
 */
export function PushNotificationGate({ children }: { children: ReactNode }) {
  const { usuario, loading: cargandoUsuario } = useUsuario()
  const [estado, setEstado] = useState<Estado>('verificando')
  const [intentos, setIntentos] = useState(0)
  const [detalleError, setDetalleError] = useState<string | null>(null)

  useEffect(() => {
    if (cargandoUsuario || !usuario) return

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('no_soportado')
      return
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setEstado('denegado')
      return
    }

    let cancelado = false
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelado) setEstado(sub ? 'activo' : 'requerido')
      })
      .catch(() => {
        if (!cancelado) setEstado('requerido')
      })
    return () => {
      cancelado = true
    }
  }, [cargandoUsuario, usuario, intentos])

  async function activar() {
    if (!usuario) return
    setEstado('activando')
    try {
      await suscribirsePush(usuario.firma_id, usuario.id)
      setEstado('activo')
    } catch (err) {
      console.error('No se pudo activar las notificaciones push:', err)
      const denegado = typeof Notification !== 'undefined' && Notification.permission === 'denied'
      setDetalleError(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
      setEstado(denegado ? 'denegado' : 'error')
    }
  }

  function reintentar() {
    setEstado('verificando')
    setIntentos((n) => n + 1)
  }

  if (cargandoUsuario || estado === 'verificando' || estado === 'activo') return <>{children}</>

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 backdrop-blur-sm px-4">
      <div
        className="card shadow-[var(--shadow-raised)] w-full max-w-md p-6 text-center"
        role="dialog"
        aria-modal="true"
        aria-label="Activar notificaciones"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <Bell size={22} strokeWidth={1.75} className="text-accent" />
        </div>
        <h2 className="font-display text-lg font-semibold mb-2">Activa las notificaciones</h2>

        {estado === 'no_soportado' && esIOSSinInstalar() ? (
          <>
            <p className="text-sm text-slate mb-4">
              Para recibir notificaciones en el iPhone primero agregá Legium a la pantalla de inicio: tocá el ícono
              de compartir de Safari y elegí "Agregar a pantalla de inicio". Después abrí la app desde ese ícono.
            </p>
            <button type="button" onClick={reintentar} className="btn-primary btn-sm">
              Ya la agregué, verificar
            </button>
          </>
        ) : estado === 'no_soportado' ? (
          <>
            <p className="text-sm text-slate mb-4">
              Este navegador no soporta notificaciones push. Abrí la app desde Chrome, Edge o Firefox para poder
              activarlas.
            </p>
            <button type="button" onClick={reintentar} className="btn-secondary btn-sm">
              Volver a verificar
            </button>
          </>
        ) : estado === 'denegado' ? (
          <>
            <p className="text-sm text-slate mb-4">
              Las notificaciones están bloqueadas para este sitio. Activálas desde la configuración del navegador
              (el ícono de candado o "i" junto a la dirección) y volvé a intentar.
            </p>
            <button type="button" onClick={reintentar} className="btn-primary btn-sm">
              Ya las activé, verificar
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate mb-4">
              Necesitamos tu permiso para avisarte de vencimientos de plazos y citas nuevas. Es obligatorio para
              poder usar la aplicación.
            </p>
            <button type="button" onClick={activar} disabled={estado === 'activando'} className="btn-primary btn-sm">
              {estado === 'activando' ? (
                <>
                  <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
                  Activando…
                </>
              ) : (
                <>{estado === 'error' ? 'Reintentar activar notificaciones' : 'Activar notificaciones'}</>
              )}
            </button>
            {estado === 'error' && (
              <p className="text-xs text-danger mt-3">
                No se pudo activar. Intentá de nuevo.
                {detalleError && (
                  <>
                    <br />
                    <span className="text-slate">{detalleError}</span>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
