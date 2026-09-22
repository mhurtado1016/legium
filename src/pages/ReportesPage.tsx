import { useEffect, useState } from 'react'
import { Wallet, AlertTriangle, CircleDollarSign } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import {
  obtenerCartera,
  obtenerCasosPorEstado,
  obtenerHorasPorUsuario,
  obtenerPlazosPorEstado,
  type Cartera,
  type ConteoPorEstado,
  type HorasUsuario,
  type Periodo,
} from '../lib/reportes'

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'mes', label: 'Este mes' },
  { value: 'trimestre', label: 'Este trimestre' },
  { value: 'anio', label: 'Este año' },
  { value: 'todo', label: 'Todo el tiempo' },
]

/**
 * Reportes y analítica. Ver especificación técnica, sección 10.3: las
 * cifras de cartera son el elemento más prominente de la pantalla; el
 * resto se presenta en tablas simples, no en tarjetas adicionales.
 */
export function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [cartera, setCartera] = useState<Cartera | null>(null)
  const [casosPorEstado, setCasosPorEstado] = useState<ConteoPorEstado[]>([])
  const [plazosPorEstado, setPlazosPorEstado] = useState<ConteoPorEstado[]>([])
  const [horasPorUsuario, setHorasPorUsuario] = useState<HorasUsuario[]>([])

  useEffect(() => {
    obtenerCartera(periodo).then(setCartera)
    obtenerHorasPorUsuario(periodo).then(setHorasPorUsuario)
  }, [periodo])

  useEffect(() => {
    obtenerCasosPorEstado().then(setCasosPorEstado)
    obtenerPlazosPorEstado().then(setPlazosPorEstado)
  }, [])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />

      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Reportes</h1>
            <p className="text-sm text-slate mt-1">Cartera, casos y horas del despacho.</p>
          </div>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="field field-sm w-auto"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <section className="mb-10">
          <h2 className="eyebrow mb-3">Cartera</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <Wallet size={17} strokeWidth={1.75} className="text-slate-soft mb-3" />
              <p className="text-2xl font-display font-semibold">
                ${(cartera?.pendiente ?? 0).toLocaleString('es-CO')}
              </p>
              <p className="text-sm text-slate mt-1">Pendiente</p>
            </div>
            <div className="card p-5 border-[var(--color-danger)]/25">
              <AlertTriangle size={17} strokeWidth={1.75} className="text-danger mb-3" />
              <p className="text-2xl font-display font-semibold text-danger">
                ${(cartera?.vencida ?? 0).toLocaleString('es-CO')}
              </p>
              <p className="text-sm text-slate mt-1">Vencida</p>
            </div>
            <div className="card p-5">
              <CircleDollarSign size={17} strokeWidth={1.75} className="text-success mb-3" />
              <p className="text-2xl font-display font-semibold">
                ${(cartera?.cobrado ?? 0).toLocaleString('es-CO')}
              </p>
              <p className="text-sm text-slate mt-1">Cobrado</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
          <section>
            <h2 className="eyebrow mb-3">Casos por estado</h2>
            <div className="card overflow-hidden">
              <table className="table-modern">
                <tbody>
                  {casosPorEstado.map((c) => (
                    <tr key={c.estado}>
                      <td className="capitalize">{c.estado}</td>
                      <td className="text-right font-medium">{c.total}</td>
                    </tr>
                  ))}
                  {casosPorEstado.length === 0 && (
                    <tr>
                      <td className="text-slate">Sin datos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="eyebrow mb-3">Plazos</h2>
            <div className="card overflow-hidden">
              <table className="table-modern">
                <tbody>
                  {plazosPorEstado.map((p) => (
                    <tr key={p.estado}>
                      <td className="capitalize">{p.estado}</td>
                      <td className="text-right font-medium">{p.total}</td>
                    </tr>
                  ))}
                  {plazosPorEstado.length === 0 && (
                    <tr>
                      <td className="text-slate">Sin datos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section>
          <h2 className="eyebrow mb-3">Horas por usuario</h2>
          <div className="card overflow-hidden overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Horas registradas</th>
                  <th>Horas facturadas</th>
                </tr>
              </thead>
              <tbody>
                {horasPorUsuario.map((h) => (
                  <tr key={h.usuario_id}>
                    <td className="font-medium text-ink">{h.nombre ?? '—'}</td>
                    <td>{h.horas_totales}</td>
                    <td>{h.horas_facturadas}</td>
                  </tr>
                ))}
                {horasPorUsuario.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-slate text-center">
                      Sin horas registradas en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
