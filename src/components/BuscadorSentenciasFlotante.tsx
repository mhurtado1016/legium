import { useState, type FormEvent } from 'react'
import { Check, Link2, Loader2, Scale, X } from 'lucide-react'
import { buscarSentencias, type Sentencia } from '../lib/sentencias'
import { vincularSentencia } from '../lib/casos'

/**
 * Buscador de jurisprudencia flotante dentro del detalle de un caso —
 * mismo buscador de /app (src/lib/sentencias.ts), pero pensado para
 * encontrar y vincular rápido sin salir de la página del caso. El
 * buscador completo (con análisis de IA, texto completo, favoritas)
 * sigue viviendo en DashboardPage; acá solo se necesita buscar y
 * vincular, así que la lista de resultados es más simple.
 */
export function BuscadorSentenciasFlotante({
  casoId,
  firmaId,
  usuarioId,
  sentenciaIdsVinculadas,
  onVinculada,
  onClose,
}: {
  casoId: string
  firmaId: string
  usuarioId: string
  sentenciaIdsVinculadas: Set<string>
  onVinculada: () => void
  onClose: () => void
}) {
  const [texto, setTexto] = useState('')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [sentenciaTipo, setSentenciaTipo] = useState('')
  const [magistrado, setMagistrado] = useState('')
  const [sala, setSala] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const [resultados, setResultados] = useState<Sentencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [vinculando, setVinculando] = useState<Record<string, boolean>>({})
  const [errorVincularPorId, setErrorVincularPorId] = useState<Record<string, string>>({})

  async function handleBuscar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBuscando(true)
    try {
      const { resultados } = await buscarSentencias({
        texto: texto || undefined,
        sentencia_tipo: sentenciaTipo || undefined,
        magistrado_a: magistrado || undefined,
        sala: sala || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      setResultados(resultados)
      setBuscado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo buscar jurisprudencia.')
    } finally {
      setBuscando(false)
    }
  }

  async function handleVincular(sentenciaId: string) {
    setVinculando((prev) => ({ ...prev, [sentenciaId]: true }))
    setErrorVincularPorId((prev) => {
      const { [sentenciaId]: _omitida, ...resto } = prev
      return resto
    })
    try {
      await vincularSentencia(casoId, sentenciaId, '', firmaId, usuarioId)
      onVinculada()
    } catch (err) {
      setErrorVincularPorId((prev) => ({
        ...prev,
        [sentenciaId]: err instanceof Error ? err.message : 'No se pudo vincular al caso.',
      }))
    } finally {
      setVinculando((prev) => ({ ...prev, [sentenciaId]: false }))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-3xl h-[85vh] flex flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-raised)] animate-in overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Scale size={18} strokeWidth={1.75} className="text-slate shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-ink truncate">Jurisprudencia</p>
              <p className="text-xs text-slate truncate">Busca sentencias y vincúlalas a este caso</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 -m-1.5 rounded-md text-slate hover:text-ink hover:bg-paper-sunken transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <form onSubmit={handleBuscar}>
            <div className="card p-2 flex gap-2 mb-2">
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Número de sentencia, tipo de proceso o palabra clave…"
                className="flex-1 border-none shadow-none focus:ring-0 field field-sm"
              />
              <button type="submit" disabled={buscando} className="btn-primary btn-sm">
                {buscando ? 'Buscando…' : 'Buscar'}
              </button>
            </div>

            <button type="button" onClick={() => setFiltrosAbiertos((v) => !v)} className="link text-xs mb-3">
              {filtrosAbiertos ? 'Ocultar filtros' : 'Más filtros'}
            </button>

            {filtrosAbiertos && (
              <div className="card p-3 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm animate-in">
                <div>
                  <label className="block text-slate mb-1 text-xs">Tipo de sentencia</label>
                  <select value={sentenciaTipo} onChange={(e) => setSentenciaTipo(e.target.value)} className="w-full field field-sm">
                    <option value="">Todos</option>
                    <option value="C">C — Constitucionalidad</option>
                    <option value="T">T — Tutela</option>
                    <option value="SU">SU — Unificación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate mb-1 text-xs">Magistrado(a) ponente</label>
                  <input type="text" value={magistrado} onChange={(e) => setMagistrado(e.target.value)} className="w-full field field-sm" />
                </div>
                <div>
                  <label className="block text-slate mb-1 text-xs">Sala</label>
                  <input type="text" value={sala} onChange={(e) => setSala(e.target.value)} className="w-full field field-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2 min-w-0">
                  <div className="min-w-0">
                    <label className="block text-slate mb-1 text-xs">Desde</label>
                    <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full min-w-0 field field-sm" />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-slate mb-1 text-xs">Hasta</label>
                    <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full min-w-0 field field-sm" />
                  </div>
                </div>
              </div>
            )}
          </form>

          {error && <p className="text-sm text-danger mb-3">{error}</p>}

          {buscado && (
            <p className="text-xs text-slate mb-2">
              {resultados.length === 1 ? '1 resultado encontrado' : `${resultados.length} resultados encontrados`}
            </p>
          )}

          <ul className="space-y-2">
            {resultados.map((s) => {
              const vinculada = sentenciaIdsVinculadas.has(s.id)
              return (
                <li key={s.id} className="card p-3.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-ink">
                      {s.sentencia} <span className="text-slate font-normal">· {s.sala ?? 'Sala no especificada'}</span>
                    </p>
                    <p className="text-xs text-slate mt-1">
                      {s.fecha_sentencia ? new Date(s.fecha_sentencia).toLocaleDateString('es-CO') : '—'}
                      {s.magistrado_a ? ` · ${s.magistrado_a}` : ''}
                    </p>
                    {s.resumen_ia && <p className="text-sm text-ink mt-2 line-clamp-2">{s.resumen_ia}</p>}
                    {errorVincularPorId[s.id] && <p className="text-xs text-danger mt-1">{errorVincularPorId[s.id]}</p>}
                  </div>
                  {vinculada ? (
                    <span className="shrink-0 inline-flex items-center gap-1 text-xs text-success font-medium whitespace-nowrap">
                      <Check size={14} strokeWidth={1.75} />
                      Vinculada
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleVincular(s.id)}
                      disabled={vinculando[s.id]}
                      className="btn-secondary btn-sm shrink-0 whitespace-nowrap"
                    >
                      {vinculando[s.id] ? (
                        <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                      ) : (
                        <Link2 size={14} strokeWidth={1.75} />
                      )}
                      Vincular
                    </button>
                  )}
                </li>
              )
            })}
            {buscado && resultados.length === 0 && <li className="py-3 text-sm text-slate">Sin resultados para esta búsqueda.</li>}
            {!buscado && !buscando && (
              <li className="py-3 text-sm text-slate">Busca por número de sentencia, magistrado, sala o texto libre.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}
