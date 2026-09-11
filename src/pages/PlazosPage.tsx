import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
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

      <main className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-lg">Plazos</h1>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoPlazo | '')}
            className="field field-sm"
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
            <tr className="text-left text-xs uppercase tracking-wide text-slate border-b border-line">
              <th className="py-2">Vence en</th>
              <th className="py-2">Título</th>
              <th className="py-2">Caso</th>
              <th className="py-2">Estado</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {plazos.map((p) => {
              const dias = diasRestantes(p.fecha_vencimiento)
              const urgente = p.estado !== 'cumplido' && dias < 3
              return (
                <tr key={p.id} className={urgente ? 'text-seal' : ''}>
                  <td className="py-2">
                    {p.estado === 'vencido' ? 'Vencido' : dias === 0 ? 'Hoy' : `${dias} días`}
                  </td>
                  <td className="py-2">{p.titulo}</td>
                  <td className="py-2">
                    <Link to={`/casos/${p.caso_id}`} className="hover:underline">
                      {p.casos?.titulo ?? '—'}
                    </Link>
                  </td>
                  <td className="py-2">{p.estado}</td>
                  <td className="py-2">
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
                <td colSpan={5} className="py-4 text-slate">
                  No hay plazos con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
