import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Buscador' },
  { to: '/casos', label: 'Casos' },
  { to: '/plazos', label: 'Plazos' },
  { to: '/facturacion', label: 'Facturación' },
  { to: '/reportes', label: 'Reportes' },
]

/**
 * Encabezado compartido de la app, con navegación en un menú hamburguesa
 * en vez de una fila de enlaces — mantiene el encabezado sobrio (sección
 * 13.1) y escala mejor en pantallas angostas (sección 13.8).
 */
export function AppHeader({ left }: { left?: ReactNode }) {
  const { signOut } = useAuth()
  const { pathname } = useLocation()
  const [abierto, setAbierto] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickFuera(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [])

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-paper/90 backdrop-blur-sm px-6 py-4 border-b border-line/70">
      {left ?? (
        <Link to="/" className="font-display text-xl tracking-tight">
          Legium
        </Link>
      )}

      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex flex-col gap-1.5 p-2 -m-2 rounded-md hover:bg-paper-raised transition-colors"
        >
          <span className="block w-5 h-px bg-ink" />
          <span className="block w-5 h-px bg-ink" />
          <span className="block w-5 h-px bg-ink" />
        </button>

        {abierto && (
          <div className="card absolute right-0 top-full mt-2 w-52 overflow-hidden py-1 z-10">
            <nav className="flex flex-col text-sm">
              {NAV_ITEMS.map((item) => {
                const activo = pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setAbierto(false)}
                    className={
                      'px-4 py-2.5 mx-1 rounded-md transition-colors hover:bg-paper ' +
                      (activo ? 'text-ink font-medium bg-paper' : 'text-slate')
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
                className="px-4 py-2.5 mx-1 rounded-md text-left text-slate hover:bg-paper hover:text-ink transition-colors"
              >
                Cerrar sesión
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
