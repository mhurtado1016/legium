import { useEffect, useState, type FormEvent } from 'react'
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

const ESTADOS: EstadoCaso[] = ['abierto', 'en_curso', 'suspendido', 'cerrado']
const SECCIONES = [
  { id: 'datos', label: 'Datos' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'sentencias', label: 'Sentencias' },
  { id: 'plazos', label: 'Plazos' },
  { id: 'documentos', label: 'Documentos' },
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
  const [nuevaNota, setNuevaNota] = useState('')

  async function cargar() {
    if (!id) return
    const [c, a, s, p] = await Promise.all([
      obtenerCaso(id),
      listarActividad(id),
      listarSentenciasVinculadas(id),
      listarPlazos({ caso_id: id }),
    ])
    setCaso(c)
    setActividad(a)
    setSentencias(s)
    setPlazos(p)
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
            <p className="text-sm text-slate">Módulo 4, pendiente de implementar (Fase 4).</p>
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
