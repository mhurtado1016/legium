import { Fragment, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useUsuario } from '../lib/useUsuario'
import {
  actualizarEstadoCaso,
  agregarActividad,
  listarActividad,
  listarSentenciasVinculadas,
  obtenerCaso,
  type Caso,
  type CasoActividad,
  type CasoSentencia,
  type EstadoCaso,
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
  const [actividad, setActividad] = useState<CasoActividad[]>([])
  const [sentencias, setSentencias] = useState<CasoSentencia[]>([])
  const [plazos, setPlazos] = useState<Plazo[]>([])
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [registrosTiempo, setRegistrosTiempo] = useState<RegistroTiempo[]>([])
  const [honorarioFijo, setHonorarioFijo] = useState<HonorarioFijo | null>(null)
  const [nuevaNota, setNuevaNota] = useState('')

  async function cargar() {
    if (!id) return
    const [c, a, s, p, d, cat, plant, rt, hf] = await Promise.all([
      obtenerCaso(id),
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
      <header className="flex items-center gap-4 border-b border-line px-6 py-4">
        <Link to="/casos" className="text-sm text-slate hover:text-ink">
          ← Casos
        </Link>
        <h1 className="font-display text-lg">{caso.titulo}</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-8 px-6 py-6">
        <nav className="text-sm text-slate space-y-2 self-start">
          <p className="text-ink mb-1">En esta página</p>
          {SECCIONES.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block hover:text-ink">
              {s.label}
            </a>
          ))}
        </nav>

        <div className="max-w-2xl space-y-8">
          <section id="datos">
            <h2 className="font-display text-base mb-2">Datos generales</h2>
            <p className="text-sm">
              Cliente: {caso.clientes?.nombre ?? '—'} · Tipo: {caso.tipo}
            </p>
            <p className="text-sm text-slate">
              Estado:{' '}
              <select
                value={caso.estado}
                onChange={(e) => handleCambiarEstado(e.target.value as EstadoCaso)}
                className="border border-line bg-paper-raised px-1 py-0.5"
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </p>
            {caso.tipo === 'litigio' && (
              <p className="text-sm text-slate mt-1">
                Radicado: {caso.numero_radicado ?? '—'} · Despacho: {caso.despacho_judicial ?? '—'}{' '}
                · Etapa: {caso.etapa_procesal ?? '—'}
              </p>
            )}
          </section>

          <hr className="border-line" />

          <section id="actividad">
            <h2 className="font-display text-base mb-2">Actividad</h2>
            <form onSubmit={handleAgregarNota} className="flex gap-2 mb-3">
              <input
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                placeholder="Agregar nota…"
                className="flex-1 border border-line bg-paper-raised px-2 py-1 text-sm"
              />
              <button className="bg-ink text-paper-raised px-3 py-1 text-sm hover:bg-ink/90">
                Agregar
              </button>
            </form>
            <ul className="text-sm divide-y divide-line">
              {actividad.map((a) => (
                <li key={a.id} className="py-2">
                  <span className="text-slate">
                    {new Date(a.created_at).toLocaleDateString('es-CO')} —{' '}
                  </span>
                  {a.descripcion}
                </li>
              ))}
              {actividad.length === 0 && <li className="py-2 text-slate">Sin actividad aún.</li>}
            </ul>
          </section>

          <hr className="border-line" />

          <section id="sentencias">
            <h2 className="font-display text-base mb-2">Sentencias vinculadas</h2>
            <ul className="text-sm divide-y divide-line">
              {sentencias.map((s) => (
                <li key={s.id} className="py-2">
                  {s.sentencias_cache.sentencia} · {s.sentencias_cache.sala ?? '—'}
                  {s.nota && <span className="text-slate"> — nota: {s.nota}</span>}
                </li>
              ))}
              {sentencias.length === 0 && (
                <li className="py-2 text-slate">
                  Ninguna todavía. Vincula sentencias desde el buscador (pendiente de integrar
                  aquí).
                </li>
              )}
            </ul>
          </section>

          <hr className="border-line" />

          <section id="plazos">
            <h2 className="font-display text-base mb-2">Plazos</h2>
            {usuario && (
              <NuevoPlazoForm
                casoId={caso.id}
                firmaId={usuario.firma_id}
                usuarioId={usuario.id}
                onCreado={cargar}
              />
            )}
            <ul className="text-sm divide-y divide-line mt-3">
              {plazos.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between">
                  <span>
                    {p.titulo} — vence {new Date(p.fecha_vencimiento).toLocaleDateString('es-CO')}{' '}
                    <span className="text-slate">({p.estado})</span>
                  </span>
                  {p.estado !== 'cumplido' && (
                    <button
                      onClick={async () => {
                        await marcarCumplido(p.id)
                        cargar()
                      }}
                      className="text-slate hover:text-ink underline underline-offset-4"
                    >
                      marcar cumplido
                    </button>
                  )}
                </li>
              ))}
              {plazos.length === 0 && <li className="py-2 text-slate">Sin plazos para este caso.</li>}
            </ul>
          </section>

          <hr className="border-line" />

          <section id="documentos">
            <h2 className="font-display text-base mb-2">Documentos</h2>
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

          <hr className="border-line" />

          <section id="facturacion">
            <h2 className="font-display text-base mb-2">Facturación</h2>
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
          className="border border-line bg-paper-raised px-2 py-1"
        />
      </div>
      <div>
        <label className="block text-slate mb-1">Vence</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-line bg-paper-raised px-2 py-1"
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
        className="bg-ink text-paper-raised px-3 py-1.5 hover:bg-ink/90 disabled:opacity-60"
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
        <form onSubmit={handleGenerarDesdePlantilla} className="border border-line p-3 mb-4 space-y-2 text-sm">
          <p className="text-slate">Generar desde plantilla</p>
          <div className="flex flex-wrap items-end gap-3">
            <select
              value={plantillaId}
              onChange={(e) => {
                setPlantillaId(e.target.value)
                setVariablesManuales({})
              }}
              className="border border-line bg-paper-raised px-2 py-1"
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
                className="bg-ink text-paper-raised px-3 py-1.5 hover:bg-ink/90 disabled:opacity-60"
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
                className="w-full max-w-sm border border-line bg-paper-raised px-2 py-1"
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
            className="border border-line bg-paper-raised px-2 py-1"
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
          className="bg-ink text-paper-raised px-3 py-1.5 hover:bg-ink/90 disabled:opacity-60"
        >
          {subiendo ? 'Subiendo…' : '+ Subir documento'}
        </button>
      </form>

      {error && <p className="text-sm text-seal mb-3">{error}</p>}

      <input
        type="text"
        placeholder="Buscar por nombre…"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="border border-line bg-paper-raised px-2 py-1 text-sm mb-3 w-full max-w-xs"
      />

      <table className="w-full text-sm border-t border-line">
        <thead>
          <tr className="text-left text-slate border-b border-line">
            <th className="py-2">Nombre</th>
            <th className="py-2">Categoría</th>
            <th className="py-2">Versión</th>
            <th className="py-2">Actualizado</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {documentosFiltrados.map((d) => (
            <Fragment key={d.id}>
              <tr>
                <td className="py-2">{d.nombre}</td>
                <td className="py-2">{d.categorias_documento?.nombre ?? '—'}</td>
                <td className="py-2">
                  {d.ultima_version ? (
                    <button
                      onClick={() => d.ultima_version && handleDescargar(d.ultima_version.storage_path)}
                      className="hover:underline"
                    >
                      v{d.ultima_version.version_numero}
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 text-slate">
                  {d.ultima_version
                    ? new Date(d.ultima_version.created_at).toLocaleDateString('es-CO')
                    : '—'}
                </td>
                <td className="py-2">
                  <button
                    onClick={() => handleVerHistorial(d.id)}
                    className="text-slate hover:text-ink underline underline-offset-4"
                  >
                    historial
                  </button>
                </td>
              </tr>
              {historialAbierto === d.id && (
                <tr>
                  <td colSpan={5} className="py-2 pl-4">
                    <ul className="text-slate space-y-1">
                      {versiones.map((v) => (
                        <li key={v.id}>
                          v{v.version_numero} — {v.nombre_archivo} —{' '}
                          {new Date(v.created_at).toLocaleDateString('es-CO')} —{' '}
                          <button onClick={() => handleDescargar(v.storage_path)} className="underline">
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
              <td colSpan={5} className="py-4 text-slate">
                Sin documentos todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
    <div className="text-sm space-y-4">
      <div>
        <p className="text-slate mb-1">Honorario fijo (si aplica)</p>
        <form onSubmit={handleGuardarHonorarioFijo} className="flex items-end gap-2">
          <input
            type="number"
            step="0.01"
            placeholder="Monto acordado"
            value={montoFijo}
            onChange={(e) => setMontoFijo(e.target.value)}
            className="border border-line bg-paper-raised px-2 py-1 w-40"
          />
          <button className="bg-ink text-paper-raised px-3 py-1.5 hover:bg-ink/90">Guardar</button>
        </form>
        {honorarioFijo && (
          <p className="text-slate mt-1">
            Actual: ${honorarioFijo.monto_acordado.toLocaleString('es-CO')}
          </p>
        )}
      </div>

      <div>
        <p className="text-slate mb-1">Registrar horas trabajadas</p>
        <form onSubmit={handleRegistrarHoras} className="flex items-end gap-2">
          <input
            type="number"
            step="0.25"
            placeholder="Horas"
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            className="border border-line bg-paper-raised px-2 py-1 w-24"
          />
          <input
            placeholder="Descripción"
            value={descripcionHoras}
            onChange={(e) => setDescripcionHoras(e.target.value)}
            className="border border-line bg-paper-raised px-2 py-1 flex-1"
          />
          <button className="bg-ink text-paper-raised px-3 py-1.5 hover:bg-ink/90">Registrar</button>
        </form>
        <ul className="text-slate divide-y divide-line mt-2">
          {registrosTiempo.map((r) => (
            <li key={r.id} className="py-1 flex justify-between">
              <span>
                {r.fecha} — {r.horas}h — {r.descripcion || 'sin descripción'}
              </span>
              <span>{r.facturado ? 'facturado' : 'pendiente'}</span>
            </li>
          ))}
          {registrosTiempo.length === 0 && <li className="py-1">Sin horas registradas.</li>}
        </ul>
      </div>

      <div>
        <button
          onClick={handleGenerarCuenta}
          disabled={generando || (horasPendientes.length === 0 && !honorarioFijo)}
          className="bg-ink text-paper-raised px-4 py-1.5 hover:bg-ink/90 disabled:opacity-60"
        >
          {generando ? 'Generando…' : 'Generar cuenta de cobro'}
        </button>
        {resultado && <p className="text-slate mt-2">{resultado}</p>}
        {error && <p className="text-seal mt-2">{error}</p>}
      </div>
    </div>
  )
}
