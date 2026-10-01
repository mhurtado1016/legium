import { useEffect, useRef, useState } from 'react'
import { BellOff, BellRing, Loader2 } from 'lucide-react'
import { useUsuario } from '../lib/useUsuario'
import { suscribirsePush } from '../lib/plazos'

type Estado = 'verificando' | 'activo' | 'inactivo' | 'activando' | 'error' | 'denegado' | 'no_soportado'

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
 * Botón de notificaciones push en el header, siempre visible y a
 * disposición de quien quiera activarlas — reemplaza al modal que
 * bloqueaba toda la app hasta aceptar (PushNotificationGate). Nadie se
 * queda afuera de Legium por no querer notificaciones; quien sí las
 * quiera las activa desde acá cuando le convenga.
 */
export function PushNotificationButton() {
  const { usuario } = useUsuario()
  const [estado, setEstado] = useState<Estado>('verificando')
  const [detalleError, setDetalleError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!usuario) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('no_soportado')
      return
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      setEstado('denegado')
      return
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEstado(sub ? 'activo' : 'inactivo'))
      .catch(() => setEstado('inactivo'))
  }, [usuario])

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

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

  // Nada que hacer: navegador de escritorio sin Push API. En iOS sin
  // instalar sí hay una acción posible (instalar), así que ese caso
  // continúa y muestra el botón con instrucciones.
  if (estado === 'no_soportado' && !esIOSSinInstalar()) return null
  if (estado === 'verificando' || !usuario) return null

  const activa = estado === 'activo'

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones push del navegador"
        title="Notificaciones push del navegador"
        aria-expanded={abierto}
        className={
          'relative flex items-center justify-center h-9 w-9 rounded-[var(--radius-field)] transition-colors ' +
          (activa ? 'text-success hover:bg-paper-sunken' : 'text-slate hover:text-ink hover:bg-paper-sunken')
        }
      >
        {activa ? <BellRing size={19} strokeWidth={1.75} /> : <BellOff size={19} strokeWidth={1.75} />}
      </button>

      {abierto && (
        <div className="card absolute right-0 top-full mt-2 w-72 max-w-[90vw] p-4 z-10 animate-in">
          {estado === 'activo' ? (
            <div className="flex items-start gap-2.5">
              <BellRing size={16} strokeWidth={1.75} className="text-success mt-0.5 shrink-0" />
              <p className="text-sm text-ink">
                Las notificaciones están activas. Te avisamos de vencimientos de recordatorios y citas nuevas.
              </p>
            </div>
          ) : estado === 'no_soportado' ? (
            <>
              <p className="text-sm text-ink mb-3">
                Para recibir notificaciones en el iPhone primero agregá Legium a la pantalla de inicio: tocá el
                ícono de compartir de Safari y elegí "Agregar a pantalla de inicio". Después abrí la app desde ese
                ícono.
              </p>
            </>
          ) : estado === 'denegado' ? (
            <>
              <p className="text-sm text-ink mb-3">
                Las notificaciones están bloqueadas para este sitio. Activálas desde la configuración del navegador
                (el ícono de candado o "i" junto a la dirección) y volvé a intentar.
              </p>
              <button type="button" onClick={activar} className="btn-secondary btn-sm w-full justify-center">
                Ya las activé, reintentar
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink mb-3">
                Activá las notificaciones para enterarte de vencimientos de recordatorios y citas nuevas apenas ocurran.
              </p>
              <button
                type="button"
                onClick={activar}
                disabled={estado === 'activando'}
                className="btn-primary btn-sm w-full justify-center"
              >
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
                <p className="text-xs text-danger mt-2">
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
      )}
    </div>
  )
}
