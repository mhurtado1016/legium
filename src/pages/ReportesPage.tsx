import { useEffect, useState } from 'react'
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

      <main className="px-6 py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-lg">Reportes</h1>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as Periodo)}
            className="border border-line bg-paper-raised px-2 py-1 text-sm"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <section className="mb-8">
          <h2 className="font-display text-base mb-3">Cartera</h2>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-slate">Pendiente</p>
              <p className="text-2xl font-display">${(cartera?.pendiente ?? 0).toLocaleString('es-CO')}</p>
            </div>
            <div>
              <p className="text-sm text-slate">Vencida</p>
              <p className="text-2xl font-display text-seal">
                ${(cartera?.vencida ?? 0).toLocaleString('es-CO')}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate">Cobrado</p>
              <p className="text-2xl font-display">${(cartera?.cobrado ?? 0).toLocaleString('es-CO')}</p>
            </div>
          </div>
        </section>

        <hr className="border-line mb-8" />

        <div className="grid grid-cols-2 gap-8 mb-8">
          <section>
            <h2 className="font-display text-base mb-2">Casos por estado</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {casosPorEstado.map((c) => (
                  <tr key={c.estado}>
                    <td className="py-1 text-slate">{c.estado}</td>
                    <td className="py-1 text-right">{c.total}</td>
                  </tr>
                ))}
                {casosPorEstado.length === 0 && (
                  <tr>
                    <td className="py-1 text-slate">Sin datos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="font-display text-base mb-2">Plazos</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {plazosPorEstado.map((p) => (
                  <tr key={p.estado}>
                    <td className="py-1 text-slate">{p.estado}</td>
                    <td className="py-1 text-right">{p.total}</td>
                  </tr>
                ))}
                {plazosPorEstado.length === 0 && (
                  <tr>
                    <td className="py-1 text-slate">Sin datos.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        <hr className="border-line mb-8" />

        <section>
          <h2 className="font-display text-base mb-2">Horas por usuario</h2>
          <table className="w-full text-sm border-t border-line">
            <thead>
              <tr className="text-left text-slate border-b border-line">
                <th className="py-2">Usuario</th>
                <th className="py-2">Horas registradas</th>
                <th className="py-2">Horas facturadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {horasPorUsuario.map((h) => (
                <tr key={h.usuario_id}>
                  <td className="py-2">{h.nombre ?? '—'}</td>
                  <td className="py-2">{h.horas_totales}</td>
                  <td className="py-2">{h.horas_facturadas}</td>
                </tr>
              ))}
              {horasPorUsuario.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-slate">
                    Sin horas registradas en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
