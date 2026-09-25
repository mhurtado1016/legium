import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, Eye, History, Loader2, Trash2, X } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { CardActions, CardEmpty, CardHeader, CardList, CardRow, DataCard } from '../components/DataCard'
import { StatusBadge } from '../components/StatusBadge'
import { useUsuario } from '../lib/useUsuario'
import {
  actualizarEstadoCaso,
  actualizarNumeroRadicado,
  agregarActividad,
  listarActividad,
  listarSentenciasVinculadas,
  listarTraslados,
  listarUsuariosFirma,
  obtenerCaso,
  trasladarCaso,
  type Caso,
  type CasoActividad,
  type CasoSentencia,
  type CasoTraslado,
  type EstadoCaso,
  type UsuarioFirma,
} from '../lib/casos'
import { crearPlazo, listarPlazos, marcarCumplido, type Plazo } from '../lib/plazos'
import {
  listarDocumentos,
  listarVersiones,
  urlDescarga,
  type Documento,
  type DocumentoVersion,
} from '../lib/documentos'
import { generarDocumentoDesdePlantilla, listarPlantillas, type Plantilla } from '../lib/plantillas'
import {
  eliminarArchivoDrive,
  listarArchivosDrive,
  subirArchivoDrive,
  urlVerArchivoDrive,
  type ArchivoDrive,
  type EstadoArchivosDrive,
} from '../lib/drive'
import {
  definirHonorarioFijo,
  generarCuentaCobro,
  listarRegistrosTiempo,
  obtenerHonorarioFijo,
  registrarTiempo,
  type HonorarioFijo,
  type RegistroTiempo,
} from '../lib/facturacion'

const ESTADOS: EstadoCaso[] = ['abierto', 'en_curso', 'suspendido', 'cerrado']
const SECCIONES = [
  { id: 'datos', label: 'Datos' },
  { id: 'responsable', label: 'Responsable' },
  { id: 'actividad', label: 'Bitácora' },
  { id: 'sentencias', label: 'Sentencias' },
  { id: 'plazos', label: 'Plazos' },
  { id: 'documentos', label: 'Documentación' },
  { id: 'facturacion', label: 'Facturación' },
]

/**
 * Ficha de caso: documento de una sola columna con navegación por
 * anclas, no pestañas (sección 13.5).
 */
