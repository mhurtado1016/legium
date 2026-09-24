import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
  listarCategorias,
  listarDocumentos,
  listarVersiones,
  subirDocumento,
  urlDescarga,
  type CategoriaDocumento,
  type Documento,
  type DocumentoVersion,
} from '../lib/documentos'
import { generarDocumentoDesdePlantilla, listarPlantillas, type Plantilla } from '../lib/plantillas'
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
  { id: 'actividad', label: 'Actividad' },
  { id: 'sentencias', label: 'Sentencias' },
  { id: 'plazos', label: 'Plazos' },
  { id: 'documentos', label: 'Documentos' },
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
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [registrosTiempo, setRegistrosTiempo] = useState<RegistroTiempo[]>([])
  const [honorarioFijo, setHonorarioFijo] = useState<HonorarioFijo | null>(null)
  const [nuevaNota, setNuevaNota] = useState('')
  const [numeroRadicado, setNumeroRadicado] = useState('')
  const [guardandoRadicado, setGuardandoRadicado] = useState(false)

  async function cargar() {
    if (!id) return
    const [c, uf, t, a, s, p, d, cat, plant, rt, hf] = await Promise.all([
      obtenerCaso(id),
      listarUsuariosFirma(),
      listarTraslados(id),
      listarActividad(id),
      listarSentenciasVinculadas(id),
      listarPlazos({ caso_id: id }),
      listarDocumentos(id),
      listarCategorias(),
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
    setCategorias(cat)
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

          <section id="actividad">
            <h2 className="font-display text-base font-semibold mb-2">Actividad</h2>
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
                <li key={a.id} className="px-4 py-2.5">
                  <span className="text-slate">
                    {new Date(a.created_at).toLocaleDateString('es-CO')} —{' '}
                  </span>
                  {a.descripcion}
                </li>
              ))}
              {actividad.length === 0 && <li className="px-4 py-3 text-slate">Sin actividad aún.</li>}
            </ul>
          </section>

          <section id="sentencias">
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

          <section id="plazos">
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

          <section id="documentos">
            <h2 className="font-display text-base font-semibold mb-2">Documentos</h2>
            <p className="text-sm text-slate mb-3">
              Archivos del caso: escritos, pruebas, contratos o cualquier documento generado a
              partir de una plantilla. Cada archivo se organiza por categoría y mantiene un
              historial de versiones.
            </p>
            {usuario && (
              <DocumentosSeccion
                casoId={caso.id}
                firmaId={usuario.firma_id}
                usuarioId={usuario.id}
                categorias={categorias}
                documentos={documentos}
                plantillas={plantillas}
                onCambio={cargar}
              />
            )}
          </section>

          <section id="facturacion">
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 text-sm">
      <div>
        <label className="block text-slate mb-1">Título</label>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="field field-sm"
        />
      </div>
      <div>
        <label className="block text-slate mb-1">Vence</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="field field-sm"
        />
      </div>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={notificarApp} onChange={(e) => setNotificarApp(e.target.checked)} />
        App
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={notificarEmail} onChange={(e) => setNotificarEmail(e.target.checked)} />
        Email
      </label>
      <label className="flex items-center gap-1">
        <input type="checkbox" checked={notificarPush} onChange={(e) => setNotificarPush(e.target.checked)} />
        Push
      </label>
      <button
        type="submit"
        disabled={guardando}
        className="btn-primary btn-sm"
      >
        {guardando ? 'Guardando…' : 'Agregar plazo'}
      </button>
    </form>
  )
}

