import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Bot, FileDown, Loader2, Paperclip, Send, User, X } from 'lucide-react'
import { useUsuario } from '../lib/useUsuario'
import { listarCasos, type Caso } from '../lib/casos'
import { listarCategorias, subirDocumento, type CategoriaDocumento } from '../lib/documentos'
import {
  MAX_ARCHIVOS_SOPORTE,
  TIPOS_PERMITIDOS_SOPORTE_IA,
  actualizarContenidoGenerado,
  crearConversacion,
  eliminarArchivoSoporte,
  enviarMensaje,
  exportarConversacion,
  listarConversaciones,
  listarTiposDocumento,
  obtenerConversacion,
  subirArchivoSoporte,
  urlDescargaIA,
  type ArchivoGeneradoIA,
  type ArchivoSoporteIA,
  type ConversacionIA,
  type MensajeIA,
  type TipoDocumentoLegal,
} from '../lib/documentosIA'
import { DocumentoPreviewModal } from './DocumentoPreviewModal'

// Formato ligero para los mensajes del chat (no es un parser de markdown
// completo, solo el subconjunto que de verdad usa Mañecito: encabezados
// "# "/"## ", viñetas "- ", listas numeradas "1. " y **negrita**). Se
// devuelven elementos de React directamente, nunca HTML crudo, así que no
// hay riesgo de inyección con lo que responda el modelo.
function formatearEnLinea(texto: string): ReactNode {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  return partes.map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={i} className="font-semibold">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  )
}

