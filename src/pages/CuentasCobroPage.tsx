import { useEffect, useState } from 'react'
import { AppHeader } from '../components/AppHeader'
import { CardEmpty, CardHeader, CardList, CardRow, DataCard } from '../components/DataCard'
import { StatusBadge } from '../components/StatusBadge'
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
      <AppHeader />

      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-[100rem] mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Cuentas de cobro</h1>
            <p className="text-sm text-slate mt-1">Facturación emitida a los clientes del despacho.</p>
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoCuentaCobro | '')}
            className="field field-sm w-auto"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden md:block card overflow-hidden">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Número</th>
                <th>Caso</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button onClick={() => handleDescargar(c.storage_path)} className="font-medium text-ink hover:text-accent transition-colors">
                      {c.numero}
                    </button>
                  </td>
                  <td>{c.casos?.titulo ?? '—'}</td>
                  <td>{c.clientes?.nombre ?? '—'}</td>
                  <td className="font-medium">${c.total.toLocaleString('es-CO')}</td>
                  <td>
                    <StatusBadge estado={c.estado} />
                  </td>
                  <td>
                    <select
                      value={c.estado}
                      onChange={(e) => handleCambiarEstado(c.id, e.target.value as EstadoCuentaCobro)}
                      className="field field-sm w-auto"
                    >
                      {ESTADOS.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {cuentas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-slate text-center">
                    No hay cuentas de cobro con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <CardList>
          {cuentas.map((c) => (
            <DataCard key={c.id}>
              <CardHeader>
                <button
                  onClick={() => handleDescargar(c.storage_path)}
                  className="font-medium text-ink hover:text-accent transition-colors text-left"
                >
                  {c.numero}
                </button>
                <StatusBadge estado={c.estado} />
              </CardHeader>
              <CardRow label="Caso">{c.casos?.titulo ?? '—'}</CardRow>
              <CardRow label="Cliente">{c.clientes?.nombre ?? '—'}</CardRow>
              <CardRow label="Total">
                <span className="font-medium">${c.total.toLocaleString('es-CO')}</span>
              </CardRow>
              <label className="block pt-1 border-t border-line">
                <span className="block text-xs text-slate mb-1">Cambiar estado</span>
                <select
                  value={c.estado}
                  onChange={(e) => handleCambiarEstado(c.id, e.target.value as EstadoCuentaCobro)}
                  className="field field-sm w-full"
                >
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </label>
            </DataCard>
          ))}
          {cuentas.length === 0 && <CardEmpty>No hay cuentas de cobro con este filtro.</CardEmpty>}
        </CardList>
      </main>
    </div>
  )
}
