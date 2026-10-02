import { useEffect, useState } from 'react'
import { AlertCircle, Calendar, ChevronDown, Loader2, Scale, Sparkles, User, X } from 'lucide-react'
import {
  generarAnalisisIA,
  localizarTexto,
  obtenerSentenciaPorId,
  obtenerTextoCompleto,
  type Sentencia,
} from '../lib/sentencias'

/**
 * Detalle de una sentencia (datos del expediente, análisis de IA y texto
 * completo). Lo comparten el buscador flotante y el modal que se abre
 * desde las sentencias vinculadas de un caso.
 */
export function DetalleSentencia({
  sentencia,
  onActualizar,
}: {
  sentencia: Sentencia
  onActualizar?: (s: Sentencia) => void
}) {
  const [s, setS] = useState(sentencia)
  const [generando, setGenerando] = useState(false)
  const [errorGeneracion, setErrorGeneracion] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [cargandoTexto, setCargandoTexto] = useState(false)
  const [errorTexto, setErrorTexto] = useState<string | null>(null)
  const [textoVisible, setTextoVisible] = useState(false)
  const [analisisVisible, setAnalisisVisible] = useState(true)

  function actualizar(nueva: Sentencia) {
    setS(nueva)
    onActualizar?.(nueva)
  }

  useEffect(() => {
    if (!s.texto_completo_url || html) return
    setCargandoTexto(true)
    obtenerTextoCompleto(s.texto_completo_url)
      .then((r) => {
        setHtml(r.html)
        setTextoVisible(true)
      })
      .catch((err) => setErrorTexto(err instanceof Error ? err.message : JSON.stringify(err)))
      .finally(() => setCargandoTexto(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.texto_completo_url])

  async function handleLocalizarTexto() {
    setErrorGeneracion(null)
    try {
      const r = await localizarTexto(s.id)
      if (!r.ok) {
        setErrorGeneracion(`${r.motivo ?? 'No se pudo localizar el texto.'}${r.detalle ? ` (${r.detalle})` : ''}`)
        return
      }
      actualizar({ ...s, texto_completo_url: r.url ?? s.texto_completo_url, texto_completo_no_disponible: false })
    } catch (err) {
      setErrorGeneracion(err instanceof Error ? err.message : JSON.stringify(err))
    }
  }

  async function handleGenerarAnalisis() {
    setGenerando(true)
    setErrorGeneracion(null)
    try {
      const r = await generarAnalisisIA(s.id)
      if (!r.ok) {
        const base =
          r.motivo === 'texto_completo_no_disponible' || r.motivo === 'url_construida_no_responde'
            ? 'No se pudo generar el análisis: no se encontró el texto completo en el sitio oficial.'
            : `No se pudo generar el análisis (${r.motivo ?? 'motivo desconocido'}).`
        setErrorGeneracion(r.detalle ? `${base} ${r.detalle}` : base)
      } else {
        actualizar({
          ...s,
          demandante_ia: r.analisis?.demandante ?? s.demandante_ia,
          demandado_ia: r.analisis?.demandado ?? s.demandado_ia,
          motivo_ia: r.analisis?.motivo ?? s.motivo_ia,
          resumen_ia: r.analisis?.resumen ?? s.resumen_ia,
          hechos_ia: r.analisis?.hechos ?? s.hechos_ia,
          problema_juridico_ia: r.analisis?.problema_juridico ?? s.problema_juridico_ia,
          consideraciones_ia: r.analisis?.consideraciones_relevantes ?? s.consideraciones_ia,
          decision_ia: r.analisis?.decision ?? s.decision_ia,
        })
        setAnalisisVisible(true)
      }
    } catch (err) {
      setErrorGeneracion(err instanceof Error ? err.message : JSON.stringify(err))
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="p-4 space-y-4 text-sm">
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
            onClick={() => setAnalisisVisible((v) => !v)}
            className="flex items-center gap-1.5 hover:text-ink transition-colors"
          >
            <h3 className="font-display text-base">Análisis</h3>
            {s.resumen_ia && (
              <ChevronDown
                size={16}
                strokeWidth={1.75}
                className={'text-slate transition-transform ' + (analisisVisible ? 'rotate-180' : '')}
              />
            )}
          </button>
          <button
            onClick={handleGenerarAnalisis}
            disabled={generando}
            className={'inline-flex items-center gap-1.5 disabled:opacity-50 ' + (s.resumen_ia ? 'link text-sm' : 'btn-primary btn-sm')}
          >
            {generando ? (
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
              No se pudo localizar la sentencia completa en el sitio oficial la última vez. El botón de
              arriba lo vuelve a intentar.
            </p>
            <button onClick={handleLocalizarTexto} className="link">
              Reintentar solo la localización
            </button>
          </div>
        )}

        {errorGeneracion && (
          <p className="inline-flex items-center gap-1.5 text-danger mb-3">
            <AlertCircle size={14} strokeWidth={1.75} />
            {errorGeneracion}
          </p>
        )}

        {s.resumen_ia && analisisVisible && (
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
          onClick={() => setTextoVisible((v) => !v)}
          disabled={!html}
          className="flex items-center gap-1.5 hover:text-ink transition-colors mb-2 disabled:cursor-default disabled:hover:text-ink"
        >
          <h3 className="font-display text-base">Sentencia completa</h3>
          {html && (
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              className={'text-slate transition-transform ' + (textoVisible ? 'rotate-180' : '')}
            />
          )}
        </button>
        {s.texto_completo_url ? (
          <>
            {cargandoTexto && <p className="text-slate">Cargando…</p>}
            {errorTexto && <p className="text-danger mb-2">{errorTexto}</p>}
            {html && textoVisible && (
              <div className="texto-oficial max-h-72 overflow-y-auto pr-2" dangerouslySetInnerHTML={{ __html: html }} />
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

/** Modal con el detalle de una sentencia ya vinculada a un caso. */
export function SentenciaDetalleModal({ sentenciaId, onClose }: { sentenciaId: string; onClose: () => void }) {
  const [sentencia, setSentencia] = useState<Sentencia | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    obtenerSentenciaPorId(sentenciaId)
      .then(setSentencia)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo cargar la sentencia.'))
  }, [sentenciaId])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-raised)] animate-in overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-line shrink-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <Scale size={18} strokeWidth={1.75} className="text-slate shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-ink">
                {sentencia ? sentencia.sentencia : 'Sentencia'}
                {sentencia && <span className="text-slate font-normal"> · {sentencia.sala ?? 'Sala no especificada'}</span>}
              </p>
              {sentencia && (
                <p className="flex items-center flex-wrap gap-x-3 text-xs text-slate mt-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={12} strokeWidth={1.75} />
                    {sentencia.fecha_sentencia ? new Date(sentencia.fecha_sentencia).toLocaleDateString('es-CO') : '—'}
                  </span>
                  {sentencia.magistrado_a && (
                    <span className="inline-flex items-center gap-1.5">
                      <User size={12} strokeWidth={1.75} />
                      {sentencia.magistrado_a}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 -m-1.5 rounded-md text-slate hover:text-ink hover:bg-paper-sunken transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && <p className="p-4 text-sm text-danger">{error}</p>}
          {!sentencia && !error && (
            <p className="p-4 text-sm text-slate inline-flex items-center gap-2">
              <Loader2 size={14} strokeWidth={1.75} className="animate-spin" />
              Cargando…
            </p>
          )}
          {sentencia && <DetalleSentencia sentencia={sentencia} />}
        </div>
      </div>
    </div>
  )
}