function formatearMensaje(texto: string): ReactNode {
  const lineas = texto.split('\n')
  const bloques: ReactNode[] = []
  let parrafo: string[] = []
  let lista: { tipo: 'ul' | 'ol'; items: string[] } | null = null

  function cerrarParrafo() {
    if (parrafo.length > 0) {
      bloques.push(<p key={bloques.length}>{formatearEnLinea(parrafo.join(' '))}</p>)
      parrafo = []
    }
  }
  function cerrarLista() {
    if (lista) {
      const items = lista.items
      bloques.push(
        lista.tipo === 'ul' ? (
          <ul key={bloques.length} className="list-disc pl-4 space-y-0.5">
            {items.map((item, i) => (
              <li key={i}>{formatearEnLinea(item)}</li>
            ))}
          </ul>
        ) : (
          <ol key={bloques.length} className="list-decimal pl-4 space-y-0.5">
            {items.map((item, i) => (
              <li key={i}>{formatearEnLinea(item)}</li>
            ))}
          </ol>
        ),
      )
      lista = null
    }
  }

  for (const linea of lineas) {
    const t = linea.trim()
    if (!t) {
      cerrarParrafo()
      cerrarLista()
      continue
    }
    const header = t.match(/^(#{1,3})\s+(.*)/)
    const vineta = t.match(/^[-*]\s+(.*)/)
    const numerada = t.match(/^\d+\.\s+(.*)/)
    if (header) {
      cerrarParrafo()
      cerrarLista()
      bloques.push(
        <p key={bloques.length} className={header[1].length === 1 ? 'font-semibold' : 'font-medium'}>
          {formatearEnLinea(header[2])}
        </p>,
      )
    } else if (vineta) {
      cerrarParrafo()
      if (lista?.tipo !== 'ul') {
        cerrarLista()
        lista = { tipo: 'ul', items: [] }
      }
      lista.items.push(vineta[1])
    } else if (numerada) {
      cerrarParrafo()
      if (lista?.tipo !== 'ol') {
        cerrarLista()
        lista = { tipo: 'ol', items: [] }
      }
      lista.items.push(numerada[1])
    } else {
      cerrarLista()
      parrafo.push(t)
    }
  }
  cerrarParrafo()
  cerrarLista()

  return <div className="space-y-1.5">{bloques}</div>
}

/**
 * Asistente de redacción de documentos jurídicos con IA (chat de varios
 * turnos). Se usa tanto como botón flotante dentro de un caso (`casoId`
 * fijo) como desde la página independiente /app/documentos-ia (sin
 * `casoId`, con selector de caso opcional).
 */
export function AsistenteDocumentosIA({
  casoId,
  conversacionInicialId,
  onClose,
}: {
  casoId?: string
  conversacionInicialId?: string
  onClose: () => void
}) {
  const { usuario } = useUsuario()

  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [tipos, setTipos] = useState<TipoDocumentoLegal[]>([])
  const [casos, setCasos] = useState<Caso[]>([])
  const [conversacionesPrevias, setConversacionesPrevias] = useState<ConversacionIA[]>([])

  const [conversacion, setConversacion] = useState<ConversacionIA | null>(null)
  const [mensajes, setMensajes] = useState<MensajeIA[]>([])
  const [archivosSoporte, setArchivosSoporte] = useState<ArchivoSoporteIA[]>([])
  const [archivosGenerados, setArchivosGenerados] = useState<ArchivoGeneradoIA[]>([])

  const [tipoSeleccionado, setTipoSeleccionado] = useState('')
  const [casoSeleccionado, setCasoSeleccionado] = useState('')
  const [iniciando, setIniciando] = useState(false)

  const [textoMensaje, setTextoMensaje] = useState('')
  const [archivoIdsPendientes, setArchivoIdsPendientes] = useState<string[]>([])
  const [adjuntando, setAdjuntando] = useState(false)
  const [eliminandoArchivoId, setEliminandoArchivoId] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const [contenidoEditado, setContenidoEditado] = useState('')
  const [guardandoContenido, setGuardandoContenido] = useState(false)
  const [exportando, setExportando] = useState<'docx' | 'pdf' | null>(null)
  const [previsualizando, setPrevisualizando] = useState<{ storagePath: string; mimeType: string | null; nombre: string } | null>(null)

  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [categoriaParaGuardar, setCategoriaParaGuardar] = useState('')
  const [guardandoEnCaso, setGuardandoEnCaso] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const finTranscriptRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function cargarInicial() {
      setCargandoInicial(true)
      try {
        const [t, conv] = await Promise.all([listarTiposDocumento(), listarConversaciones(casoId)])
        setTipos(t.filter((x) => x.activo))
        setConversacionesPrevias(conv)
        if (!casoId) {
          const c = await listarCasos()
          setCasos(c)
        }
        if (conversacionInicialId) {
          await abrirConversacion(conversacionInicialId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el asistente.')
      } finally {
        setCargandoInicial(false)
      }
    }
    cargarInicial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    finTranscriptRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function abrirConversacion(id: string) {
    const datos = await obtenerConversacion(id)
    setConversacion(datos.conversacion)
    setMensajes(datos.mensajes)
    setArchivosSoporte(datos.archivosSoporte)
    setArchivosGenerados(datos.archivosGenerados)
    setContenidoEditado(datos.conversacion.contenido_generado ?? '')
  }

  async function handleIniciarConversacion() {
    if (!usuario || !tipoSeleccionado) return
    setIniciando(true)
    setError(null)
    try {
      const tipo = tipos.find((t) => t.id === tipoSeleccionado)
      const casoElegido = casoId ?? (casoSeleccionado || undefined)
      const caso = casos.find((c) => c.id === casoElegido)
      const titulo = caso ? `${tipo?.nombre ?? 'Documento'} — ${caso.titulo}` : `${tipo?.nombre ?? 'Documento'} — ${new Date().toLocaleDateString('es-CO')}`
      const nueva = await crearConversacion({
        firmaId: usuario.firma_id,
        usuarioId: usuario.id,
        tipoDocumentoId: tipoSeleccionado,
        titulo,
        casoId: casoElegido,
      })
      setConversacion(nueva)
      setMensajes([])
      setArchivosSoporte([])
      setArchivosGenerados([])
      setContenidoEditado('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la conversación.')
    } finally {
      setIniciando(false)
    }
  }

  async function handleAdjuntar(file: File) {
    if (!usuario || !conversacion) return
    setAdjuntando(true)
    setError(null)
    try {
      const archivo = await subirArchivoSoporte({ file, firmaId: usuario.firma_id, conversacionId: conversacion.id, usuarioId: usuario.id })
      setArchivosSoporte((prev) => [...prev, archivo])
      setArchivoIdsPendientes((prev) => [...prev, archivo.id])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo adjuntar el archivo.')
    } finally {
      setAdjuntando(false)
    }
  }

  async function handleEliminarArchivo(archivo: ArchivoSoporteIA) {
    if (!window.confirm(`¿Quitar "${archivo.nombre_archivo}" de los archivos adjuntos? Esta acción no se puede deshacer.`)) return
    setEliminandoArchivoId(archivo.id)
    setError(null)
    try {
      await eliminarArchivoSoporte(archivo)
      setArchivosSoporte((prev) => prev.filter((a) => a.id !== archivo.id))
      setArchivoIdsPendientes((prev) => prev.filter((id) => id !== archivo.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar el archivo.')
    } finally {
      setEliminandoArchivoId(null)
    }
  }

  async function handleEnviar(e: FormEvent) {
    e.preventDefault()
    if (!conversacion || (!textoMensaje.trim() && archivoIdsPendientes.length === 0) || enviando) return
    const texto = textoMensaje.trim() || 'Adjunto el archivo.'
    const archivosDelTurno = archivoIdsPendientes

    // Optimista: el mensaje del usuario aparece de inmediato en la
    // conversación, sin esperar la respuesta de la IA — se reemplaza por
    // la fila real al recargar la conversación al final.
    const mensajeOptimista: MensajeIA = {
      id: `optimista-${Date.now()}`,
      conversacion_id: conversacion.id,
      rol: 'usuario',
      contenido: texto,
      created_at: new Date().toISOString(),
    }
    setMensajes((prev) => [...prev, mensajeOptimista])
    setTextoMensaje('')
    setArchivoIdsPendientes([])
    setEnviando(true)
    setError(null)
    try {
      await enviarMensaje(conversacion.id, texto, archivosDelTurno)
      await abrirConversacion(conversacion.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.')
      setMensajes((prev) => prev.filter((m) => m.id !== mensajeOptimista.id))
      setTextoMensaje(texto)
      setArchivoIdsPendientes(archivosDelTurno)
    } finally {
      setEnviando(false)
    }
  }

  async function handleGuardarBorrador() {
    if (!conversacion) return
    setGuardandoContenido(true)
    try {
      await actualizarContenidoGenerado(conversacion.id, contenidoEditado)
      setConversacion({ ...conversacion, contenido_generado: contenidoEditado })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el borrador.')
    } finally {
      setGuardandoContenido(false)
    }
  }

  async function handleExportar(formato: 'docx' | 'pdf') {
    if (!conversacion) return
    setExportando(formato)
    setError(null)
    try {
      const { archivo } = await exportarConversacion(conversacion.id, formato)
      setArchivosGenerados((prev) => [archivo, ...prev])
      if (formato === 'pdf') {
        setPrevisualizando({ storagePath: archivo.storage_path, mimeType: archivo.mime_type, nombre: archivo.nombre_archivo })
      } else {
        const url = await urlDescargaIA(archivo.storage_path)
        window.open(url, '_blank')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo exportar el documento.')
    } finally {
      setExportando(null)
    }
  }

  async function handleGuardarEnCaso(archivo: ArchivoGeneradoIA) {
    const casoDestino = casoId ?? conversacion?.caso_id
    if (!usuario || !casoDestino) return
    setGuardandoEnCaso(archivo.id)
    setError(null)
    try {
      let categoriasDisponibles = categorias
      if (categoriasDisponibles.length === 0) {
        categoriasDisponibles = await listarCategorias()
        setCategorias(categoriasDisponibles)
      }
      const categoriaId = categoriaParaGuardar || categoriasDisponibles[0]?.id
      if (!categoriaId) throw new Error('No hay categorías de documento configuradas.')
      if (!categoriaParaGuardar) setCategoriaParaGuardar(categoriaId)

      const url = await urlDescargaIA(archivo.storage_path)
      const resp = await fetch(url)
      const blob = await resp.blob()
      const file = new File([blob], archivo.nombre_archivo, { type: archivo.mime_type ?? blob.type })
      await subirDocumento({
        file,
        firmaId: usuario.firma_id,
        casoId: casoDestino,
        usuarioId: usuario.id,
        categoriaId,
        nombre: conversacion?.titulo ?? archivo.nombre_archivo,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la copia en el caso.')
    } finally {
      setGuardandoEnCaso(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-3xl h-[85vh] flex flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-raised)] animate-in overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Bot size={18} strokeWidth={1.75} className="text-slate shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm text-ink truncate">Mañecito</p>
              <p className="text-xs text-slate truncate">
                {conversacion ? conversacion.titulo : 'Tu asistente para redactar documentos jurídicos'}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 -m-1.5 rounded-md text-slate hover:text-ink hover:bg-paper-sunken transition-colors">
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="px-5 py-2 text-sm text-danger border-b border-line bg-paper-sunken shrink-0">{error}</p>
        )}

        {cargandoInicial ? (
          <p className="flex-1 flex items-center justify-center text-sm text-slate gap-2">
            <Loader2 size={16} className="animate-spin" strokeWidth={1.75} /> Cargando…
          </p>
        ) : !conversacion ? (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            <div className="space-y-3">
              <p className="eyebrow">Nueva conversación</p>
              <label className="block">
                <span className="block text-sm text-slate mb-1">Tipo de documento</span>
                <select value={tipoSeleccionado} onChange={(e) => setTipoSeleccionado(e.target.value)} className="w-full field field-sm">
                  <option value="">Selecciona un tipo…</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </label>
              {!casoId && (
                <label className="block">
                  <span className="block text-sm text-slate mb-1">Caso (opcional)</span>
                  <select value={casoSeleccionado} onChange={(e) => setCasoSeleccionado(e.target.value)} className="w-full field field-sm">
                    <option value="">Sin caso asociado</option>
                    {casos.map((c) => (
                      <option key={c.id} value={c.id}>{c.titulo} — {c.clientes?.nombre ?? '—'}</option>
                    ))}
                  </select>
                </label>
              )}
              <button
                type="button"
                onClick={handleIniciarConversacion}
                disabled={!tipoSeleccionado || iniciando}
                className="btn-primary btn-sm"
              >
                {iniciando ? 'Iniciando…' : 'Iniciar conversación'}
              </button>
            </div>

            {conversacionesPrevias.length > 0 && (
              <div className="space-y-2 pt-4 border-t border-line">
                <p className="eyebrow">Conversaciones anteriores</p>
                <ul className="text-sm divide-y divide-line card overflow-hidden">
                  {conversacionesPrevias.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => abrirConversacion(c.id)}
                        className="w-full text-left px-4 py-2.5 hover:bg-paper-sunken transition-colors"
                      >
                        <span className="font-medium">{c.titulo}</span>{' '}
                        <span className="text-slate">— {c.tipos_documento_legal?.nombre}</span>
                        {c.casos?.titulo && <span className="text-slate"> · {c.casos.titulo}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {mensajes.length === 0 && (
                <p className="text-sm text-slate">
                  Cuéntale a Mañecito qué necesitas redactar y adjunta los archivos de soporte que tengas.
                </p>
              )}
              {mensajes.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
                  {m.rol === 'asistente' && <Bot size={16} strokeWidth={1.75} className="text-slate shrink-0 mt-2" />}
                  <div
                    className={`max-w-[80%] rounded-[var(--radius-card)] px-3.5 py-2.5 text-sm ${
                      m.rol === 'usuario' ? 'bg-ink text-paper' : 'bg-paper-sunken text-ink'
                    }`}
                  >
                    {formatearMensaje(m.contenido)}
                  </div>
                  {m.rol === 'usuario' && <User size={16} strokeWidth={1.75} className="text-slate shrink-0 mt-2" />}
                </div>
              ))}
              {enviando && (
                <div className="flex gap-2 justify-start">
                  <Bot size={16} strokeWidth={1.75} className="text-slate shrink-0 mt-2" />
                  <div className="rounded-[var(--radius-card)] bg-paper-sunken px-3.5 py-3 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-soft animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-soft animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-soft animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={finTranscriptRef} />
            </div>

            {conversacion.contenido_generado && (
              <div className="border-t border-line px-5 py-4 space-y-3 max-h-[45%] overflow-y-auto shrink-0 bg-paper-sunken">
                <div className="flex items-center justify-between gap-2">
                  <p className="eyebrow">Borrador actual</p>
                  <button type="button" onClick={handleGuardarBorrador} disabled={guardandoContenido} className="btn-secondary btn-sm">
                    {guardandoContenido ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
                {conversacion.datos_faltantes && conversacion.datos_faltantes.length > 0 && (
                  <p className="text-xs text-danger">
                    Faltan datos por confirmar: {conversacion.datos_faltantes.join('; ')}
                  </p>
                )}
                <textarea
                  value={contenidoEditado}
                  onChange={(e) => setContenidoEditado(e.target.value)}
                  rows={10}
                  className="w-full field text-sm"
                />
                <p className="text-xs text-slate">
                  Documento generado con asistencia de IA — debe ser revisado por un abogado antes de radicarlo.
                </p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleExportar('docx')} disabled={exportando !== null} className="btn-secondary btn-sm">
                    <FileDown size={14} strokeWidth={1.75} /> {exportando === 'docx' ? 'Generando…' : 'Descargar Word'}
                  </button>
                  <button type="button" onClick={() => handleExportar('pdf')} disabled={exportando !== null} className="btn-secondary btn-sm">
                    <FileDown size={14} strokeWidth={1.75} /> {exportando === 'pdf' ? 'Generando…' : 'Descargar y ver PDF'}
                  </button>
                </div>
                {archivosGenerados.length > 0 && (casoId ?? conversacion.caso_id) && (
                  <ul className="text-xs text-slate space-y-1 pt-2 border-t border-line">
                    {archivosGenerados.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2">
                        <span>{a.nombre_archivo}</span>
                        <button
                          type="button"
                          onClick={() => handleGuardarEnCaso(a)}
                          disabled={guardandoEnCaso === a.id}
                          className="link"
                        >
                          {guardandoEnCaso === a.id ? 'Guardando…' : 'Guardar en Documentos del caso'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <form onSubmit={handleEnviar} className="border-t border-line px-5 py-3 shrink-0 space-y-2">
              {archivosSoporte.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {archivosSoporte.map((a) => (
                    <span key={a.id} className="badge-neutral">
                      <Paperclip size={11} strokeWidth={1.75} className="shrink-0" />
                      <span className="max-w-[160px] truncate">{a.nombre_archivo}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarArchivo(a)}
                        disabled={eliminandoArchivoId === a.id}
                        aria-label={`Quitar ${a.nombre_archivo}`}
                        className="text-slate hover:text-danger transition-colors disabled:opacity-50"
                      >
                        {eliminandoArchivoId === a.id ? (
                          <Loader2 size={11} className="animate-spin" strokeWidth={2} />
                        ) : (
                          <X size={11} strokeWidth={2} />
                        )}
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <label
                  title="Adjuntar archivo de soporte"
                  className={`flex items-center justify-center h-10 w-10 shrink-0 rounded-full border border-line text-slate transition-colors ${
                    adjuntando || archivosSoporte.length >= MAX_ARCHIVOS_SOPORTE
                      ? 'opacity-40 cursor-not-allowed'
                      : 'cursor-pointer hover:text-ink hover:bg-paper-sunken hover:border-ink/20'
                  }`}
                >
                  {adjuntando ? (
                    <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Paperclip size={16} strokeWidth={1.75} />
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept={TIPOS_PERMITIDOS_SOPORTE_IA.join(',')}
                    disabled={adjuntando || archivosSoporte.length >= MAX_ARCHIVOS_SOPORTE}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) handleAdjuntar(file)
                    }}
                  />
                </label>
                <textarea
                  value={textoMensaje}
                  onChange={(e) => setTextoMensaje(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleEnviar(e as unknown as FormEvent)
                    }
                  }}
                  rows={1}
                  placeholder="Escríbele a Mañecito los hechos, pretensiones o el ajuste que necesitas…"
                  className="flex-1 field field-sm resize-none"
                />
                <button
                  type="submit"
                  disabled={enviando || (!textoMensaje.trim() && archivoIdsPendientes.length === 0)}
                  aria-label="Enviar mensaje"
                  className="flex items-center justify-center h-10 w-10 shrink-0 rounded-full bg-ink text-paper-raised shadow-[var(--shadow-button)] transition-all hover:bg-[var(--color-ink-soft)] active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {enviando ? (
                    <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Send size={16} strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {previsualizando && (
        <DocumentoPreviewModal {...previsualizando} obtenerUrl={urlDescargaIA} onClose={() => setPrevisualizando(null)} />
      )}
    </div>
  )
}