export function CasoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { usuario } = useUsuario()
  const [caso, setCaso] = useState<Caso | null>(null)
  const [usuariosFirma, setUsuariosFirma] = useState<UsuarioFirma[]>([])
  const [traslados, setTraslados] = useState<CasoTraslado[]>([])
  const [actividad, setActividad] = useState<CasoActividad[]>([])
  const [sentencias, setSentencias] = useState<CasoSentencia[]>([])
  const [plazos, setPlazos] = useState<Plazo[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [registrosTiempo, setRegistrosTiempo] = useState<RegistroTiempo[]>([])
  const [honorarioFijo, setHonorarioFijo] = useState<HonorarioFijo | null>(null)
  const [nuevaNota, setNuevaNota] = useState('')
  const [numeroRadicado, setNumeroRadicado] = useState('')
  const [guardandoRadicado, setGuardandoRadicado] = useState(false)

  async function cargar() {
    if (!id) return
    const [c, uf, t, a, s, p, d, plant, rt, hf] = await Promise.all([
      obtenerCaso(id),
      listarUsuariosFirma(),
      listarTraslados(id),
      listarActividad(id),
      listarSentenciasVinculadas(id),
      listarPlazos({ caso_id: id }),
      listarDocumentos(id),
      listarPlantillas(),
      listarRegistrosTiempo(id),
      obtenerHonorarioFijo(id),
    ])
    setCaso(c)
    setNumeroRadicado(c.numero_radicado ?? '')
    setUsuariosFirma(uf)
    setTraslados(t)
    setActividad(a)
    setSentencias(s)
    setPlazos(p)
    setDocumentos(d)
    setPlantillas(plant)
    setRegistrosTiempo(rt)
    setHonorarioFijo(hf)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleCambiarEstado(estado: EstadoCaso) {
    if (!id) return
    await actualizarEstadoCaso(id, estado)
    setCaso((prev) => (prev ? { ...prev, estado } : prev))
  }

  async function handleGuardarRadicado(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setGuardandoRadicado(true)
    try {
      const valor = numeroRadicado.trim() || null
      await actualizarNumeroRadicado(id, valor)
      setCaso((prev) => (prev ? { ...prev, numero_radicado: valor } : prev))
    } finally {
      setGuardandoRadicado(false)
    }
  }

  async function handleTrasladar(nuevoResponsableId: string, motivo: string) {
    if (!id) return
    await trasladarCaso(id, nuevoResponsableId, motivo)
    await cargar()
  }

  async function handleAgregarNota(e: FormEvent) {
    e.preventDefault()
    if (!id || !usuario || !nuevaNota.trim()) return
    await agregarActividad(id, nuevaNota.trim(), usuario.firma_id, usuario.id)
    setNuevaNota('')
    const a = await listarActividad(id)
    setActividad(a)
  }

  if (!caso) return null

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader
        left={
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/app/casos"
              className="flex items-center justify-center h-8 w-8 -ml-1.5 rounded-full text-slate hover:text-ink hover:bg-paper-sunken transition-colors shrink-0"
              aria-label="Volver a casos"
            >
              <ArrowLeft size={17} strokeWidth={1.75} />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-base font-semibold truncate">{caso.titulo}</h1>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-10 px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto">
        <nav className="text-sm text-slate space-y-0.5 self-start md:sticky md:top-24">
          <p className="eyebrow mb-2">En esta página</p>
          {SECCIONES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block px-2.5 py-1.5 -mx-2.5 rounded-[var(--radius-field)] hover:text-ink hover:bg-paper-sunken transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>

        <div className="max-w-2xl space-y-10">
          <section id="datos" className="card p-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-display text-base font-semibold">Datos generales</h2>
              <StatusBadge estado={caso.estado} />
            </div>
            <p className="text-sm text-slate mb-4">
              Información básica que identifica el caso: cliente, tipo, estado y, si aplica,
              el número de radicado judicial. Actualiza el estado y el radicado aquí a medida
              que el caso avanza.
            </p>
            <p className="text-sm">
              Cliente: <span className="font-medium">{caso.clientes?.nombre ?? '—'}</span> · Tipo:{' '}
              <span className="capitalize">{caso.tipo}</span>
            </p>
            <label className="block mt-3 max-w-[14rem]">
              <span className="block text-sm text-slate mb-1">Estado</span>
              <select
                value={caso.estado}
                onChange={(e) => handleCambiarEstado(e.target.value as EstadoCaso)}
                className="field field-sm"
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
            <form onSubmit={handleGuardarRadicado} className="flex items-end gap-2 mt-3">
              <div>
                <label className="block text-sm text-slate mb-1">Número de radicado</label>
                <input
                  value={numeroRadicado}
                  onChange={(e) => setNumeroRadicado(e.target.value)}
                  className="field field-sm"
                />
              </div>
              <button type="submit" disabled={guardandoRadicado} className="btn-secondary btn-sm">
                {guardandoRadicado ? 'Guardando…' : 'Guardar'}
              </button>
            </form>
            {caso.tipo === 'litigio' && (
              <p className="text-sm text-slate mt-3 pt-3 border-t border-line">
                Despacho: {caso.despacho_judicial ?? '—'} · Etapa: {caso.etapa_procesal ?? '—'}
              </p>
            )}
          </section>

          <section id="responsable" className="card p-6">
            <h2 className="font-display text-base font-semibold mb-2">Responsable</h2>
            <p className="text-sm text-slate mb-4">
              Abogado a cargo del caso. Puede trasladarse a otro miembro del equipo en cualquier
              momento; cada traslado queda registrado abajo con fecha, motivo y quién lo hizo.
            </p>
            <p className="text-sm mb-4">
              Responsable actual: <span className="font-medium">{caso.usuarios?.nombre ?? '—'}</span>
            </p>
            <TrasladarResponsableForm
              usuarios={usuariosFirma}
              responsableActualId={caso.responsable_id}
              onTrasladar={handleTrasladar}
            />
            <div className="mt-5 pt-4 border-t border-line">
              <p className="text-sm text-slate font-medium mb-2">Historial de traslados</p>
              <ul className="text-sm divide-y divide-line card overflow-hidden">
                {traslados.map((t) => (
                  <li key={t.id} className="px-4 py-2.5">
                    <span className="text-slate">
                      {new Date(t.created_at).toLocaleDateString('es-CO')} —{' '}
                    </span>
                    de <span className="font-medium">{t.responsable_anterior ?? '—'}</span> a{' '}
                    <span className="font-medium">{t.responsable_nuevo ?? '—'}</span>
                    <span className="text-slate"> · por {t.trasladado_por_nombre ?? '—'}</span>
                    {t.motivo && <span className="text-slate"> — {t.motivo}</span>}
                  </li>
                ))}
                {traslados.length === 0 && (
                  <li className="px-4 py-3 text-slate">Sin traslados registrados todavía.</li>
                )}
              </ul>
            </div>
          </section>

          <section id="actividad" className="card p-6">
            <h2 className="font-display text-base font-semibold mb-2">Bitácora</h2>
            <p className="text-sm text-slate mb-3">
              Bitácora cronológica del caso. Deja constancia de gestiones, llamadas, reuniones
              o decisiones importantes para que quede un historial consultable por todo el
              equipo.
            </p>
            <form onSubmit={handleAgregarNota} className="flex gap-2 mb-3">
              <input
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                placeholder="Agregar nota…"
                className="flex-1 field field-sm"
              />
              <button className="btn-primary btn-sm">
                Agregar
              </button>
            </form>
            <ul className="text-sm divide-y divide-line card overflow-hidden">
              {actividad.map((a) => (
                <li key={a.id} className="px-4 py-2.5 break-words">
                  <span className="text-slate">
                    {new Date(a.created_at).toLocaleDateString('es-CO')} —{' '}
                  </span>
                  {a.descripcion}
                </li>
              ))}
              {actividad.length === 0 && <li className="px-4 py-3 text-slate">Sin actividad aún.</li>}
            </ul>
          </section>

          <section id="sentencias" className="card p-6">
            <h2 className="font-display text-base font-semibold mb-2">Sentencias vinculadas</h2>
            <p className="text-sm text-slate mb-3">
              Sentencias del buscador jurisprudencial que se relacionan con este caso, útiles
              como precedente o soporte argumentativo al momento de preparar la estrategia o
              los documentos del proceso.
            </p>
            <ul className="text-sm divide-y divide-line card overflow-hidden">
              {sentencias.map((s) => (
                <li key={s.id} className="px-4 py-2.5">
                  {s.sentencias_cache ? (
                    <>
                      {s.sentencias_cache.sentencia} · {s.sentencias_cache.sala ?? '—'}
                    </>
                  ) : (
                    <span className="text-slate">Sentencia no disponible</span>
                  )}
                  {s.nota && <span className="text-slate"> — nota: {s.nota}</span>}
                </li>
              ))}
              {sentencias.length === 0 && (
                <li className="px-4 py-3 text-slate">
                  Ninguna todavía. Vincula sentencias desde el buscador (pendiente de integrar
                  aquí).
                </li>
              )}
            </ul>
          </section>

          <section id="plazos" className="card p-6">
            <h2 className="font-display text-base font-semibold mb-2">Plazos</h2>
            <p className="text-sm text-slate mb-3">
              Fechas límite del caso, ya sean términos procesales, vencimientos contractuales u
              otros compromisos. Configura recordatorios por app, correo o notificación push
              para no perderlos.
            </p>
            {usuario && (
              <NuevoPlazoForm
                casoId={caso.id}
                firmaId={usuario.firma_id}
                usuarioId={usuario.id}
                onCreado={cargar}
              />
            )}
            <ul className="text-sm divide-y divide-line card overflow-hidden mt-3">
              {plazos.map((p) => (
                <li key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-medium">{p.titulo}</span> — vence{' '}
                    {new Date(p.fecha_vencimiento).toLocaleDateString('es-CO')}{' '}
                    <StatusBadge estado={p.estado} />
                  </span>
                  {p.estado !== 'cumplido' && (
                    <button
                      onClick={async () => {
                        await marcarCumplido(p.id)
                        cargar()
                      }}
                      className="link shrink-0"
                    >
                      marcar cumplido
                    </button>
                  )}
                </li>
              ))}
              {plazos.length === 0 && <li className="px-4 py-3 text-slate">Sin plazos para este caso.</li>}
            </ul>
          </section>

          <section id="documentos" className="card p-6">
            <h2 className="font-display text-base font-semibold mb-2">Documentación</h2>
            <p className="text-sm text-slate mb-3">
              Archivos del caso: escritos, pruebas, contratos, documentos generados a partir de una
              plantilla, y los de la carpeta de Google Drive del despacho.
            </p>
            {usuario && (
              <DocumentosSeccion
                casoId={caso.id}
                documentos={documentos}
                plantillas={plantillas}
                numeroRadicado={caso.numero_radicado}
                onCambio={cargar}
              />
            )}
          </section>

          <section id="facturacion" className="card p-6">
            <h2 className="font-display text-base font-semibold mb-2">Facturación</h2>
            <p className="text-sm text-slate mb-3">
              Control del cobro del caso: define un honorario fijo o registra las horas
              trabajadas, y genera la cuenta de cobro correspondiente para el cliente.
            </p>
            {usuario && (
              <FacturacionSeccion
                casoId={caso.id}
                firmaId={usuario.firma_id}
                usuarioId={usuario.id}
                registrosTiempo={registrosTiempo}
                honorarioFijo={honorarioFijo}
                onCambio={cargar}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function TrasladarResponsableForm({
  usuarios,
  responsableActualId,
  onTrasladar,
}: {
  usuarios: UsuarioFirma[]
  responsableActualId: string
  onTrasladar: (nuevoResponsableId: string, motivo: string) => Promise<void>
}) {
  const opciones = usuarios.filter((u) => u.id !== responsableActualId)
  const [nuevoResponsableId, setNuevoResponsableId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nuevoResponsableId) return
    setError(null)
    setGuardando(true)
    try {
      await onTrasladar(nuevoResponsableId, motivo)
      setNuevoResponsableId('')
      setMotivo('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo trasladar el caso.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 text-sm">
      <div>
        <label className="block text-slate mb-1">Nuevo responsable</label>
        <select
          value={nuevoResponsableId}
          onChange={(e) => setNuevoResponsableId(e.target.value)}
          className="field field-sm"
        >
          <option value="">— elegir —</option>
          {opciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre ?? u.id}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-slate mb-1">Motivo (opcional)</label>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="field field-sm"
        />
      </div>
      <button type="submit" disabled={guardando || !nuevoResponsableId} className="btn-primary btn-sm">
        {guardando ? 'Trasladando…' : 'Trasladar caso'}
      </button>
      {error && <p className="text-danger basis-full">{error}</p>}
    </form>
  )
}

function NuevoPlazoForm({
  casoId,
  firmaId,
  usuarioId,
  onCreado,
}: {
  casoId: string
  firmaId: string
  usuarioId: string
  onCreado: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState('')
  const [notificarApp, setNotificarApp] = useState(true)
  const [notificarEmail, setNotificarEmail] = useState(false)
  const [notificarPush, setNotificarPush] = useState(false)
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!titulo || !fecha) return
    setGuardando(true)
    try {
      const notificaciones: { canal: 'app' | 'email' | 'push'; dias_antes: number }[] = []
      if (notificarApp) notificaciones.push({ canal: 'app', dias_antes: 1 })
      if (notificarEmail) notificaciones.push({ canal: 'email', dias_antes: 1 })
      if (notificarPush) notificaciones.push({ canal: 'push', dias_antes: 1 })

      await crearPlazo(
        {
          firma_id: firmaId,
          caso_id: casoId,
          titulo,
          descripcion: null,
          fecha_vencimiento: new Date(fecha).toISOString(),
          responsable_id: usuarioId,
          creado_por: usuarioId,
        },
        notificaciones,
      )
      setTitulo('')
      setFecha('')
      onCreado()
    } finally {
      setGuardando(false)
    }
  }

  return (
    // Fila de campos (con label encima) y fila de checkboxes (sin label)
    // van separadas en vez de un único flex-wrap con items-end: al mezclar
    // ítems de alturas distintas en la misma línea, el cross-axis
    // alignment terminaba superponiendo los checkboxes sobre el campo de
    // fecha en pantallas angostas.
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
        <div className="sm:flex-1 sm:min-w-[10rem]">
          <label className="block text-slate mb-1">Título</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full field field-sm"
          />
        </div>
        <div>
          <label className="block text-slate mb-1">Vence</label>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full sm:w-auto field field-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={notificarApp} onChange={(e) => setNotificarApp(e.target.checked)} />
          App
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={notificarEmail} onChange={(e) => setNotificarEmail(e.target.checked)} />
          Email
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={notificarPush} onChange={(e) => setNotificarPush(e.target.checked)} />
          Push
        </label>
        <button
          type="submit"
          disabled={guardando}
          className="btn-primary btn-sm sm:ml-auto"
        >
          {guardando ? 'Guardando…' : 'Agregar plazo'}
        </button>
      </div>
    </form>
  )
}

type PreviewState =
  | { tipo: 'sistema'; storagePath: string; mimeType: string | null; nombre: string }
  | { tipo: 'drive'; fileId: string; mimeType: string; nombre: string; webViewLink: string }

function DocumentosSeccion({
  casoId,
  documentos,
  plantillas,
  numeroRadicado,
  onCambio,
}: {
  casoId: string
  documentos: Documento[]
  plantillas: Plantilla[]
  numeroRadicado: string | null
  onCambio: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null)
  const [versiones, setVersiones] = useState<DocumentoVersion[]>([])
  const [previsualizando, setPrevisualizando] = useState<PreviewState | null>(null)
  const [plantillaId, setPlantillaId] = useState('')
  const [variablesManuales, setVariablesManuales] = useState<Record<string, string>>({})
  const [generando, setGenerando] = useState(false)

  // Google Drive: mismo caso, buscado por número de radicado (ver
  // src/lib/drive.ts) — se muestra mezclado con los documentos del
  // sistema en una sola lista, no como sección aparte.
  const [estadoDrive, setEstadoDrive] = useState<EstadoArchivosDrive | null>(null)
  const [cargandoDrive, setCargandoDrive] = useState(false)
  const [errorDrive, setErrorDrive] = useState<string | null>(null)
  const [subiendoDrive, setSubiendoDrive] = useState(false)
  const [eliminandoDriveId, setEliminandoDriveId] = useState<string | null>(null)

  async function cargarDrive() {
    if (!numeroRadicado) {
      setEstadoDrive(null)
      return null
    }
    setCargandoDrive(true)
    setErrorDrive(null)
    try {
      const r = await listarArchivosDrive(numeroRadicado)
      setEstadoDrive(r)
      return r
    } catch (err) {
      setErrorDrive(err instanceof Error ? err.message : 'No se pudo consultar Google Drive.')
      return null
    } finally {
      setCargandoDrive(false)
    }
  }

  useEffect(() => {
    cargarDrive()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroRadicado])

  async function handleSubirDrive(e: React.ChangeEvent<HTMLInputElement>) {
    const archivoDrive = e.target.files?.[0]
    e.target.value = ''
    if (!archivoDrive) return
    setSubiendoDrive(true)
    setError(null)
    try {
      // Vuelve a buscar la carpeta justo antes de subir en vez de confiar
      // en el carpetaId que ya estaba en estado: si alguien reorganizó
      // Drive (ej. la movió a una Unidad compartida) mientras la página
      // seguía abierta, ese id queda obsoleto y Drive responde "File not
      // found" en vez de un error claro.
      const actual = await cargarDrive()
      if (!actual?.carpetaId) throw new Error('No se encontró la carpeta de Drive de este caso.')
      await subirArchivoDrive(actual.carpetaId, archivoDrive)
      await cargarDrive()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo a Google Drive.')
    } finally {
      setSubiendoDrive(false)
    }
  }

  async function handleEliminarDrive(archivo: ArchivoDrive) {
    if (!window.confirm(`¿Eliminar "${archivo.name}" de Google Drive? Esta acción no se puede deshacer.`)) return
    setEliminandoDriveId(archivo.id)
    setError(null)
    try {
      await eliminarArchivoDrive(archivo.id)
      await cargarDrive()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el archivo de Google Drive.')
    } finally {
      setEliminandoDriveId(null)
    }
  }

  const plantillaSeleccionada = plantillas.find((p) => p.id === plantillaId)
  const camposManuales = plantillaSeleccionada?.variables.filter((v) => v.manual) ?? []

  async function handleGenerarDesdePlantilla(e: FormEvent) {
    e.preventDefault()
    if (!plantillaId) return
    setError(null)
    setGenerando(true)
    try {
      await generarDocumentoDesdePlantilla(plantillaId, casoId, variablesManuales)
      setPlantillaId('')
      setVariablesManuales({})
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el documento.')
    } finally {
      setGenerando(false)
    }
  }

  async function handleVerHistorial(documentoId: string) {
    if (historialAbierto === documentoId) {
      setHistorialAbierto(null)
      return
    }
    const v = await listarVersiones(documentoId)
    setVersiones(v)
    setHistorialAbierto(documentoId)
  }

  // Único punto de entrada para abrir un documento: siempre el visor
  // embebido (iframe/<img> dentro de DocumentoPreviewModal), nunca una
  // pestaña nueva. Descargar a disco solo queda disponible como enlace
  // secundario ya dentro del modal (ver DocumentoPreviewModal más abajo).
  // Abre el modal de inmediato (sin esperar la signed URL) para que el
  // spinner de carga sea visible desde el primer click; la propia URL se
  // resuelve dentro del modal.
  function handleVer(storagePath: string, mimeType: string | null, nombre: string) {
    setPrevisualizando({ tipo: 'sistema', storagePath, mimeType, nombre })
  }

  function handleVerDrive(archivo: ArchivoDrive) {
    setPrevisualizando({
      tipo: 'drive',
      fileId: archivo.id,
      mimeType: archivo.mimeType,
      nombre: archivo.name,
      webViewLink: archivo.webViewLink,
    })
  }

  const documentosFiltrados = busqueda
    ? documentos.filter((d) => d.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : documentos

  const archivosDriveFiltrados = (
    busqueda
      ? (estadoDrive?.archivos ?? []).filter((a) => a.name.toLowerCase().includes(busqueda.toLowerCase()))
      : estadoDrive?.archivos ?? []
  )

  // Une documentos del sistema y de Drive en una sola lista ordenada por
  // fecha, con un tipo común para poder recorrerla de una — cada fila
  // decide su columna de "categoría"/versión y sus acciones según origen.
  type ItemDocumentacion =
    | { key: string; origen: 'sistema'; fecha: string | null; doc: Documento }
    | { key: string; origen: 'drive'; fecha: string | null; archivo: ArchivoDrive }

  const itemsUnificados: ItemDocumentacion[] = [
    ...documentosFiltrados.map(
      (d): ItemDocumentacion => ({
        key: `sistema-${d.id}`,
        origen: 'sistema',
        fecha: d.ultima_version?.created_at ?? null,
        doc: d,
      }),
    ),
    ...archivosDriveFiltrados.map(
      (a): ItemDocumentacion => ({ key: `drive-${a.id}`, origen: 'drive', fecha: a.modifiedTime, archivo: a }),
    ),
  ].sort((a, b) => (b.fecha ? new Date(b.fecha).getTime() : 0) - (a.fecha ? new Date(a.fecha).getTime() : 0))

  return (
    <div>
      {plantillas.length > 0 && (
        <form onSubmit={handleGenerarDesdePlantilla} className="card p-5 mb-4 space-y-2 text-sm">
          <p className="text-slate font-medium">Generar desde plantilla</p>
          <div className="flex flex-wrap items-end gap-3">
            <select
              value={plantillaId}
              onChange={(e) => {
                setPlantillaId(e.target.value)
                setVariablesManuales({})
              }}
              className="field field-sm"
            >
              <option value="">— elegir plantilla —</option>
              {plantillas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {plantillaId && (
              <button
                type="submit"
                disabled={generando}
                className="btn-primary btn-sm"
              >
                {generando ? 'Generando…' : 'Generar documento'}
              </button>
            )}
          </div>
          {camposManuales.map((v) => (
            <div key={v.clave}>
              <label className="block text-slate mb-1">{v.clave}</label>
              <input
                value={variablesManuales[v.clave] ?? ''}
                onChange={(e) =>
                  setVariablesManuales((prev) => ({ ...prev, [v.clave]: e.target.value }))
                }
                className="w-full max-w-sm field field-sm"
              />
            </div>
          ))}
        </form>
      )}

      {estadoDrive?.carpetaEncontrada && (
        <div className="mb-4">
          <label className={'btn-primary btn-sm' + (subiendoDrive ? ' opacity-60 pointer-events-none' : '')}>
            {subiendoDrive ? (
              <>
                <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
                Subiendo a Drive…
              </>
            ) : (
              '+ Subir a Google Drive'
            )}
            <input type="file" onChange={handleSubirDrive} disabled={subiendoDrive} className="hidden" />
          </label>
        </div>
      )}

      {!cargandoDrive && numeroRadicado && !errorDrive && estadoDrive && !estadoDrive.carpetaEncontrada && (
        <p className="text-xs text-slate mb-4">
          {estadoDrive.conectado
            ? `No se encontró en Google Drive ninguna carpeta cuyo nombre incluya "${numeroRadicado}".`
            : 'Google Drive no está conectado. Un administrador puede hacerlo desde Administración.'}
        </p>
      )}
      {errorDrive && <p className="text-xs text-danger mb-4">{errorDrive}</p>}

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      <input
        type="text"
        placeholder="Buscar por nombre…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="field field-sm mb-3 w-full max-w-xs"
      />

      <div className="hidden md:block card overflow-hidden">
        <table className="table-modern">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Versión</th>
              <th>Actualizado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itemsUnificados.map((item) =>
              item.origen === 'sistema' ? (
                <Fragment key={item.key}>
                  <tr>
                    <td className="font-medium text-ink">{item.doc.nombre}</td>
                    <td>
                      {item.doc.ultima_version ? (
                        <button
                          onClick={() =>
                            item.doc.ultima_version &&
                            handleVer(
                              item.doc.ultima_version.storage_path,
                              item.doc.ultima_version.mime_type,
                              item.doc.ultima_version.nombre_archivo,
                            )
                          }
                          className="hover:text-accent transition-colors"
                        >
                          v{item.doc.ultima_version.version_numero}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-slate">
                      {item.doc.ultima_version
                        ? new Date(item.doc.ultima_version.created_at).toLocaleDateString('es-CO')
                        : '—'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-4 text-xs whitespace-nowrap">
                        {item.doc.ultima_version && (
                          <button
                            onClick={() =>
                              item.doc.ultima_version &&
                              handleVer(
                                item.doc.ultima_version.storage_path,
                                item.doc.ultima_version.mime_type,
                                item.doc.ultima_version.nombre_archivo,
                              )
                            }
                            className="flex items-center gap-1.5 text-slate hover:text-accent transition-colors"
                          >
                            <Eye size={14} strokeWidth={1.75} />
                            Ver
                          </button>
                        )}
                        <button
                          onClick={() => handleVerHistorial(item.doc.id)}
                          className="flex items-center gap-1.5 text-slate hover:text-ink transition-colors"
                        >
                          <History size={14} strokeWidth={1.75} />
                          Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                  {historialAbierto === item.doc.id && (
                    <tr>
                      <td colSpan={4} className="bg-paper-sunken">
                        <ul className="text-slate space-y-1.5 py-2">
                          {versiones.map((v) => (
                            <li key={v.id} className="flex items-center gap-2 flex-wrap">
                              <span>
                                v{v.version_numero} — {v.nombre_archivo} —{' '}
                                {new Date(v.created_at).toLocaleDateString('es-CO')}
                              </span>
                              <button
                                onClick={() => handleVer(v.storage_path, v.mime_type, v.nombre_archivo)}
                                className="flex items-center gap-1 text-ink hover:text-accent transition-colors"
                              >
                                <Eye size={13} strokeWidth={1.75} />
                                Ver
                              </button>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ) : (
                <tr key={item.key}>
                  <td className="font-medium text-ink">
                    <button onClick={() => handleVerDrive(item.archivo)} className="flex items-center gap-2 hover:text-accent transition-colors text-left">
                      <img src={item.archivo.iconLink} alt="" className="h-4 w-4 shrink-0" />
                      {item.archivo.name}
                    </button>
                  </td>
                  <td className="text-slate">—</td>
                  <td className="text-slate">{new Date(item.archivo.modifiedTime).toLocaleDateString('es-CO')}</td>
                  <td>
                    <div className="flex items-center justify-end gap-4 text-xs whitespace-nowrap">
                      <button
                        onClick={() => handleVerDrive(item.archivo)}
                        className="flex items-center gap-1.5 text-slate hover:text-accent transition-colors"
                      >
                        <Eye size={14} strokeWidth={1.75} />
                        Ver
                      </button>
                      <a
                        href={item.archivo.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-slate hover:text-ink transition-colors"
                      >
                        <ExternalLink size={14} strokeWidth={1.75} />
                        Abrir en Drive
                      </a>
                      <button
                        onClick={() => handleEliminarDrive(item.archivo)}
                        disabled={eliminandoDriveId === item.archivo.id}
                        className="flex items-center gap-1.5 text-slate hover:text-danger transition-colors disabled:opacity-50"
                      >
                        {eliminandoDriveId === item.archivo.id ? (
                          <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
                        ) : (
                          <Trash2 size={14} strokeWidth={1.75} />
                        )}
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {itemsUnificados.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-slate text-center">
                  Sin documentos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CardList>
        {itemsUnificados.map((item) =>
          item.origen === 'sistema' ? (
            <DataCard key={item.key}>
              <CardHeader>
                <span className="font-medium text-ink break-words min-w-0">{item.doc.nombre}</span>
              </CardHeader>
              <CardRow label="Versión">
                {item.doc.ultima_version ? (
                  <button
                    onClick={() =>
                      item.doc.ultima_version &&
                      handleVer(
                        item.doc.ultima_version.storage_path,
                        item.doc.ultima_version.mime_type,
                        item.doc.ultima_version.nombre_archivo,
                      )
                    }
                    className="hover:text-accent transition-colors"
                  >
                    v{item.doc.ultima_version.version_numero}
                  </button>
                ) : (
                  '—'
                )}
              </CardRow>
              <CardRow label="Actualizado">
                {item.doc.ultima_version ? new Date(item.doc.ultima_version.created_at).toLocaleDateString('es-CO') : '—'}
              </CardRow>
              <CardActions>
                {item.doc.ultima_version && (
                  <button
                    onClick={() =>
                      item.doc.ultima_version &&
                      handleVer(
                        item.doc.ultima_version.storage_path,
                        item.doc.ultima_version.mime_type,
                        item.doc.ultima_version.nombre_archivo,
                      )
                    }
                    className="flex items-center gap-1.5 text-slate hover:text-accent transition-colors"
                  >
                    <Eye size={14} strokeWidth={1.75} />
                    Ver
                  </button>
                )}
                <button
                  onClick={() => handleVerHistorial(item.doc.id)}
                  className="flex items-center gap-1.5 text-slate hover:text-ink transition-colors"
                >
                  <History size={14} strokeWidth={1.75} />
                  Historial
                </button>
              </CardActions>
              {historialAbierto === item.doc.id && (
                <ul className="text-slate text-xs space-y-2 pt-2 border-t border-line">
                  {versiones.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 flex-wrap">
                      <span>
                        v{v.version_numero} — {v.nombre_archivo} — {new Date(v.created_at).toLocaleDateString('es-CO')}
                      </span>
                      <button
                        onClick={() => handleVer(v.storage_path, v.mime_type, v.nombre_archivo)}
                        className="flex items-center gap-1 text-ink hover:text-accent transition-colors"
                      >
                        <Eye size={13} strokeWidth={1.75} />
                        Ver
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </DataCard>
          ) : (
            <DataCard key={item.key}>
              <CardHeader>
                <span className="font-medium text-ink flex items-center gap-2 min-w-0">
                  <img src={item.archivo.iconLink} alt="" className="h-4 w-4 shrink-0" />
                  <span className="break-words min-w-0">{item.archivo.name}</span>
                </span>
              </CardHeader>
              <CardRow label="Actualizado">{new Date(item.archivo.modifiedTime).toLocaleDateString('es-CO')}</CardRow>
              <CardActions>
                <button
                  onClick={() => handleVerDrive(item.archivo)}
                  className="flex items-center gap-1.5 text-slate hover:text-accent transition-colors"
                >
                  <Eye size={14} strokeWidth={1.75} />
                  Ver
                </button>
                <a
                  href={item.archivo.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-slate hover:text-ink transition-colors"
                >
                  <ExternalLink size={14} strokeWidth={1.75} />
                  Abrir en Drive
                </a>
                <button
                  onClick={() => handleEliminarDrive(item.archivo)}
                  disabled={eliminandoDriveId === item.archivo.id}
                  className="flex items-center gap-1.5 text-slate hover:text-danger transition-colors disabled:opacity-50"
                >
                  {eliminandoDriveId === item.archivo.id ? (
                    <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
                  ) : (
                    <Trash2 size={14} strokeWidth={1.75} />
                  )}
                  Eliminar
                </button>
              </CardActions>
            </DataCard>
          ),
        )}
        {itemsUnificados.length === 0 && <CardEmpty>Sin documentos todavía.</CardEmpty>}
      </CardList>

      {previsualizando?.tipo === 'sistema' && (
        <DocumentoPreviewModal {...previsualizando} onClose={() => setPrevisualizando(null)} />
      )}
      {previsualizando?.tipo === 'drive' && (
        <DriveArchivoPreviewModal {...previsualizando} onClose={() => setPrevisualizando(null)} />
      )}
    </div>
  )
}

// Visor dentro del sitio: PDF e imágenes se muestran embebidos (iframe /
// <img>), sin navegar a otra pestaña ni forzar una descarga. Para tipos que
// ningún navegador renderiza de forma nativa (Word, etc.) no hay forma
// honesta de "previsualizar" sin subir el archivo a un servicio externo —
// se avisa y se deja la descarga como única vía.
function DocumentoPreviewModal({
  storagePath,
  mimeType,
  nombre,
  onClose,
}: {
  storagePath: string
  mimeType: string | null
  nombre: string
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [archivoListo, setArchivoListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Resuelve la signed URL acá (no antes de abrir el modal) para que el
  // spinner sea visible desde el primer click, sin ese hueco de "no pasó
  // nada" mientras se espera la respuesta de Supabase.
  useEffect(() => {
    let cancelado = false
    setUrl(null)
    setArchivoListo(false)
    setError(null)
    urlDescarga(storagePath)
      .then((u) => {
        if (!cancelado) setUrl(u)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudo cargar el documento.')
      })
    return () => {
      cancelado = true
    }
  }, [storagePath])

  const esPdf = mimeType === 'application/pdf'
  const esImagen = mimeType?.startsWith('image/') ?? false
  // Para tipos sin visor embebido no hay nada que "cargar" en el iframe/img
  // — el spinner solo debe esperar a la signed URL, no a un onLoad que
  // nunca va a llegar.
  const cargando = !error && (!url || ((esPdf || esImagen) && !archivoListo))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-raised)] animate-in overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-line shrink-0">
          <p className="font-medium text-sm text-ink break-words min-w-0">{nombre}</p>
          <div className="flex items-center gap-3 shrink-0">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate hover:text-ink transition-colors"
              >
                <Download size={14} strokeWidth={1.75} />
                Descargar
              </a>
            )}
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 -m-1.5 rounded-md text-slate hover:text-ink hover:bg-paper-sunken transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0 bg-paper-sunken">
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate">
              <Loader2 size={18} className="animate-spin" strokeWidth={1.75} />
              Cargando documento…
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-danger px-6 text-center">
              {error}
            </div>
          )}

          {url && esPdf && (
            <iframe
              src={url}
              title={nombre}
              onLoad={() => setArchivoListo(true)}
              className={`w-full h-full border-0 transition-opacity ${archivoListo ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {url && esImagen && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={url}
                alt={nombre}
                onLoad={() => setArchivoListo(true)}
                className={`max-w-full max-h-full object-contain transition-opacity ${archivoListo ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          )}
          {url && !esPdf && !esImagen && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-sm text-slate">
                Este tipo de archivo no se puede previsualizar en el navegador.
              </p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                <Download size={14} strokeWidth={1.75} />
                Descargar para verlo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Visor de un archivo de Google Drive. El iframe "de vista" normal de
// Drive (drive.google.com/file/d/.../preview) no sirve acá: depende de
// que el navegador de quien mira esté logueado con una cuenta de
// Google con acceso, y el acceso real lo tiene solo la cuenta de
// servicio — por eso se pide el contenido directo (urlVerArchivoDrive,
// alt=media con el token de la cuenta de servicio) y se renderiza igual
// que en DocumentoPreviewModal (PDF/imagen embebidos, resto con enlace).
function DriveArchivoPreviewModal({
  fileId,
  mimeType,
  nombre,
  webViewLink,
  onClose,
}: {
  fileId: string
  mimeType: string
  nombre: string
  webViewLink: string
  onClose: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [archivoListo, setArchivoListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  useEffect(() => {
    let cancelado = false
    setUrl(null)
    setArchivoListo(false)
    setError(null)
    urlVerArchivoDrive(fileId)
      .then((u) => {
        if (!cancelado) setUrl(u)
      })
      .catch((err) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudo cargar el documento.')
      })
    return () => {
      cancelado = true
    }
  }, [fileId])

  const esPdf = mimeType === 'application/pdf'
  const esImagen = mimeType.startsWith('image/')
  const cargando = !error && (!url || ((esPdf || esImagen) && !archivoListo))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm animate-in" onClick={onClose} />

      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-raised)] animate-in overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-line shrink-0">
          <p className="font-medium text-sm text-ink break-words min-w-0">{nombre}</p>
          <div className="flex items-center gap-3 shrink-0">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate hover:text-ink transition-colors"
              >
                <Download size={14} strokeWidth={1.75} />
                Descargar
              </a>
            )}
            <a
              href={webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-slate hover:text-ink transition-colors"
            >
              <ExternalLink size={14} strokeWidth={1.75} />
              Abrir en Drive
            </a>
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="p-1.5 -m-1.5 rounded-md text-slate hover:text-ink hover:bg-paper-sunken transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="relative flex-1 min-h-0 bg-paper-sunken">
          {cargando && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate">
              <Loader2 size={18} className="animate-spin" strokeWidth={1.75} />
              Cargando documento…
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-danger px-6 text-center">
              {error}
            </div>
          )}

          {url && esPdf && (
            <iframe
              src={url}
              title={nombre}
              onLoad={() => setArchivoListo(true)}
              className={`w-full h-full border-0 transition-opacity ${archivoListo ? 'opacity-100' : 'opacity-0'}`}
            />
          )}
          {url && esImagen && (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={url}
                alt={nombre}
                onLoad={() => setArchivoListo(true)}
                className={`max-w-full max-h-full object-contain transition-opacity ${archivoListo ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          )}
          {url && !esPdf && !esImagen && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-sm text-slate">
                Este tipo de archivo no se puede previsualizar en el navegador.
              </p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">
                <Download size={14} strokeWidth={1.75} />
                Descargar para verlo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FacturacionSeccion({
  casoId,
  firmaId,
  usuarioId,
  registrosTiempo,
  honorarioFijo,
  onCambio,
}: {
  casoId: string
  firmaId: string
  usuarioId: string
  registrosTiempo: RegistroTiempo[]
  honorarioFijo: HonorarioFijo | null
  onCambio: () => void
}) {
  const [horas, setHoras] = useState('')
  const [descripcionHoras, setDescripcionHoras] = useState('')
  const [montoFijo, setMontoFijo] = useState(honorarioFijo?.monto_acordado?.toString() ?? '')
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRegistrarHoras(e: FormEvent) {
    e.preventDefault()
    if (!horas) return
    await registrarTiempo(casoId, firmaId, usuarioId, Number(horas), descripcionHoras)
    setHoras('')
    setDescripcionHoras('')
    onCambio()
  }

  async function handleGuardarHonorarioFijo(e: FormEvent) {
    e.preventDefault()
    if (!montoFijo) return
    await definirHonorarioFijo(casoId, firmaId, Number(montoFijo), '')
    onCambio()
  }

  async function handleGenerarCuenta() {
    setError(null)
    setResultado(null)
    setGenerando(true)
    try {
      const r = await generarCuentaCobro(casoId)
      setResultado(`Cuenta ${r.numero} generada por $${r.total.toLocaleString('es-CO')}.`)
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar la cuenta de cobro.')
    } finally {
      setGenerando(false)
    }
  }

  const horasPendientes = registrosTiempo.filter((r) => !r.facturado)

  return (
    <div className="text-sm space-y-5">
      <div className="card p-4">
        <p className="text-slate mb-2">Honorario fijo (si aplica)</p>
        <form onSubmit={handleGuardarHonorarioFijo} className="flex items-end gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Monto acordado"
            value={montoFijo}
            onChange={(e) => setMontoFijo(e.target.value)}
            className="field field-sm w-40"
          />
          <button className="btn-secondary btn-sm">Guardar</button>
        </form>
        {honorarioFijo && (
          <p className="text-slate mt-2">
            Actual: <span className="font-medium text-ink">${honorarioFijo.monto_acordado.toLocaleString('es-CO')}</span>
          </p>
        )}
      </div>

      <div className="card p-4">
        <p className="text-slate mb-2">Registrar horas trabajadas</p>
        <form onSubmit={handleRegistrarHoras} className="flex items-end gap-2">
          <input
            type="number"
            step="0.25"
            placeholder="Horas"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            className="field field-sm w-24"
          />
          <input
            placeholder="Descripción"
            value={descripcionHoras}
            onChange={(e) => setDescripcionHoras(e.target.value)}
            className="flex-1 field field-sm"
          />
          <button className="btn-secondary btn-sm">Registrar</button>
        </form>
        <ul className="text-slate divide-y divide-line mt-3 -mx-4">
          {registrosTiempo.map((r) => (
            <li key={r.id} className="px-4 py-1.5 flex justify-between items-center gap-2">
              <span className="min-w-0 truncate">
                {r.fecha} — {r.horas}h — {r.descripcion || 'sin descripción'}
              </span>
              <span className={r.facturado ? 'badge-success' : 'badge-neutral'}>
                {r.facturado ? 'Facturado' : 'Pendiente'}
              </span>
            </li>
          ))}
          {registrosTiempo.length === 0 && <li className="px-4 py-1.5">Sin horas registradas.</li>}
        </ul>
      </div>

      <div>
        <button
          onClick={handleGenerarCuenta}
          disabled={generando || (horasPendientes.length === 0 && !honorarioFijo)}
          className="btn-primary btn-sm"
        >
          {generando ? 'Generando…' : 'Generar cuenta de cobro'}
        </button>
        {resultado && <p className="text-success mt-2">{resultado}</p>}
        {error && <p className="text-danger mt-2">{error}</p>}
      </div>
    </div>
  )
}
