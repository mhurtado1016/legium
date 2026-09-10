import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useUsuario } from '../lib/useUsuario'
import {
  generarAnalisisIA,
  localizarTexto,
  obtenerSentencia,
  verificarResumen,
  type Sentencia,
} from '../lib/sentencias'

/**
 * Ficha de una sentencia: metadatos verificados de la API, análisis IA
 * (con su estado de verificación) y visor embebido del texto completo
 * en el sitio oficial, cuando está disponible.
 */
export function SentenciaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useUsuario()
  const [sentencia, setSentencia] = useState<Sentencia | null>(null)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cargar() {
    if (!id) return
    const s = await obtenerSentencia(id)
    setSentencia(s)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleGenerarAnalisis() {
    if (!id) return
    setError(null)
    setGenerando(true)
    try {
      const r = await generarAnalisisIA(id)
      if (!r.ok) {
        setError(
          r.motivo === 'texto_completo_no_disponible' || r.motivo === 'url_construida_no_responde'
            ? 'No se pudo localizar el texto completo de esta sentencia en el sitio oficial.'
            : 'No se pudo generar el análisis.',
        )
      }
      await cargar()
    } catch {
      setError('No se pudo generar el análisis.')
    } finally {
      setGenerando(false)
    }
  }

  async function handleLocalizarTexto() {
    if (!id) return
    setError(null)
    try {
      await localizarTexto(id)
      await cargar()
    } catch {
      setError('No se pudo localizar el texto completo.')
    }
  }

  async function handleVerificar() {
    if (!id || !usuario || !sentencia) return
    await verificarResumen(id, usuario.firma_id, usuario.id)
    setSentencia({ ...sentencia, resumen_ia_verificado: true })
  }

  if (!sentencia) return null

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />

      <main className="px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8 max-w-6xl">
        <div>
          <h1 className="font-display text-xl mb-1">{sentencia.sentencia}</h1>
          <p className="text-sm text-slate mb-4">
            {sentencia.sala ?? 'Sala no especificada'}
            {sentencia.fecha_sentencia &&
              ` · ${new Date(sentencia.fecha_sentencia).toLocaleDateString('es-CO')}`}
          </p>

          <table className="w-full text-sm mb-6">
            <tbody className="divide-y divide-line">
              <tr>
                <td className="py-1.5 text-slate w-40">Proceso</td>
                <td className="py-1.5">{sentencia.proceso ?? '—'}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate">Expediente</td>
                <td className="py-1.5">
                  {sentencia.expediente_tipo ?? '—'} {sentencia.expediente_numero ?? ''}
                </td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate">Magistrado(a)</td>
                <td className="py-1.5">{sentencia.magistrado_a ?? '—'}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate">Salvamentos de voto</td>
                <td className="py-1.5">{sentencia.sv_spv ?? 'no disponible en la fuente consultada'}</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate">Aclaraciones de voto</td>
                <td className="py-1.5">{sentencia.av_apv ?? 'no disponible en la fuente consultada'}</td>
              </tr>
            </tbody>
          </table>

          <hr className="border-line mb-4" />

          <h2 className="font-display text-base mb-2">Análisis</h2>

          {!sentencia.resumen_ia && !sentencia.texto_completo_no_disponible && (
            <button
              onClick={handleGenerarAnalisis}
              disabled={generando}
              className="bg-ink text-paper-raised px-4 py-1.5 text-sm hover:bg-ink/90 disabled:opacity-60"
            >
              {generando ? 'Generando…' : 'Generar análisis con IA'}
            </button>
          )}

          {sentencia.texto_completo_no_disponible && !sentencia.texto_completo_url && (
            <div className="text-sm text-slate space-y-2">
              <p>No se pudo localizar el texto completo de esta sentencia en el sitio oficial.</p>
              <button onClick={handleLocalizarTexto} className="underline underline-offset-4">
                Reintentar localización
              </button>
            </div>
          )}

          {error && <p className="text-sm text-seal mt-2">{error}</p>}

          {sentencia.resumen_ia && (
            <div className="text-sm space-y-4 mt-4">
              <p>
                {sentencia.resumen_ia_verificado ? (
                  <span className="text-slate">Verificado por el despacho.</span>
                ) : (
                  <span className="text-seal">
                    Generado por IA · pendiente de verificación —{' '}
                    <button onClick={handleVerificar} className="underline underline-offset-4">
                      marcar como verificado
                    </button>
                  </span>
                )}
              </p>
              <Seccion titulo="Resumen" texto={sentencia.resumen_ia} />
              <Seccion titulo="Hechos" texto={sentencia.hechos_ia} />
              <Seccion titulo="Problema jurídico" texto={sentencia.problema_juridico_ia} />
              <Seccion titulo="Consideraciones relevantes" texto={sentencia.consideraciones_ia} />
              <Seccion titulo="Decisión" texto={sentencia.decision_ia} />
            </div>
          )}
        </div>

        <div>
          <h2 className="font-display text-base mb-2">Texto completo</h2>
          {sentencia.texto_completo_url ? (
            <>
              <iframe
                src={sentencia.texto_completo_url}
                title={`Texto completo de ${sentencia.sentencia}`}
                className="w-full border border-line"
                style={{ height: '75vh' }}
              />
              <a
                href={sentencia.texto_completo_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-slate hover:text-ink underline underline-offset-4 mt-2 inline-block"
              >
                Abrir en una pestaña nueva
              </a>
            </>
          ) : (
            <p className="text-sm text-slate">
              {sentencia.texto_completo_no_disponible
                ? 'No disponible.'
                : 'Aún no se ha localizado el texto completo de esta sentencia.'}
            </p>
          )}
        </div>
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
