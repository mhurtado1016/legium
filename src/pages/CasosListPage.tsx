import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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

/**
 * Listado de casos, con filtro por estado (sección 5.4).
 * Incluye un formulario mínimo de alta de caso (+ cliente nuevo si hace
 * falta) para poder probar el módulo de punta a punta.
 */
export function CasosListPage() {
  const { usuario } = useUsuario()
  const [casos, setCasos] = useState<Caso[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [filtroEstado, setFiltroEstado] = useState<EstadoCaso | ''>('')
  const [mostrarForm, setMostrarForm] = useState(false)

  async function cargar() {
    const [c, cl] = await Promise.all([
      listarCasos(filtroEstado ? { estado: filtroEstado } : undefined),
      listarClientes(),
    ])
    setCasos(c)
    setClientes(cl)
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link to="/" className="font-display text-xl">
          Legium
        </Link>
        <nav className="text-sm text-slate flex gap-4">
          <Link to="/casos" className="text-ink underline underline-offset-4">
            Casos
          </Link>
          <Link to="/plazos" className="hover:text-ink">
            Plazos
          </Link>
        </nav>
      </header>

      <main className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-lg">Casos</h1>
          <div className="flex items-center gap-3">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoCaso | '')}
              className="border border-line bg-paper-raised px-2 py-1 text-sm"
            >
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <button
              onClick={() => setMostrarForm((v) => !v)}
              className="bg-ink text-paper-raised px-4 py-1.5 text-sm hover:bg-ink/90"
            >
              + Nuevo caso
            </button>
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
            <tr className="text-left text-slate border-b border-line">
              <th className="py-2">Título</th>
              <th className="py-2">Cliente</th>
              <th className="py-2">Tipo</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {casos.map((c) => (
              <tr key={c.id}>
                <td className="py-2">
                  <Link to={`/casos/${c.id}`} className="hover:underline">
                    {c.titulo}
                  </Link>
                </td>
                <td className="py-2">{c.clientes?.nombre ?? '—'}</td>
                <td className="py-2">{c.tipo}</td>
                <td className="py-2">{c.estado}</td>
              </tr>
            ))}
            {casos.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-slate">
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
      })
      onCreado()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line p-4 mb-6 space-y-3 max-w-lg">
      <div>
        <label className="block text-sm text-slate mb-1">Cliente existente</label>
        <select
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className="w-full border border-line bg-paper-raised px-2 py-1.5"
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
            className="w-full border border-line bg-paper-raised px-2 py-1.5"
          />
        </div>
      )}
      <div>
        <label className="block text-sm text-slate mb-1">Tipo</label>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoCaso)}
          className="w-full border border-line bg-paper-raised px-2 py-1.5"
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
          className="w-full border border-line bg-paper-raised px-2 py-1.5"
        />
      </div>
      <button
        type="submit"
        disabled={guardando}
        className="bg-ink text-paper-raised px-4 py-1.5 text-sm hover:bg-ink/90 disabled:opacity-60"
      >
        {guardando ? 'Guardando…' : 'Crear caso'}
      </button>
    </form>
  )
}
