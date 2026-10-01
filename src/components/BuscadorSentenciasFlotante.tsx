import { useState, type FormEvent } from 'react'
import { AlertCircle, Calendar, Check, ChevronDown, Link2, Loader2, Scale, Sparkles, User, X } from 'lucide-react'
import {
  buscarSentencias,
  generarAnalisisIA,
  localizarTexto,
  obtenerTextoCompleto,
  type Sentencia,
} from '../lib/sentencias'
import { vincularSentencia } from '../lib/casos'

/**
 * Buscador de jurisprudencia flotante dentro del detalle de un caso —
 * mismo buscador y detalle de sentencia de /app (DashboardPage.tsx),
 * pensado para encontrar, revisar y vincular sin salir de la página del
 * caso. No incluye favoritas (no aplica acá); sí el mismo detalle
 * expandible (análisis de IA, texto completo) que la página principal.
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

  // Mismo patrón que DashboardPage para el detalle expandible de cada
  // resultado (análisis de IA, texto completo).
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [generando, setGenerando] = useState<Record<string, boolean>>({})
  const [errorGeneracion, setErrorGeneracion] = useState<Record<string, string>>({})
  const [htmlPorId, setHtmlPorId] = useState<Record<string, string>>({})
  const [cargandoTextoId, setCargandoTextoId] = useState<string | null>(null)
  const [errorTextoPorId, setErrorTextoPorId] = useState<Record<string, string>>({})
  const [textoVisiblePorId, setTextoVisiblePorId] = useState<Record<string, boolean>>({})
  const [analisisVisiblePorId, setAnalisisVisiblePorId] = useState<Record<string, boolean>>({})

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

  function handleExpandir(s: Sentencia) {
    const yaAbierto = expandidoId === s.id
    setExpandidoId(yaAbierto ? null : s.id)

    if (!yaAbierto && s.texto_completo_url && !htmlPorId[s.id]) {
      setCargandoTextoId(s.id)
      obtenerTextoCompleto(s.texto_completo_url)
        .then((r) => {
          setHtmlPorId((prev) => ({ ...prev, [s.id]: r.html }))
          setTextoVisiblePorId((prev) => ({ ...prev, [s.id]: true }))
        })
        .catch((err) =>
          setErrorTextoPorId((prev) => ({
            ...prev,
            [s.id]: err instanceof Error ? err.message : JSON.stringify(err),
          })),
        )
        .finally(() => setCargandoTextoId(null))
    }
  }

  async function handleLocalizarTexto(sentenciaId: string) {
    setErrorGeneracion((prev) => {
      const { [sentenciaId]: _omitida, ...resto } = prev
      return resto
    })
    try {
      const r = await localizarTexto(sentenciaId)
      if (!r.ok) {
        setErrorGeneracion((prev) => ({
          ...prev,
          [sentenciaId]: `${r.motivo ?? 'No se pudo localizar el texto.'}${r.detalle ? ` (${r.detalle})` : ''}`,
        }))
        return
      }
      setResultados((prev) =>
        prev.map((s) =>
          s.id === sentenciaId
            ? { ...s, texto_completo_url: r.url ?? s.texto_completo_url, texto_completo_no_disponible: false }
            : s,
        ),
      )
    } catch (err) {
      setErrorGeneracion((prev) => ({
        ...prev,
        [sentenciaId]: err instanceof Error ? err.message : JSON.stringify(err),
      }))
    }
  }

  async function handleGenerarAnalisis(sentenciaId: string) {
    setGenerando((prev) => ({ ...prev, [sentenciaId]: true }))
    setErrorGeneracion((prev) => {
      const { [sentenciaId]: _omitida, ...resto } = prev
      return resto
    })
    try {
      const r = await generarAnalisisIA(sentenciaId)
      if (!r.ok) {
        const base =
          r.motivo === 'texto_completo_no_disponible' || r.motivo === 'url_construida_no_responde'
            ? 'No se pudo generar el análisis: no se encontró el texto completo en el sitio oficial.'
            : `No se pudo generar el análisis (${r.motivo ?? 'motivo desconocido'}).`
        setErrorGeneracion((prev) => ({
          ...prev,
          [sentenciaId]: r.detalle ? `${base} ${r.detalle}` : base,
        }))
      } else {
        setResultados((prev) =>
          prev.map((s) =>
            s.id === sentenciaId
              ? {
                  ...s,
                  demandante_ia: r.analisis?.demandante ?? s.demandante_ia,
                  demandado_ia: r.analisis?.demandado ?? s.demandado_ia,
                  motivo_ia: r.analisis?.motivo ?? s.motivo_ia,
                  resumen_ia: r.analisis?.resumen ?? s.resumen_ia,
                  hechos_ia: r.analisis?.hechos ?? s.hechos_ia,
                  problema_juridico_ia: r.analisis?.problema_juridico ?? s.problema_juridico_ia,
                  consideraciones_ia: r.analisis?.consideraciones_relevantes ?? s.consideraciones_ia,
                  decision_ia: r.analisis?.decision ?? s.decision_ia,
                }
              : s,
          ),
        )
        setAnalisisVisiblePorId((prev) => ({ ...prev, [sentenciaId]: true }))
      }
    } catch (err) {
      setErrorGeneracion((prev) => ({
        ...prev,
        [sentenciaId]: err instanceof Error ? err.message : JSON.stringify(err),
      }))
    } finally {
      setGenerando((prev) => ({ ...prev, [sentenciaId]: false }))
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
              const expandido = expandidoId === s.id
              return (
                <li key={s.id}>
                  <div className="card overflow-hidden hover:shadow-[var(--shadow-raised)] transition-shadow">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleExpandir(s)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleExpandir(s)
                        }
                      }}
                      className="w-full text-left p-3.5 hover:bg-paper-sunken transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="shrink-0 rounded-full bg-paper-sunken p-2 text-ink">
                            <Scale size={15} strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-ink">
                              {s.sentencia} <span className="text-slate font-normal">· {s.sala ?? 'Sala no especificada'}</span>
                            </p>
                            <p className="inline-flex items-center gap-1.5 text-xs text-slate mt-1">
                              <Calendar size={12} strokeWidth={1.75} />
                              {s.fecha_sentencia ? new Date(s.fecha_sentencia).toLocaleDateString('es-CO') : '—'}
                            </p>
                            {s.magistrado_a && (
                              <p className="flex items-center gap-1.5 text-xs text-slate mt-0.5 w-full">
                                <User size={12} strokeWidth={1.75} className="shrink-0" />
                                <span>{s.magistrado_a}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {vinculada ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success font-medium whitespace-nowrap">
                              <Check size={14} strokeWidth={1.75} />
                              Vinculada
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleVincular(s.id)
                              }}
                              disabled={vinculando[s.id]}
                              className="btn-secondary btn-sm whitespace-nowrap"
                            >
                              {vinculando[s.id] ? (
                                <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                              ) : (
                                <Link2 size={14} strokeWidth={1.75} />
                              )}
                              Vincular
                            </button>
                          )}
                          <ChevronDown
                            size={16}
                            strokeWidth={1.75}
                            className={'shrink-0 text-slate transition-transform ' + (expandido ? 'rotate-180' : '')}
                          />
                        </div>
                      </div>

                      {errorVincularPorId[s.id] && <p className="mt-2 text-xs text-danger">{errorVincularPorId[s.id]}</p>}

                      {s.resumen_ia && !expandido && (
                        <p className="mt-2.5 pt-2.5 border-t border-line text-sm text-ink line-clamp-2">{s.resumen_ia}</p>
                      )}
                    </div>

                    {expandido && (
                      <div className="border-t border-line p-4 space-y-4 text-sm">
                        <table className="w-full">
                          <tbody className="divide-y divide-line">
                            <tr>
                              <td className="py-1.5 text-slate w-36">Proceso</td>
                              <td className="py-1.5">{s.proceso ?? '—'}</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-slate">Expediente</td>
                              <td className="py-1.5">
                                {s.expediente_tipo ?? '—'} {s.expediente_numero ?? ''}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-slate">Salvamentos de voto</td>
                              <td className="py-1.5">{s.sv_spv ?? 'no disponible en la fuente consultada'}</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-slate">Aclaraciones de voto</td>
                              <td className="py-1.5">{s.av_apv ?? 'no disponible en la fuente consultada'}</td>
                            </tr>
                          </tbody>
                        </table>

                        <div>
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <button
                              type="button"
                              onClick={() =>
                                setAnalisisVisiblePorId((prev) => ({ ...prev, [s.id]: !(prev[s.id] ?? true) }))
                              }
                              className="flex items-center gap-1.5 hover:text-ink transition-colors"
                            >
                              <h3 className="font-display text-base">Análisis</h3>
                              {s.resumen_ia && (
                                <ChevronDown
                                  size={16}
                                  strokeWidth={1.75}
                                  className={
                                    'text-slate transition-transform ' +
                                    (analisisVisiblePorId[s.id] ?? true ? 'rotate-180' : '')
                                  }
                                />
                              )}
                            </button>
                            <button
                              onClick={() => handleGenerarAnalisis(s.id)}
                              disabled={generando[s.id]}
                              className={
                                'inline-flex items-center gap-1.5 disabled:opacity-50 ' +
                                (s.resumen_ia ? 'link text-sm' : 'btn-primary btn-sm')
                              }
                            >
                              {generando[s.id] ? (
                                <>
                                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                                  {s.resumen_ia ? 'Regenerando…' : 'Generando…'}
                                </>
                              ) : (
                                <>
                                  <Sparkles size={14} strokeWidth={1.75} />
                                  {s.resumen_ia ? 'Regenerar análisis' : 'Generar análisis con IA'}
                                </>
                              )}
                            </button>
                          </div>

                          {s.texto_completo_no_disponible && !s.texto_completo_url && (
                            <div className="text-slate space-y-2 mb-3">
                              <p className="inline-flex items-center gap-1.5 text-danger">
                                <AlertCircle size={14} strokeWidth={1.75} />
                                No se pudo localizar la sentencia completa en el sitio oficial la
                                última vez. El botón de arriba lo vuelve a intentar.
                              </p>
                              <button onClick={() => handleLocalizarTexto(s.id)} className="link">
                                Reintentar solo la localización
                              </button>
                            </div>
                          )}

                          {errorGeneracion[s.id] && (
                            <p className="inline-flex items-center gap-1.5 text-danger mb-3">
                              <AlertCircle size={14} strokeWidth={1.75} />
                              {errorGeneracion[s.id]}
                            </p>
                          )}

                          {s.resumen_ia && (analisisVisiblePorId[s.id] ?? true) && (
                            <div className="space-y-3">
                              {(s.demandante_ia || s.demandado_ia) && (
                                <p className="text-slate">
                                  {s.demandante_ia && <>Demandante: {s.demandante_ia}</>}
                                  {s.demandante_ia && s.demandado_ia && ' · '}
                                  {s.demandado_ia && <>Demandado: {s.demandado_ia}</>}
                                </p>
                              )}
                              {s.motivo_ia && <p className="text-ink">{s.motivo_ia}</p>}
                              <Seccion titulo="Resumen" texto={s.resumen_ia} />
                              <Seccion titulo="Hechos" texto={s.hechos_ia} />
                              <Seccion titulo="Problema jurídico" texto={s.problema_juridico_ia} />
                              <Seccion titulo="Consideraciones relevantes" texto={s.consideraciones_ia} />
                              <Seccion titulo="Decisión" texto={s.decision_ia} />
                            </div>
                          )}
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => setTextoVisiblePorId((prev) => ({ ...prev, [s.id]: !prev[s.id] }))}
                            disabled={!htmlPorId[s.id]}
                            className="flex items-center gap-1.5 hover:text-ink transition-colors mb-2 disabled:cursor-default disabled:hover:text-ink"
                          >
                            <h3 className="font-display text-base">Sentencia completa</h3>
                            {htmlPorId[s.id] && (
                              <ChevronDown
                                size={16}
                                strokeWidth={1.75}
                                className={'text-slate transition-transform ' + (textoVisiblePorId[s.id] ? 'rotate-180' : '')}
                              />
                            )}
                          </button>
                          {s.texto_completo_url ? (
                            <>
                              {cargandoTextoId === s.id && <p className="text-slate">Cargando…</p>}
                              {errorTextoPorId[s.id] && <p className="text-danger mb-2">{errorTextoPorId[s.id]}</p>}
                              {htmlPorId[s.id] && textoVisiblePorId[s.id] && (
                                <div
                                  className="texto-oficial max-h-72 overflow-y-auto pr-2"
                                  dangerouslySetInnerHTML={{ __html: htmlPorId[s.id] }}
                                />
                              )}
                              <a href={s.texto_completo_url} target="_blank" rel="noreferrer" className="link mt-3 inline-block">
                                Ver en el sitio oficial
                              </a>
                            </>
                          ) : (
                            <p className="text-slate">
                              {s.texto_completo_no_disponible ? 'No disponible.' : 'Aún no se ha localizado la sentencia completa.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
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

function Seccion({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div>
      <p className="text-slate mb-1">{titulo}</p>
      <p>{texto}</p>
    </div>
  )
}
