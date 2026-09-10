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

const ESTADOS: EstadoCaso[] = ['abierto', 'en_curso', 'suspendido', 'cerrado']
const SECCIONES = [
  { id: 'datos', label: 'Datos' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'sentencias', label: 'Sentencias' },
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
  const [nuevaNota, setNuevaNota] = useState('')

  async function cargar() {
    if (!id) return
    const [c, a, s] = await Promise.all([
      obtenerCaso(id),
      listarActividad(id),
      listarSentenciasVinculadas(id),
    ])
    setCaso(c)
    setActividad(a)
    setSentencias(s)
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

          <section id="documentos">
            <h2 className="font-display text-base mb-2">Documentos</h2>
            <p className="text-sm text-slate">Módulo 4, pendiente de implementar (Fase 4).</p>
          </section>
        </div>
      </div>
    </div>
  )
}
