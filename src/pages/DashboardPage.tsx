import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Scale,
  Calendar,
  User,
  Sparkles,
  AlertCircle,
  ChevronDown,
  Loader2,
  FolderOpen,
  Clock3,
  ShieldCheck,
} from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useUsuario } from '../lib/useUsuario'
import {
  buscarSentencias,
  contarVerificacionesPendientes,
  generarAnalisisIA,
  localizarTexto,
  obtenerTextoCompleto,
  verificarResumen,
  type Sentencia,
} from '../lib/sentencias'
import { diasRestantes, listarPlazos, type Plazo } from '../lib/plazos'
import { listarCasos, type Caso } from '../lib/casos'

/**
 * Dashboard + buscador de sentencias unificados.
 * Ver especificación técnica, sección 13.3: el buscador es lo primero y
 * más grande de la pantalla; la columna lateral muestra lo que requiere
 * acción del usuario hoy (por ahora, solo verificaciones pendientes —
 * plazos y casos abiertos se incorporan en las Fases 2 y 3).
 */
export function DashboardPage() {
  const { usuario } = useUsuario()

  const [texto, setTexto] = useState('')
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [sentenciaTipo, setSentenciaTipo] = useState('')
  const [expedienteTipo, setExpedienteTipo] = useState('')
  const [magistrado, setMagistrado] = useState('')
  const [sala, setSala] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [resultados, setResultados] = useState<Sentencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificacionesPendientes, setVerificacionesPendientes] = useState<number | null>(null)
  const [plazosProximos, setPlazosProximos] = useState<Plazo[]>([])
  const [casosAbiertos, setCasosAbiertos] = useState<Caso[]>([])
  const [generando, setGenerando] = useState<Record<string, boolean>>({})
  const [errorGeneracion, setErrorGeneracion] = useState<Record<string, string>>({})
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [htmlPorId, setHtmlPorId] = useState<Record<string, string>>({})
  const [cargandoTextoId, setCargandoTextoId] = useState<string | null>(null)
  const [errorTextoPorId, setErrorTextoPorId] = useState<Record<string, string>>({})

  useEffect(() => {
    contarVerificacionesPendientes().then(setVerificacionesPendientes).catch(() => {})
    listarPlazos({ estado: 'pendiente' })
      .then((p) => setPlazosProximos(p.slice(0, 5)))
      .catch(() => {})
    listarCasos()
      .then((c) => setCasosAbiertos(c.filter((x) => x.estado === 'abierto' || x.estado === 'en_curso').slice(0, 5)))
      .catch(() => {})
  }, [])

  async function handleBuscar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBuscando(true)
    try {
      const { resultados } = await buscarSentencias({
        texto: texto || undefined,
        sentencia_tipo: sentenciaTipo || undefined,
        expediente_tipo: expedienteTipo || undefined,
        magistrado_a: magistrado || undefined,
        sala: sala || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
      })
      setResultados(resultados)
      setBuscado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setBuscando(false)
    }
  }

  function handleExpandir(s: Sentencia) {
    const yaAbierto = expandidoId === s.id
    setExpandidoId(yaAbierto ? null : s.id)

    if (!yaAbierto && s.texto_completo_url && !htmlPorId[s.id]) {
      setCargandoTextoId(s.id)
      obtenerTextoCompleto(s.texto_completo_url)
        .then((r) => setHtmlPorId((prev) => ({ ...prev, [s.id]: r.html })))
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

  async function handleVerificar(sentenciaId: string) {
    if (!usuario) return
    await verificarResumen(sentenciaId, usuario.firma_id, usuario.id)
    setResultados((prev) =>
      prev.map((s) => (s.id === sentenciaId ? { ...s, resumen_ia_verificado: true } : s)),
    )
    setVerificacionesPendientes((prev) => (prev !== null ? Math.max(prev - 1, 0) : prev))
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
                  resumen_ia: r.analisis?.resumen ?? s.resumen_ia,
                  hechos_ia: r.analisis?.hechos ?? s.hechos_ia,
                  problema_juridico_ia: r.analisis?.problema_juridico ?? s.problema_juridico_ia,
                  consideraciones_ia: r.analisis?.consideraciones_relevantes ?? s.consideraciones_ia,
                  decision_ia: r.analisis?.decision ?? s.decision_ia,
                  resumen_ia_verificado: false,
                }
              : s,
          ),
        )
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
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />

      <main className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
        <section>
          <h2 className="font-display text-lg mb-2">Buscar jurisprudencia</h2>
          <form onSubmit={handleBuscar}>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Número de sentencia, tipo de proceso o palabra clave del análisis…"
                className="flex-1 field"
              />
              <button
                type="submit"
                disabled={buscando}
                className="btn-primary"
              >
                {buscando ? 'Buscando…' : 'Ir'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setFiltrosAbiertos((v) => !v)}
              className="link text-sm mb-4"
            >
              {filtrosAbiertos ? 'Ocultar filtros' : 'Más filtros'}
            </button>

            {filtrosAbiertos && (
              <div className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-slate mb-1">Tipo de sentencia</label>
                  <select
                    value={sentenciaTipo}
                    onChange={(e) => setSentenciaTipo(e.target.value)}
                    className="w-full field"
                  >
                    <option value="">Todos</option>
                    <option value="C">C — Constitucionalidad</option>
                    <option value="T">T — Tutela</option>
                    <option value="SU">SU — Unificación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate mb-1">Tipo de proceso (expediente)</label>
                  <select
                    value={expedienteTipo}
                    onChange={(e) => setExpedienteTipo(e.target.value)}
                    className="w-full field"
                  >
                    <option value="">Todos</option>
                    <option value="D">D — Demanda de inconstitucionalidad</option>
                    <option value="T">T — Tutela</option>
                    <option value="RE">RE — Revisión</option>
                    <option value="LAT">LAT — Ley aprobatoria de tratado</option>
                    <option value="TI">TI — Impedimento</option>
                    <option value="OP">OP — Objeciones presidenciales</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate mb-1">Magistrado(a) ponente</label>
                  <input
                    type="text"
                    value={magistrado}
                    onChange={(e) => setMagistrado(e.target.value)}
                    placeholder="Nombre del magistrado"
                    className="w-full field"
                  />
                </div>
                <div>
                  <label className="block text-slate mb-1">Sala</label>
                  <input
                    type="text"
                    value={sala}
                    onChange={(e) => setSala(e.target.value)}
                    placeholder="Ej. Sala Plena, Sala Novena…"
                    className="w-full field"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-slate mb-1">Fecha desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full min-w-0 field"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-slate mb-1">Fecha hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full min-w-0 field"
                  />
                </div>
                <p className="sm:col-span-2 text-slate">
                  Nota: el dataset público de la Corte no incluye las partes del proceso
                  (demandante/demandado) ni tema/descriptor; el magistrado(a) ponente es el único
                  dato de persona disponible, y la búsqueda por palabra clave del cuadro principal
                  solo encuentra coincidencias en sentencias que ya tengan un análisis generado por
                  IA.
                </p>
              </div>
            )}
          </form>

          {error && <p className="text-sm text-seal mb-4">{error}</p>}

          {buscado && (
            <p className="text-sm text-slate mb-2">
              {resultados.length === 1
                ? '1 resultado encontrado'
                : `${resultados.length} resultados encontrados`}
            </p>
          )}

          <ul className="space-y-3">
            {resultados.map((s) => {
              const expandido = expandidoId === s.id
              return (
                <li key={s.id}>
                  <div className="card overflow-hidden hover:shadow-[var(--shadow-raised)] transition-shadow">
                    <button
                      onClick={() => handleExpandir(s)}
                      className="w-full text-left p-5 hover:bg-paper transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="shrink-0 rounded-full bg-paper p-2.5 text-ink">
                            <Scale size={18} strokeWidth={1.75} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-ink">
                              {s.sentencia}{' '}
                              <span className="text-slate font-normal">
                                · {s.sala ?? 'Sala no especificada'}
                              </span>
                            </p>
                            <p className="inline-flex items-center gap-1.5 text-sm text-slate mt-1.5">
                              <Calendar size={14} strokeWidth={1.75} />
                              {s.fecha_sentencia
                                ? new Date(s.fecha_sentencia).toLocaleDateString('es-CO')
                                : '—'}
                            </p>
                            {s.magistrado_a && (
                              <p className="flex items-center gap-1.5 text-sm text-slate mt-1 w-full">
                                <User size={14} strokeWidth={1.75} className="shrink-0" />
                                <span>{s.magistrado_a}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <ChevronDown
                          size={18}
                          strokeWidth={1.75}
                          className={
                            'shrink-0 mt-1 text-slate transition-transform ' +
                            (expandido ? 'rotate-180' : '')
                          }
                        />
                      </div>

                      {s.resumen_ia && !expandido && (
                        <p className="mt-3 pt-3 border-t border-line text-sm text-ink line-clamp-2">
                          {s.resumen_ia}
                        </p>
                      )}
                    </button>

                    {expandido && (
                      <div className="border-t border-line p-5 space-y-5 text-sm">
                        <table className="w-full">
                          <tbody className="divide-y divide-line">
                            <tr>
                              <td className="py-1.5 text-slate w-40">Proceso</td>
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
                              <td className="py-1.5">
                                {s.sv_spv ?? 'no disponible en la fuente consultada'}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-slate">Aclaraciones de voto</td>
                              <td className="py-1.5">
                                {s.av_apv ?? 'no disponible en la fuente consultada'}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <div>
                          <h3 className="font-display text-base mb-2">Análisis</h3>

                          {!s.resumen_ia && !s.texto_completo_no_disponible && (
                            <button
                              onClick={() => handleGenerarAnalisis(s.id)}
                              disabled={generando[s.id]}
                              className="inline-flex items-center gap-1.5 btn-primary btn-sm"
                            >
                              {generando[s.id] ? (
                                <>
                                  <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
                                  Generando…
                                </>
                              ) : (
                                <>
                                  <Sparkles size={14} strokeWidth={1.75} />
                                  Generar análisis con IA
                                </>
                              )}
                            </button>
                          )}

                          {s.texto_completo_no_disponible && !s.texto_completo_url && (
                            <div className="text-slate space-y-2">
                              <p className="inline-flex items-center gap-1.5 text-seal">
                                <AlertCircle size={14} strokeWidth={1.75} />
                                No se pudo localizar el texto completo en el sitio oficial.
                              </p>
                              <button
                                onClick={() => handleLocalizarTexto(s.id)}
                                className="link"
                              >
                                Reintentar localización
                              </button>
                            </div>
                          )}

                          {errorGeneracion[s.id] && (
                            <p className="inline-flex items-center gap-1.5 text-seal mt-2">
                              <AlertCircle size={14} strokeWidth={1.75} />
                              {errorGeneracion[s.id]}
                            </p>
                          )}

                          {s.resumen_ia && (
                            <div className="space-y-4 mt-3">
                              <p>
                                {s.resumen_ia_verificado ? (
                                  <span className="inline-flex items-center gap-1.5 text-slate">
                                    <ShieldCheck size={14} strokeWidth={1.75} />
                                    Verificado por el despacho
                                  </span>
                                ) : (
                                  <span className="inline-flex flex-wrap items-center gap-1.5 text-seal">
                                    <Sparkles size={14} strokeWidth={1.75} />
                                    Generado por IA · pendiente de verificación —{' '}
                                    <button
                                      onClick={() => handleVerificar(s.id)}
                                      className="underline underline-offset-4"
                                    >
                                      marcar como verificado
                                    </button>
                                  </span>
                                )}
                              </p>
                              <Seccion titulo="Resumen" texto={s.resumen_ia} />
                              <Seccion titulo="Hechos" texto={s.hechos_ia} />
                              <Seccion titulo="Problema jurídico" texto={s.problema_juridico_ia} />
                              <Seccion titulo="Consideraciones relevantes" texto={s.consideraciones_ia} />
                              <Seccion titulo="Decisión" texto={s.decision_ia} />
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="font-display text-base mb-2">Texto completo</h3>
                          {s.texto_completo_url ? (
                            <>
                              {cargandoTextoId === s.id && <p className="text-slate">Cargando…</p>}
                              {errorTextoPorId[s.id] && (
                                <p className="text-seal mb-2">{errorTextoPorId[s.id]}</p>
                              )}
                              {htmlPorId[s.id] && (
                                <div
                                  className="texto-oficial max-h-96 overflow-y-auto pr-2"
                                  dangerouslySetInnerHTML={{ __html: htmlPorId[s.id] }}
                                />
                              )}
                              <a
                                href={s.texto_completo_url}
                                target="_blank"
                                rel="noreferrer"
                                className="link mt-3 inline-block"
                              >
                                Ver en el sitio oficial
                              </a>
                            </>
                          ) : (
                            <p className="text-slate">
                              {s.texto_completo_no_disponible
                                ? 'No disponible.'
                                : 'Aún no se ha localizado el texto completo de esta sentencia.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}

            {buscado && resultados.length === 0 && (
              <li className="py-4 text-sm text-slate">Sin resultados para esta búsqueda.</li>
            )}
            {!buscado && !buscando && (
              <li className="py-4 text-sm text-slate">
                Busca por número de sentencia, magistrado, sala o texto libre.
              </li>
            )}
          </ul>
        </section>

        <aside className="space-y-4">
          <h2 className="font-display text-lg mb-2">Su actividad</h2>

          <div className="card p-4">
            <p className="inline-flex items-center gap-1.5 text-sm text-slate mb-1">
              <ShieldCheck size={14} strokeWidth={1.75} />
              Verificaciones pendientes
            </p>
            <p className="text-2xl font-display">
              {verificacionesPendientes === null ? '—' : verificacionesPendientes}
            </p>
          </div>

          <div className="card p-4">
            <p className="inline-flex items-center gap-1.5 text-sm text-slate mb-2">
              <Clock3 size={14} strokeWidth={1.75} />
              Plazos próximos
            </p>
            <ul className="text-sm space-y-1">
              {plazosProximos.map((p) => {
                const dias = diasRestantes(p.fecha_vencimiento)
                return (
                  <li key={p.id}>
                    <Link to={`/casos/${p.caso_id}`} className="hover:underline">
                      {p.titulo}
                    </Link>{' '}
                    <span className="text-slate">— {dias <= 0 ? 'hoy o vencido' : `${dias} días`}</span>
                  </li>
                )
              })}
              {plazosProximos.length === 0 && <li className="text-slate">Sin plazos pendientes.</li>}
            </ul>
          </div>

          <div className="card p-4">
            <p className="inline-flex items-center gap-1.5 text-sm text-slate mb-2">
              <FolderOpen size={14} strokeWidth={1.75} />
              Casos abiertos
            </p>
            <ul className="text-sm space-y-1">
              {casosAbiertos.map((c) => (
                <li key={c.id}>
                  <Link to={`/casos/${c.id}`} className="hover:underline">
                    {c.titulo}
                  </Link>{' '}
                  <span className="text-slate">— {c.estado}</span>
                </li>
              ))}
              {casosAbiertos.length === 0 && <li className="text-slate">Sin casos abiertos.</li>}
            </ul>
          </div>
        </aside>
      </main>
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
