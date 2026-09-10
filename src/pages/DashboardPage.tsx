import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useUsuario } from '../lib/useUsuario'
import {
  buscarSentencias,
  contarVerificacionesPendientes,
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
  const { signOut } = useAuth()
  const { usuario } = useUsuario()

  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState<Sentencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificacionesPendientes, setVerificacionesPendientes] = useState<number | null>(null)

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

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <h1 className="text-xl font-display">Legium</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/casos" className="text-slate hover:text-ink underline underline-offset-4">
            Casos
          </Link>
          <Link to="/plazos" className="text-slate hover:text-ink underline underline-offset-4">
            Plazos
          </Link>
          <Link to="/facturacion" className="text-slate hover:text-ink underline underline-offset-4">
            Facturación
          </Link>
          <button
            onClick={() => signOut()}
            className="text-slate hover:text-ink underline underline-offset-4"
          >
            Cerrar sesión
          </button>
        </nav>
      </header>

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
                  <p className="text-sm mt-2">
                    {s.resumen_ia_verificado ? (
                      <span className="text-slate">Resumen IA · verificado</span>
                    ) : (
                      <span className="text-seal">
                        Resumen IA · pendiente de verificación{' '}
                        <button
                          onClick={() => handleVerificar(s.id)}
                          className="underline underline-offset-4"
                        >
                          marcar como verificado
                        </button>
                      </span>
                    )}
                  </p>
                )}

                {!s.resumen_ia && s.texto_completo_no_disponible && (
                  <p className="text-sm text-slate mt-2">
                    Análisis no disponible: no se pudo obtener el texto completo.
                  </p>
                )}
              </li>
            ))}

            {!buscando && resultados.length === 0 && (
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
