import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useUsuario } from '../lib/useUsuario'
import {
  crearCaso,
  crearCliente,
  listarCasos,
  listarClientes,
  type Caso,
  type Cliente,
  type EstadoCaso,
  type TipoCaso,
} from '../lib/casos'

const ESTADOS: EstadoCaso[] = ['abierto', 'en_curso', 'suspendido', 'cerrado']
const TIPOS: TipoCaso[] = ['litigio', 'consultoria']

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
  const [mostrarForm, setMostrarForm] = useState(false)

  async function cargar() {
    const [c, cl] = await Promise.all([
      listarCasos({
        estado: filtroEstado || undefined,
        tipo: filtroTipo || undefined,
        numeroRadicado: filtroRadicado || undefined,
        clienteNombre: filtroCliente || undefined,
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
  }, [filtroEstado, filtroTipo, filtroRadicado, filtroCliente])

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

        <div className="flex items-end gap-3 flex-wrap mb-4">
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
            }}
          />
        )}

        <table className="w-full text-sm border-t border-line">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate border-b border-line">
              <th className="py-2">Título</th>
              <th className="py-2">Cliente</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Radicado</th>
              <th className="py-2">Estado</th>
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
              </tr>
            ))}
            {casos.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-slate">
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
