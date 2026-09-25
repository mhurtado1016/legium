import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useUsuario } from '../lib/useUsuario'
import { NotificationBell } from './NotificationBell'

const NAV_ITEMS = [
  { to: '/app', label: 'Buscador' },
  { to: '/app/casos', label: 'Casos' },
  { to: '/app/clientes', label: 'Clientes' },
  { to: '/app/plazos', label: 'Plazos' },
  { to: '/app/agenda', label: 'Agenda' },
  { to: '/app/facturacion', label: 'Facturación' },
  { to: '/app/reportes', label: 'Reportes' },
  { to: '/app/administracion', label: 'Administración', soloAdmin: true },
]

/**
 * Encabezado compartido de la app. En escritorio la navegación queda
 * siempre visible como una fila de pestañas (antes vivía escondida
 * detrás de un menú hamburguesa incluso en pantallas anchas, lo que
 * ocultaba innecesariamente la estructura de la app); en móvil se
 * conserva el menú desplegable.
 */
export function AppHeader({ left }: { left?: ReactNode }) {
  const { signOut } = useAuth()
  const { usuario } = useUsuario()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState(false)
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const usuarioMenuRef = useRef<HTMLDivElement>(null)
  const navItems = NAV_ITEMS.filter((item) => !item.soloAdmin || usuario?.es_administrador)

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
      if (usuarioMenuRef.current && !usuarioMenuRef.current.contains(e.target as Node)) {
        setMenuUsuarioAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  const iniciales = (usuario?.nombre ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '—'

  return (
    <header className="sticky top-0 z-20 bg-paper/85 backdrop-blur-md border-b border-line/70">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 h-16">
        <div className="flex items-center gap-6 min-w-0">
          {left ?? (
            <Link to="/app" className="flex items-center shrink-0">
              <img src="/logo.jpg" alt="Efrata 360" className="h-9 w-auto rounded-[var(--radius-field)]" />
            </Link>
          )}

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const activo = pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    'px-3 py-2 rounded-[var(--radius-field)] text-sm font-medium transition-colors ' +
                    (activo
                      ? 'bg-ink text-paper-raised'
                      : 'text-slate hover:text-ink hover:bg-paper-sunken')
                  }
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />

          <div className="relative hidden md:block" ref={usuarioMenuRef}>
            <button
              onClick={() => setMenuUsuarioAbierto((v) => !v)}
              aria-label="Menú de usuario"
              aria-expanded={menuUsuarioAbierto}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-line
                bg-paper-raised hover:border-ink/25 transition-colors"
            >
              <span
                className="flex items-center justify-center h-7 w-7 rounded-full bg-ink
                  text-paper-raised text-xs font-semibold"
              >
                {iniciales}
              </span>
              <span className="text-sm text-ink max-w-[9rem] truncate">
                {usuario?.nombre ?? 'Cuenta'}
              </span>
            </button>

            {menuUsuarioAbierto && (
              <div className="card absolute right-0 top-full mt-2 w-48 overflow-hidden py-1 z-10 animate-in">
                <button
                  onClick={() => {
                    setMenuUsuarioAbierto(false)
                    signOut()
                  }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-slate
                    hover:bg-paper-sunken hover:text-ink transition-colors"
                >
                  <LogOut size={16} strokeWidth={1.75} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          <div className="relative md:hidden" ref={panelRef}>
            <button
              onClick={() => setAbierto((v) => !v)}
              aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={abierto}
              className="flex items-center justify-center h-9 w-9 rounded-[var(--radius-field)]
                text-ink hover:bg-paper-sunken transition-colors"
            >
              {abierto ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
            </button>

            {abierto && (
              <div className="card absolute right-0 top-full mt-2 w-56 overflow-hidden py-1 z-10 animate-in">
                <nav className="flex flex-col text-sm">
                  {navItems.map((item) => {
                    const activo = pathname === item.to
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setAbierto(false)}
                        className={
                          'px-4 py-2.5 mx-1 rounded-md transition-colors hover:bg-paper-sunken ' +
                          (activo ? 'text-ink font-medium bg-paper-sunken' : 'text-slate')
                        }
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                  <div className="my-1 border-t border-line" />
                  <button
                    onClick={() => {
                      setAbierto(false)
                      signOut()
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 mx-1 rounded-md text-left
                      text-slate hover:bg-paper-sunken hover:text-ink transition-colors"
                  >
                    <LogOut size={16} strokeWidth={1.75} />
                    Cerrar sesión
                  </button>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
