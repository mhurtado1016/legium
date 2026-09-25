import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import {
  contarNoLeidas,
  listarNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  type Notificacion,
} from '../lib/notificaciones'

// Refresco del contador cada 60s: no hay realtime en el proyecto (todo
// lo demás también se recarga por fetch, no por suscripción), así que
// se mantiene el mismo patrón en vez de introducir uno nuevo.
const INTERVALO_REFRESCO_MS = 60_000

function tiempoRelativo(fechaISO: string) {
  const segundos = Math.max(0, (Date.now() - new Date(fechaISO).getTime()) / 1000)
  if (segundos < 60) return 'ahora'
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `hace ${dias} d`
  return new Date(fechaISO).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function NotificationBell() {
  const [abierto, setAbierto] = useState(false)
  const [noLeidas, setNoLeidas] = useState(0)
  const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    contarNoLeidas()
      .then(setNoLeidas)
      .catch(() => {})
    const intervalo = setInterval(() => {
      contarNoLeidas()
        .then(setNoLeidas)
        .catch(() => {})
    }, INTERVALO_REFRESCO_MS)
    return () => clearInterval(intervalo)
  }, [])

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  async function alAbrir() {
    const yaAbierto = abierto
    setAbierto((v) => !v)
    if (yaAbierto) return
    try {
      setNotificaciones(await listarNotificaciones())
    } catch {
      setNotificaciones([])
    }
  }

  async function handleClickNotificacion(n: Notificacion) {
    if (!n.leido) {
      setNotificaciones((prev) => prev?.map((x) => (x.id === n.id ? { ...x, leido: true } : x)) ?? null)
      setNoLeidas((v) => Math.max(0, v - 1))
      marcarLeida(n.id).catch(() => {})
    }
    setAbierto(false)
  }

  async function handleMarcarTodas() {
    setNotificaciones((prev) => prev?.map((x) => ({ ...x, leido: true })) ?? null)
    setNoLeidas(0)
    try {
      await marcarTodasLeidas()
    } catch {
      // si falla, el próximo refresco periódico corrige el contador
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={alAbrir}
        aria-label="Notificaciones"
        aria-expanded={abierto}
        className="relative flex items-center justify-center h-9 w-9 rounded-[var(--radius-field)]
          text-ink hover:bg-paper-sunken transition-colors"
      >
        <Bell size={19} strokeWidth={1.75} />
        {noLeidas > 0 && (
          <span
            className="absolute top-1 right-1 flex items-center justify-center h-4 min-w-4 px-1 rounded-full
              bg-seal text-paper-raised text-[10px] font-semibold leading-none"
          >
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="card absolute right-0 top-full mt-2 w-80 max-w-[90vw] overflow-hidden z-10 animate-in">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-line">
            <span className="text-sm font-semibold text-ink">Notificaciones</span>
            {notificaciones && notificaciones.some((n) => !n.leido) && (
              <button
                onClick={handleMarcarTodas}
                className="flex items-center gap-1 text-xs text-slate hover:text-ink transition-colors"
              >
                <CheckCheck size={13} strokeWidth={1.75} />
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notificaciones === null ? (
              <p className="px-3.5 py-6 text-sm text-slate text-center">Cargando…</p>
            ) : notificaciones.length === 0 ? (
              <p className="px-3.5 py-6 text-sm text-slate text-center">No hay notificaciones.</p>
            ) : (
              notificaciones.map((n) => {
                const contenido = (
                  <>
                    <div className="flex items-start gap-2">
                      {!n.leido && <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-seal shrink-0" />}
                      <div className="min-w-0">
                        <p className={'text-sm ' + (n.leido ? 'text-slate' : 'text-ink font-medium')}>{n.titulo}</p>
                        {n.cuerpo && <p className="text-xs text-slate mt-0.5 line-clamp-2">{n.cuerpo}</p>}
                        <p className="text-[11px] text-slate mt-1">{tiempoRelativo(n.created_at)}</p>
                      </div>
                    </div>
                  </>
                )
                return n.enlace ? (
                  <Link
                    key={n.id}
                    to={n.enlace}
                    onClick={() => handleClickNotificacion(n)}
                    className="block px-3.5 py-2.5 border-b border-line last:border-b-0 hover:bg-paper-sunken transition-colors"
                  >
                    {contenido}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    onClick={() => handleClickNotificacion(n)}
                    className="w-full text-left px-3.5 py-2.5 border-b border-line last:border-b-0 hover:bg-paper-sunken transition-colors"
                  >
                    {contenido}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
