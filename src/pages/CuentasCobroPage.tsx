import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  actualizarEstadoCuentaCobro,
  listarCuentasCobro,
  urlDescargaFactura,
  type CuentaCobro,
  type EstadoCuentaCobro,
} from '../lib/facturacion'

const ESTADOS: EstadoCuentaCobro[] = ['pendiente', 'pagada', 'vencida', 'anulada']

/**
 * Listado de cuentas de cobro con estado (sección 9, Fase 6 de la
 * lista de tareas de desarrollo).
 */
export function CuentasCobroPage() {
  const [cuentas, setCuentas] = useState<CuentaCobro[]>([])
  const [filtroEstado, setFiltroEstado] = useState<EstadoCuentaCobro | ''>('')

  async function cargar() {
    const data = await listarCuentasCobro(filtroEstado ? { estado: filtroEstado } : undefined)
    setCuentas(data)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado])

  async function handleCambiarEstado(id: string, estado: EstadoCuentaCobro) {
    await actualizarEstadoCuentaCobro(id, estado)
    cargar()
  }

  async function handleDescargar(storagePath: string | null) {
    if (!storagePath) return
    const url = await urlDescargaFactura(storagePath)
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link to="/" className="font-display text-xl">
          Legium
        </Link>
        <nav className="flex gap-4 text-sm text-slate">
          <Link to="/casos" className="hover:text-ink">
            Casos
          </Link>
          <Link to="/plazos" className="hover:text-ink">
            Plazos
          </Link>
          <Link to="/facturacion" className="text-ink underline underline-offset-4">
            Facturación
          </Link>
          <Link to="/reportes" className="hover:text-ink">
            Reportes
          </Link>
        </nav>
      </header>

      <main className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-lg">Cuentas de cobro</h1>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoCuentaCobro | '')}
            className="border border-line bg-paper-raised px-2 py-1 text-sm"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <table className="w-full text-sm border-t border-line">
          <thead>
            <tr className="text-left text-slate border-b border-line">
              <th className="py-2">Número</th>
              <th className="py-2">Caso</th>
              <th className="py-2">Cliente</th>
              <th className="py-2">Total</th>
              <th className="py-2">Estado</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {cuentas.map((c) => (
              <tr key={c.id}>
                <td className="py-2">
                  <button onClick={() => handleDescargar(c.storage_path)} className="hover:underline">
                    {c.numero}
                  </button>
                </td>
                <td className="py-2">{c.casos?.titulo ?? '—'}</td>
                <td className="py-2">{c.clientes?.nombre ?? '—'}</td>
                <td className="py-2">${c.total.toLocaleString('es-CO')}</td>
                <td className="py-2">
                  <select
                    value={c.estado}
                    onChange={(e) => handleCambiarEstado(c.id, e.target.value as EstadoCuentaCobro)}
                    className="border border-line bg-paper-raised px-1 py-0.5"
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {e}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2" />
              </tr>
            ))}
            {cuentas.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-slate">
                  No hay cuentas de cobro con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
