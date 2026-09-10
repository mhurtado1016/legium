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
  const [resultados, setResultados] = useState<Sentencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificacionesPendientes, setVerificacionesPendientes] = useState<number | null>(null)
  const [generando, setGenerando] = useState<Record<string, boolean>>({})
  const [errorGeneracion, setErrorGeneracion] = useState<Record<string, string>>({})

  useEffect(() => {
    contarVerificacionesPendientes().then(setVerificacionesPendientes).catch(() => {})
  }, [])

  async function handleBuscar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBuscando(true)
    try {
      const { resultados } = await buscarSentencias({ texto })
      setResultados(resultados)
      setBuscado(true)
    } catch {
      setError('No se pudo completar la búsqueda. Intenta de nuevo.')
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
    } catch {
      setErrorGeneracion((prev) => ({ ...prev, [sentenciaId]: 'No se pudo generar el análisis.' }))
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
          <form onSubmit={handleBuscar} className="flex gap-2 mb-6">
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Número, magistrado, sala, texto libre…"
              className="flex-1 border border-line bg-paper-raised px-3 py-2"
            />
            <button
              type="submit"
              disabled={buscando}
              className="bg-ink text-paper-raised px-5 py-2 hover:bg-ink/90 disabled:opacity-60"
            >
              {buscando ? 'Buscando…' : 'Ir'}
            </button>
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
                        className="text-slate hover:text-ink underline underline-offset-4 disabled:opacity-60"
                      >
                        {generando[s.id] ? 'Generando…' : 'Generar análisis con IA'}
                      </button>
                    )}
                  </div>
                )}

                <Link
                  to={`/sentencias/${s.id}`}
                  className="text-sm text-slate hover:text-ink underline underline-offset-4 mt-2 inline-block"
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
          <div className="border-t border-line pt-3">
            <p className="text-sm text-slate mb-1">Verificaciones pendientes</p>
            <p className="text-2xl">
              {verificacionesPendientes === null ? '—' : verificacionesPendientes}
            </p>
          </div>
          <p className="text-sm text-slate mt-6">
            Plazos próximos y casos abiertos se incorporan en las Fases 2 y 3.
          </p>
        </aside>
      </main>
    </div>
  )
}
