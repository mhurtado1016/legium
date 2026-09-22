import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { StatusBadge } from '../components/StatusBadge'
import { diasRestantes, listarPlazos, marcarCumplido, type EstadoPlazo, type Plazo } from '../lib/plazos'

const ESTADOS: EstadoPlazo[] = ['pendiente', 'vencido', 'cumplido']

/**
 * Vista general de plazos, cruzando todos los casos del despacho.
 * Ver especificación técnica, sección 13.6: orden por vencimiento
 * ascendente, vencidos siempre arriba, `--seal` reservado para filas
 * vencidas o por vencer en menos de 3 días.
 */
export function PlazosPage() {
  const [plazos, setPlazos] = useState<Plazo[]>([])
  const [filtroEstado, setFiltroEstado] = useState<EstadoPlazo | ''>('')

  async function cargar() {
    const data = await listarPlazos(filtroEstado ? { estado: filtroEstado } : undefined)
    setPlazos(data)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado])

  async function handleCumplido(id: string) {
    await marcarCumplido(id)
    cargar()
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />

      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-[100rem] mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Plazos</h1>
            <p className="text-sm text-slate mt-1">Términos y vencimientos de todos los casos.</p>
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoPlazo | '')}
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

        <div className="card overflow-hidden overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Vence en</th>
                <th>Título</th>
                <th>Caso</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plazos.map((p) => {
                const dias = diasRestantes(p.fecha_vencimiento)
                const urgente = p.estado !== 'cumplido' && dias < 3
                return (
                  <tr key={p.id} className={urgente ? 'bg-[var(--color-danger-soft)]/40' : ''}>
                    <td>
                      <span className={urgente ? 'inline-flex items-center gap-1.5 font-medium text-danger' : ''}>
                        {urgente && <AlertTriangle size={14} strokeWidth={1.75} />}
                        {p.estado === 'vencido' ? 'Vencido' : dias === 0 ? 'Hoy' : `${dias} días`}
                      </span>
                    </td>
                    <td className="font-medium text-ink">{p.titulo}</td>
                    <td>
                      <Link to={`/app/casos/${p.caso_id}`} className="hover:text-accent transition-colors">
                        {p.casos?.titulo ?? '—'}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge estado={p.estado} />
                    </td>
                    <td>
                      {p.estado !== 'cumplido' && (
                        <button
                          onClick={() => handleCumplido(p.id)}
                          className="link"
                        >
                          marcar cumplido
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {plazos.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-slate text-center">
                    No hay plazos con este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
