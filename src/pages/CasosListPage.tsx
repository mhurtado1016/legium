import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { Modal } from '../components/Modal'
import { useUsuario } from '../lib/useUsuario'
import {
  crearCaso,
  crearCliente,
  listarCasos,
  listarClientes,
  type Caso,
  type Cliente,
  type ColumnaOrdenCaso,
  type EstadoCaso,
  type TipoCaso,
} from '../lib/casos'
import { listarPlazos, type Plazo } from '../lib/plazos'

const ESTADOS: EstadoCaso[] = ['abierto', 'en_curso', 'suspendido', 'cerrado']
const TIPOS: TipoCaso[] = ['litigio', 'consultoria']
const COLUMNAS: { id: ColumnaOrdenCaso; label: string }[] = [
  { id: 'titulo', label: 'Título' },
  { id: 'cliente', label: 'Cliente' },
  { id: 'tipo', label: 'Tipo' },
  { id: 'numero_radicado', label: 'Radicado' },
  { id: 'estado', label: 'Estado' },
  { id: 'created_at', label: 'Creado' },
]

type ResumenKey = 'total' | 'abiertos' | 'pendientes' | 'cerrados' | 'vencidos'

const RESUMEN_TITULOS: Record<ResumenKey, string> = {
  total: 'Todos los casos',
  abiertos: 'Casos abiertos',
  pendientes: 'Casos pendientes',
  cerrados: 'Casos cerrados',
  vencidos: 'Casos con plazos vencidos',
}

/**
 * Listado de casos, con filtro por estado, tipo, radicado y cliente
 * (sección 5.4). Incluye un formulario mínimo de alta de caso (+ cliente
 * nuevo si hace falta) para poder probar el módulo de punta a punta.
 */
