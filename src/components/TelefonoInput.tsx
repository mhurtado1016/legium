import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { PAISES_TELEFONO, combinarTelefono, separarTelefono } from '../lib/paisesTelefono'

// Campo de teléfono compuesto: selector de país (indicativo +N) + número
// local, para que el usuario no tenga que escribir el indicativo a mano
// (fuente de números de WhatsApp mal formados). `value`/`onChange`
// trabajan sobre el mismo string combinado ("+57 3001234567") que ya
// guardan `usuarios.telefono_whatsapp` y `clientes.telefono`.
export function TelefonoInput({
  value,
  onChange,
  placeholder = '300 123 4567',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const { indicativo, numero } = separarTelefono(value)

  return (
    <div className="flex gap-2">
      <PaisSelector indicativo={indicativo} onChange={(nuevoIndicativo) => onChange(combinarTelefono(nuevoIndicativo, numero))} />
      <input
        type="tel"
        inputMode="numeric"
        value={numero}
        onChange={(e) => onChange(combinarTelefono(indicativo, e.target.value))}
        placeholder={placeholder}
        className="field field-sm flex-1 min-w-0"
      />
    </div>
  )
}

// Lista de ~30 países no cabe cómodo en un <select> nativo para buscar
// por nombre (hay que ir tecleando letra por letra y esperar que el
// navegador salte); un combo propio con buscador arriba de la lista es
// más rápido. El panel se monta con un portal a <body> y se posiciona
// con las coordenadas del botón: este campo siempre vive dentro de un
// <Modal>, cuyo panel tiene overflow-y-auto (para el scroll del propio
// modal) y eso recorta cualquier hijo `absolute` que se salga de sus
// bordes — con el portal, el panel flota por fuera de ese recorte.
function PaisSelector({ indicativo, onChange }: { indicativo: string; onChange: (indicativo: string) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [posicion, setPosicion] = useState({ top: 0, left: 0, width: 224 })
  const botonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buscadorRef = useRef<HTMLInputElement>(null)

  function abrir() {
    const r = botonRef.current?.getBoundingClientRect()
    if (r) setPosicion({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 224) })
    setAbierto(true)
  }

  function cerrar() {
    setAbierto(false)
    setBusqueda('')
  }

  useEffect(() => {
    if (!abierto) return
    function handleClickFuera(e: MouseEvent) {
      const target = e.target as Node
      if (botonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      cerrar()
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [abierto])

  useEffect(() => {
    if (abierto) buscadorRef.current?.focus()
  }, [abierto])

  const paisActual = PAISES_TELEFONO.find((p) => p.indicativo === indicativo)
  // Sin acentos en la comparación: para poder escribir "mexico" o "peru"
  // sin tilde y que igual encuentre "México"/"Perú".
  const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = normalizar(busqueda.trim())
  const filtrados = q
    ? PAISES_TELEFONO.filter((p) => normalizar(p.nombre).includes(q) || p.indicativo.includes(q))
    : PAISES_TELEFONO

  return (
    <div className="w-[9.5rem] shrink-0">
      <button
        ref={botonRef}
        type="button"
        onClick={() => (abierto ? cerrar() : abrir())}
        aria-label="País"
        aria-expanded={abierto}
        className="field field-sm w-full flex items-center justify-between gap-1 text-left"
      >
        <span className="truncate">
          {indicativo} {paisActual?.nombre ?? ''}
        </span>
        <ChevronDown size={14} strokeWidth={1.75} className="shrink-0 text-slate-soft" />
      </button>

      {abierto &&
        createPortal(
          <div
            ref={panelRef}
            className="card fixed overflow-hidden z-[60] animate-in py-1"
            style={{ top: posicion.top, left: posicion.left, width: posicion.width }}
          >
            <div className="px-2 pt-1 pb-2 border-b border-line">
              <input
                ref={buscadorRef}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtrados[0]) {
                    onChange(filtrados[0].indicativo)
                    cerrar()
                  } else if (e.key === 'Escape') {
                    // Sin esto, el Escape también burbujea hasta el
                    // listener global del <Modal> y cierra el modal
                    // completo en vez de solo este desplegable.
                    e.stopPropagation()
                    cerrar()
                  }
                }}
                placeholder="Buscar país…"
                className="w-full field field-sm"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {filtrados.map((p) => (
                <li key={p.nombre}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.indicativo)
                      cerrar()
                    }}
                    className={
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-paper-sunken transition-colors ' +
                      (p.indicativo === indicativo ? 'text-ink font-medium bg-paper-sunken' : 'text-slate')
                    }
                  >
                    {p.indicativo} {p.nombre}
                  </button>
                </li>
              ))}
              {filtrados.length === 0 && <li className="px-3 py-2 text-sm text-slate">Sin resultados.</li>}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  )
}