function DocumentosSeccion({
  casoId,
  firmaId,
  usuarioId,
  categorias,
  documentos,
  plantillas,
  onCambio,
}: {
  casoId: string
  firmaId: string
  usuarioId: string
  categorias: CategoriaDocumento[]
  documentos: Documento[]
  plantillas: Plantilla[]
  onCambio: () => void
}) {
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? '')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null)
  const [versiones, setVersiones] = useState<DocumentoVersion[]>([])
  const [plantillaId, setPlantillaId] = useState('')
  const [variablesManuales, setVariablesManuales] = useState<Record<string, string>>({})
  const [generando, setGenerando] = useState(false)

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

  async function handleSubir(e: FormEvent) {
    e.preventDefault()
    if (!archivo || !categoriaId) return
    setError(null)
    setSubiendo(true)
    try {
      await subirDocumento({
        file: archivo,
        firmaId,
        casoId,
        usuarioId,
        categoriaId,
        nombre: archivo.name,
      })
      setArchivo(null)
      onCambio()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el documento.')
    } finally {
      setSubiendo(false)
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

  async function handleDescargar(storagePath: string) {
    const url = await urlDescarga(storagePath)
    window.open(url, '_blank')
  }

  const documentosFiltrados = busqueda
    ? documentos.filter((d) => d.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : documentos

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

      <form onSubmit={handleSubir} className="flex flex-wrap items-end gap-3 text-sm mb-4">
        <div>
          <label className="block text-slate mb-1">Categoría</label>
          <select
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="field field-sm"
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-slate mb-1">Archivo</label>
          <input
            type="file"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={subiendo || !archivo}
          className="btn-primary btn-sm"
        >
          {subiendo ? 'Subiendo…' : '+ Subir documento'}
        </button>
      </form>

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
              <th>Categoría</th>
              <th>Versión</th>
              <th>Actualizado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {documentosFiltrados.map((d) => (
              <Fragment key={d.id}>
                <tr>
                  <td className="font-medium text-ink">{d.nombre}</td>
                  <td>{d.categorias_documento?.nombre ?? '—'}</td>
                  <td>
                    {d.ultima_version ? (
                      <button
                        onClick={() => d.ultima_version && handleDescargar(d.ultima_version.storage_path)}
                        className="hover:text-accent transition-colors"
                      >
                        v{d.ultima_version.version_numero}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-slate">
                    {d.ultima_version
                      ? new Date(d.ultima_version.created_at).toLocaleDateString('es-CO')
                      : '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => handleVerHistorial(d.id)}
                      className="link"
                    >
                      historial
                    </button>
                  </td>
                </tr>
                {historialAbierto === d.id && (
                  <tr>
                    <td colSpan={5} className="bg-paper-sunken">
                      <ul className="text-slate space-y-1 py-1">
                        {versiones.map((v) => (
                          <li key={v.id}>
                            v{v.version_numero} — {v.nombre_archivo} —{' '}
                            {new Date(v.created_at).toLocaleDateString('es-CO')} —{' '}
                            <button onClick={() => handleDescargar(v.storage_path)} className="underline hover:text-ink">
                              descargar
                            </button>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {documentosFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-slate text-center">
                  Sin documentos todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CardList>
        {documentosFiltrados.map((d) => (
          <DataCard key={d.id}>
            <CardHeader>
              <span className="font-medium text-ink">{d.nombre}</span>
            </CardHeader>
            <CardRow label="Categoría">{d.categorias_documento?.nombre ?? '—'}</CardRow>
            <CardRow label="Versión">
              {d.ultima_version ? (
                <button
                  onClick={() => d.ultima_version && handleDescargar(d.ultima_version.storage_path)}
                  className="hover:text-accent transition-colors"
                >
                  v{d.ultima_version.version_numero}
                </button>
              ) : (
                '—'
              )}
            </CardRow>
            <CardRow label="Actualizado">
              {d.ultima_version ? new Date(d.ultima_version.created_at).toLocaleDateString('es-CO') : '—'}
            </CardRow>
            <CardActions>
              <button onClick={() => handleVerHistorial(d.id)} className="link">
                historial
              </button>
            </CardActions>
            {historialAbierto === d.id && (
              <ul className="text-slate text-xs space-y-1 pt-2 border-t border-line">
                {versiones.map((v) => (
                  <li key={v.id}>
                    v{v.version_numero} — {v.nombre_archivo} — {new Date(v.created_at).toLocaleDateString('es-CO')} —{' '}
                    <button onClick={() => handleDescargar(v.storage_path)} className="underline hover:text-ink">
                      descargar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
        ))}
        {documentosFiltrados.length === 0 && <CardEmpty>Sin documentos todavía.</CardEmpty>}
      </CardList>
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
