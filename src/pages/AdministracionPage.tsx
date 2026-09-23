import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, Plus, UserCog } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { useUsuario } from '../lib/useUsuario'
import { actualizarUsuario, invitarUsuario, listarUsuarios, type UsuarioAdmin } from '../lib/administracion'

/**
 * Panel de administración — gestión de usuarios de la firma (punto 1 del
 * portal administrativo). Solo llega aquí quien es `es_administrador`
 * (guard en App.tsx). Invitar crea el usuario de Auth desde una Edge
 * Function (requiere service_role); activar/desactivar y cambiar el rol
 * de administrador es un update directo, ya cubierto por RLS.
 */
export function AdministracionPage() {
  const { usuario } = useUsuario()
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarInvitar, setMostrarInvitar] = useState(false)
  const [editando, setEditando] = useState<UsuarioAdmin | null>(null)

  async function cargar() {
    setCargando(true)
    try {
      setUsuarios(await listarUsuarios())
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function handleCambio(id: string, cambios: { activo?: boolean; es_administrador?: boolean }) {
    const anterior = usuarios
    setUsuarios((prev) => prev.map((u) => (u.id === id ? { ...u, ...cambios } : u)))
    try {
      await actualizarUsuario(id, cambios)
    } catch (err) {
      setUsuarios(anterior)
      alert(err instanceof Error ? err.message : 'No se pudo actualizar el usuario.')
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Administración</h1>
            <p className="text-sm text-slate mt-1">Usuarios de la firma: invitar, activar/desactivar y roles.</p>
          </div>
          <button type="button" onClick={() => setMostrarInvitar(true)} className="btn-primary btn-sm">
            <Plus size={14} strokeWidth={1.75} />
            Invitar usuario
          </button>
        </div>

        {cargando ? (
          <p className="text-sm text-slate flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
            Cargando…
          </p>
        ) : (
          <div className="card overflow-hidden overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>WhatsApp</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const esUnoMismo = u.id === usuario?.id
                  return (
                    <tr key={u.id}>
                      <td className="font-medium text-ink">{u.nombre ?? '—'}</td>
                      <td className="text-slate">{u.email ?? '—'}</td>
                      <td className="text-slate">{u.telefono_whatsapp ?? '—'}</td>
                      <td>
                        <StatusBadge estado={u.es_administrador ? 'administrador' : 'miembro'} />
                      </td>
                      <td>
                        <StatusBadge estado={u.activo ? 'activo' : 'inactivo'} />
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-3 text-xs">
                          <button onClick={() => setEditando(u)} className="link">
                            Editar
                          </button>
                          <button
                            onClick={() => handleCambio(u.id, { es_administrador: !u.es_administrador })}
                            disabled={esUnoMismo}
                            className="link disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
                            title={esUnoMismo ? 'No puedes cambiar tu propio rol' : undefined}
                          >
                            {u.es_administrador ? 'Quitar admin' : 'Hacer admin'}
                          </button>
                          <button
                            onClick={() => handleCambio(u.id, { activo: !u.activo })}
                            disabled={esUnoMismo}
                            className="link disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
                            title={esUnoMismo ? 'No puedes desactivarte a ti mismo' : undefined}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-slate text-center">
                      No hay usuarios registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {mostrarInvitar && (
        <InvitarUsuarioModal
          onClose={() => setMostrarInvitar(false)}
          onInvitado={() => {
            setMostrarInvitar(false)
            cargar()
          }}
        />
      )}

      {editando && (
        <EditarUsuarioModal
          usuario={editando}
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

function InvitarUsuarioModal({ onClose, onInvitado }: { onClose: () => void; onInvitado: () => void }) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await invitarUsuario(nombre, email)
      setEnviado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la invitación.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title="Invitar usuario" onClose={onClose}>
      {enviado ? (
        <div className="space-y-4 text-sm">
          <p className="flex items-start gap-2 text-slate">
            <UserCog size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-success" />
            Se envió un correo de invitación a <span className="font-medium text-ink">{email}</span>. Podrá fijar su
            contraseña siguiendo el enlace del correo.
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={onInvitado} className="btn-primary btn-sm">
              Listo
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-slate mb-1">Nombre</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full field field-sm" />
          </div>
          <div>
            <label className="block text-slate mb-1">Correo</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full field field-sm"
            />
          </div>
          {error && <p className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary btn-sm">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary btn-sm">
              {guardando ? 'Enviando…' : 'Enviar invitación'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

function EditarUsuarioModal({
  usuario,
  onClose,
  onGuardado,
}: {
  usuario: UsuarioAdmin
  onClose: () => void
  onGuardado: () => void
}) {
  const [nombre, setNombre] = useState(usuario.nombre ?? '')
  const [telefonoWhatsapp, setTelefonoWhatsapp] = useState(usuario.telefono_whatsapp ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    // Mismo criterio de "número válido" que el cliente de WhatsApp en el
    // backend (supabase/functions/_shared/whatsapp.ts): al menos 8
    // dígitos con el indicativo de país incluido, para no descubrir el
    // problema recién al intentar enviar un mensaje.
    const telefonoLimpio = telefonoWhatsapp.trim()
    if (telefonoLimpio && telefonoLimpio.replace(/\D/g, '').length < 8) {
      setError('El número de WhatsApp no parece completo (incluye el indicativo de país, ej. +57 300 123 4567).')
      return
    }

    setGuardando(true)
    try {
      await actualizarUsuario(usuario.id, {
        nombre: nombre.trim(),
        telefono_whatsapp: telefonoLimpio || null,
      })
      onGuardado()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar los cambios.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title="Editar usuario" onClose={onClose}>
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
          <label className="block text-slate mb-1">Teléfono (WhatsApp)</label>
          <input
            value={telefonoWhatsapp}
            onChange={(e) => setTelefonoWhatsapp(e.target.value)}
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