export function CasosListPage() {
  const { usuario } = useUsuario()
  const [casos, setCasos] = useState<Caso[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtroEstado, setFiltroEstado] = useState<EstadoCaso | ''>('')
  const [filtroTipo, setFiltroTipo] = useState<TipoCaso | ''>('')
  const [filtroRadicado, setFiltroRadicado] = useState('')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroTitulo, setFiltroTitulo] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [orderBy, setOrderBy] = useState<ColumnaOrdenCaso>('created_at')
  const [orderAsc, setOrderAsc] = useState(false)

  const [todosCasos, setTodosCasos] = useState<Caso[]>([])
  const [plazosVencidos, setPlazosVencidos] = useState<Plazo[]>([])
  const [modalResumen, setModalResumen] = useState<ResumenKey | null>(null)

  async function cargarResumen() {
    const [c, p] = await Promise.all([listarCasos(), listarPlazos({ estado: 'vencido' })])
    setTodosCasos(c)
    setPlazosVencidos(p)
  }

  useEffect(() => {
    cargarResumen()
  }, [])

  const plazosVencidosPorCaso = useMemo(() => {
    const map = new Map<string, Plazo[]>()
    for (const p of plazosVencidos) {
      const lista = map.get(p.caso_id) ?? []
      lista.push(p)
      map.set(p.caso_id, lista)
    }
    return map
  }, [plazosVencidos])

  const resumen = useMemo(() => {
    const abiertos = todosCasos.filter((c) => c.estado === 'abierto')
    const cerrados = todosCasos.filter((c) => c.estado === 'cerrado')
    const pendientes = todosCasos.filter((c) => c.estado === 'en_curso' || c.estado === 'suspendido')
    const vencidos = todosCasos.filter((c) => plazosVencidosPorCaso.has(c.id))
    return { total: todosCasos, abiertos, cerrados, pendientes, vencidos }
  }, [todosCasos, plazosVencidosPorCaso])

  async function cargar() {
    const [c, cl] = await Promise.all([
      listarCasos({
        estado: filtroEstado || undefined,
        tipo: filtroTipo || undefined,
        numeroRadicado: filtroRadicado || undefined,
        clienteNombre: filtroCliente || undefined,
        titulo: filtroTitulo || undefined,
        orderBy,
        orderAsc,
      }),
      listarClientes(),
    ])
    setCasos(c)
    setClientes(cl)
  }

  useEffect(() => {
    const timeout = setTimeout(cargar, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, filtroTipo, filtroRadicado, filtroCliente, filtroTitulo, orderBy, orderAsc])

  function handleOrdenar(columna: ColumnaOrdenCaso) {
    if (columna === orderBy) {
      setOrderAsc((v) => !v)
    } else {
      setOrderBy(columna)
      setOrderAsc(true)
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />

      <main className="px-6 py-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h1 className="font-display text-lg">Casos</h1>
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className="btn-primary btn-sm"
          >
            + Nuevo caso
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <ResumenCard
            label="Total"
            value={resumen.total.length}
            onClick={() => setModalResumen('total')}
          />
          <ResumenCard
            label="Abiertos"
            value={resumen.abiertos.length}
            onClick={() => setModalResumen('abiertos')}
          />
          <ResumenCard
            label="Pendientes"
            value={resumen.pendientes.length}
            onClick={() => setModalResumen('pendientes')}
          />
          <ResumenCard
            label="Cerrados"
            value={resumen.cerrados.length}
            onClick={() => setModalResumen('cerrados')}
          />
          <ResumenCard
            label="Plazos vencidos"
            value={resumen.vencidos.length}
            onClick={() => setModalResumen('vencidos')}
            alerta={resumen.vencidos.length > 0}
          />
        </div>

        {modalResumen && (
          <Modal title={RESUMEN_TITULOS[modalResumen]} onClose={() => setModalResumen(null)}>
            <ul className="divide-y divide-line">
              {resumen[modalResumen].map((c) => (
                <li key={c.id} className="py-2">
                  <Link
                    to={`/app/casos/${c.id}`}
                    onClick={() => setModalResumen(null)}
                    className="font-medium hover:underline"
                  >
                    {c.titulo}
                  </Link>
                  <div className="text-xs text-slate">
                    {c.clientes?.nombre ?? '—'} · {c.estado}
                  </div>
                  {modalResumen === 'vencidos' && (
                    <div className="text-xs text-red-600 mt-0.5">
                      Plazo(s) vencido(s):{' '}
                      {(plazosVencidosPorCaso.get(c.id) ?? []).map((p) => p.titulo).join(', ')}
                    </div>
                  )}
                </li>
              ))}
              {resumen[modalResumen].length === 0 && (
                <li className="py-4 text-sm text-slate">No hay casos en esta categoría.</li>
              )}
            </ul>
          </Modal>
        )}

        <div className="flex items-end gap-3 flex-wrap mb-4">
          <div>
            <label className="block text-sm text-slate mb-1">Título</label>
            <input
              value={filtroTitulo}
              onChange={(e) => setFiltroTitulo(e.target.value)}
              placeholder="Buscar por título…"
              className="field field-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate mb-1">Radicado</label>
            <input
              value={filtroRadicado}
              onChange={(e) => setFiltroRadicado(e.target.value)}
              placeholder="Buscar por radicado…"
              className="field field-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate mb-1">Cliente</label>
            <input
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              placeholder="Buscar por cliente…"
              className="field field-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate mb-1">Tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoCaso | '')}
              className="field field-sm"
            >
              <option value="">Todos los tipos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate mb-1">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoCaso | '')}
              className="field field-sm"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mostrarForm && usuario && (
          <NuevoCasoForm
            firmaId={usuario.firma_id}
            responsableId={usuario.id}
            clientes={clientes}
            onCreado={() => {
              setMostrarForm(false)
              cargar()
              cargarResumen()
            }}
          />
        )}

        <table className="w-full text-sm border-t border-line">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate border-b border-line">
              {COLUMNAS.map((col) => (
                <th key={col.id} className="py-2">
                  <button
                    onClick={() => handleOrdenar(col.id)}
                    className="flex items-center gap-1 uppercase tracking-wide hover:text-ink"
                  >
                    {col.label}
                    {orderBy === col.id && <span>{orderAsc ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {casos.map((c) => (
              <tr key={c.id}>
                <td className="py-2">
                  <Link to={`/app/casos/${c.id}`} className="hover:underline">
                    {c.titulo}
                  </Link>
                </td>
                <td className="py-2">{c.clientes?.nombre ?? '—'}</td>
                <td className="py-2">{c.tipo}</td>
                <td className="py-2">{c.numero_radicado ?? '—'}</td>
                <td className="py-2">{c.estado}</td>
                <td className="py-2 text-slate">
                  {new Date(c.created_at).toLocaleDateString('es-CO')}
                </td>
              </tr>
            ))}
            {casos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-slate">
                  No hay casos con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}

function ResumenCard({
  label,
  value,
  onClick,
  alerta,
}: {
  label: string
  value: number
  onClick: () => void
  alerta?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={
        'card p-3 text-left hover:border-ink transition-colors' +
        (alerta ? ' border-red-400 text-red-700' : '')
      }
    >
      <div className="font-display text-2xl">{value}</div>
      <div className="text-xs text-slate uppercase tracking-wide">{label}</div>
    </button>
  )
}

function NuevoCasoForm({
  firmaId,
  responsableId,
  clientes,
  onCreado,
}: {
  firmaId: string
  responsableId: string
  clientes: Cliente[]
  onCreado: () => void
}) {
  const [clienteId, setClienteId] = useState('')
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
  const [tipo, setTipo] = useState<TipoCaso>('litigio')
  const [titulo, setTitulo] = useState('')
  const [numeroRadicado, setNumeroRadicado] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    try {
      let idCliente = clienteId
      if (!idCliente && nuevoClienteNombre) {
        const cliente = await crearCliente({
          firma_id: firmaId,
          tipo: 'persona_natural',
          nombre: nuevoClienteNombre,
          identificacion: null,
          email: null,
          telefono: null,
        })
        idCliente = cliente.id
      }
      if (!idCliente) return

      await crearCaso({
        firma_id: firmaId,
        cliente_id: idCliente,
        responsable_id: responsableId,
        tipo,
        titulo,
        descripcion: null,
        numero_radicado: numeroRadicado || null,
      })
      onCreado()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card p-4 mb-6 space-y-3 max-w-lg">
      <div>
        <label className="block text-sm text-slate mb-1">Cliente existente</label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="w-full field field-sm"
        >
          <option value="">— o crear uno nuevo abajo —</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      {!clienteId && (
        <div>
          <label className="block text-sm text-slate mb-1">Nombre del cliente nuevo</label>
          <input
            value={nuevoClienteNombre}
            onChange={(e) => setNuevoClienteNombre(e.target.value)}
            className="w-full field field-sm"
          />
        </div>
      )}
      <div>
        <label className="block text-sm text-slate mb-1">Tipo</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCaso)}
          className="w-full field field-sm"
        >
          <option value="litigio">Litigio</option>
          <option value="consultoria">Consultoría</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-slate mb-1">Título</label>
        <input
          value={titulo}
          required
          onChange={(e) => setTitulo(e.target.value)}
          className="w-full field field-sm"
        />
      </div>
      <div>
        <label className="block text-sm text-slate mb-1">Número de radicado (opcional)</label>
        <input
          value={numeroRadicado}
          onChange={(e) => setNumeroRadicado(e.target.value)}
          className="w-full field field-sm"
        />
      </div>
      <button
        type="submit"
        disabled={guardando}
        className="btn-primary btn-sm"
      >
        {guardando ? 'Guardando…' : 'Crear caso'}
      </button>
    </form>
  )
}
