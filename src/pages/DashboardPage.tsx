import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useUsuario } from '../lib/useUsuario'
import {
  buscarSentencias,
  contarVerificacionesPendientes,
  generarAnalisisIA,
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
        setErrorGeneracion((prev) => ({
          ...prev,
          [sentenciaId]:
            r.motivo === 'texto_completo_no_disponible' || r.motivo === 'url_construida_no_responde'
              ? 'No se pudo generar el análisis: no se encontró el texto completo en el sitio oficial.'
              : 'No se pudo generar el análisis.',
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

          <ul className="divide-y divide-line border-t border-b border-line">
            {resultados.map((s) => (
              <li key={s.id} className="py-4">
                <p className="font-medium">
                  {s.sentencia} · {s.sala ?? 'Sala no especificada'}
                </p>
                <p className="text-sm text-slate">
                  {s.fecha_sentencia ? new Date(s.fecha_sentencia).toLocaleDateString('es-CO') : '—'}
                  {s.magistrado_a ? ` · ${s.magistrado_a}` : ''}
                </p>

                {s.resumen_ia && (
                  <div className="text-sm mt-2 space-y-1">
                    <p>{s.resumen_ia}</p>
                    {s.resumen_ia_verificado ? (
                      <p className="text-slate">Resumen IA · verificado</p>
                    ) : (
                      <p className="text-seal">
                        Resumen IA · pendiente de verificación{' '}
                        <button
                          onClick={() => handleVerificar(s.id)}
                          className="underline underline-offset-4"
                        >
                          marcar como verificado
                        </button>
                      </p>
                    )}
                  </div>
                )}

                {!s.resumen_ia && (
                  <div className="text-sm mt-2">
                    {errorGeneracion[s.id] ? (
                      <p className="text-seal">{errorGeneracion[s.id]}</p>
                    ) : s.texto_completo_no_disponible ? (
                      <p className="text-seal">
                        No se pudo generar el análisis: no se encontró el texto completo en el sitio
                        oficial.
                      </p>
                    ) : (
                      <button
                        onClick={() => handleGenerarAnalisis(s.id)}
                        disabled={generando[s.id]}
                        className="link disabled:opacity-50"
                      >
                        {generando[s.id] ? 'Generando…' : 'Generar análisis con IA'}
                      </button>
                    )}
                  </div>
                )}

                <Link
                  to={`/sentencias/${encodeURIComponent(s.sentencia)}`}
                  className="link text-sm mt-2 inline-block"
                >
                  ver detalle
                </Link>
              </li>
            ))}

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

        <aside>
          <h2 className="font-display text-lg mb-2">Su actividad</h2>

          <div className="border-t border-line pt-3 mb-6">
            <p className="text-sm text-slate mb-1">Verificaciones pendientes</p>
            <p className="text-2xl">
              {verificacionesPendientes === null ? '—' : verificacionesPendientes}
            </p>
          </div>

          <div className="border-t border-line pt-3 mb-6">
            <p className="text-sm text-slate mb-2">Plazos próximos</p>
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

          <div className="border-t border-line pt-3">
            <p className="text-sm text-slate mb-2">Casos abiertos</p>
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
