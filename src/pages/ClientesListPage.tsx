import { useEffect, useState, type FormEvent } from 'react'
import { AppHeader } from '../components/AppHeader'
import { Modal } from '../components/Modal'
import { actualizarCliente, listarClientes, type Cliente } from '../lib/casos'

/**
 * Listado de clientes de la firma: consulta y edición de sus datos
 * (incluido el teléfono en formato WhatsApp, para poder contactarlos por
 * ese canal — ver supabase/functions/enviar-whatsapp). La creación de
 * clientes nuevos sigue haciéndose desde "Nuevo caso" en /app/casos.
 */
export function ClientesListPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [filtroNombre, setFiltroNombre] = useState('')
  const [editando, setEditando] = useState<Cliente | null>(null)

  async function cargar() {
    setCargando(true)
    try {
      setClientes(await listarClientes({ nombre: filtroNombre || undefined }))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(cargar, 300)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroNombre])

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-slate mt-1">Consulta y edita los datos de los clientes de la firma.</p>
        </div>

        <div className="card p-4 flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-sm text-slate mb-1">Nombre</label>
            <input
              value={filtroNombre}
              onChange={(e) => setFiltroNombre(e.target.value)}
              placeholder="Buscar por nombre…"
              className="field field-sm"
            />
          </div>
        </div>

        {cargando ? (
          <p className="text-sm text-slate">Cargando…</p>
        ) : (
          <div className="card overflow-hidden overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Identificación</th>
                  <th>Correo</th>
                  <th>WhatsApp</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-ink">{c.nombre}</td>
                    <td className="capitalize">{c.tipo === 'empresa' ? 'Empresa' : 'Persona natural'}</td>
                    <td className="text-slate">{c.identificacion ?? '—'}</td>
                    <td className="text-slate">{c.email ?? '—'}</td>
                    <td className="text-slate">{c.telefono ?? '—'}</td>
                    <td>
                      <div className="flex items-center justify-end text-xs">
                        <button onClick={() => setEditando(c)} className="link">
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-slate text-center">
                      No hay clientes con este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editando && (
        <EditarClienteModal
          cliente={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            cargar()
          }}
        />
      )}
    </div>
  )
}

function EditarClienteModal({
  cliente,
  onClose,
  onGuardado,
}: {
  cliente: Cliente
  onClose: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(cliente.nombre)
  const [tipo, setTipo] = useState(cliente.tipo)
  const [identificacion, setIdentificacion] = useState(cliente.identificacion ?? '')
  const [email, setEmail] = useState(cliente.email ?? '')
  const [telefono, setTelefono] = useState(cliente.telefono ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Mismo criterio de "número válido" que el resto de la app (ver
    // EditarUsuarioModal en AdministracionPage.tsx): al menos 8 dígitos
    // con el indicativo de país incluido.
    const telefonoLimpio = telefono.trim()
    if (telefonoLimpio && telefonoLimpio.replace(/\D/g, '').length < 8) {
      setError('El número de WhatsApp no parece completo (incluye el indicativo de país, ej. +57 300 123 4567).')
      return
    }

    setGuardando(true)
    try {
      await actualizarCliente(cliente.id, {
        nombre: nombre.trim(),
        tipo,
        identificacion: identificacion.trim() || null,
        email: email.trim() || null,
        telefono: telefonoLimpio || null,
      })
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title="Editar cliente" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <div>
          <label className="block text-slate mb-1">Nombre</label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            className="w-full field field-sm"
          />
        </div>
        <div>
          <label className="block text-slate mb-1">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as Cliente['tipo'])}
            className="w-full field field-sm"
          >
            <option value="persona_natural">Persona natural</option>
            <option value="empresa">Empresa</option>
          </select>
        </div>
        <div>
          <label className="block text-slate mb-1">Identificación</label>
          <input
            value={identificacion}
            onChange={(e) => setIdentificacion(e.target.value)}
            className="w-full field field-sm"
          />
        </div>
        <div>
          <label className="block text-slate mb-1">Correo</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full field field-sm"
          />
        </div>
        <div>
          <label className="block text-slate mb-1">Teléfono (WhatsApp)</label>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+57 300 123 4567"
            className="w-full field field-sm"
          />
        </div>
        {error && <p className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="btn-primary btn-sm">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
