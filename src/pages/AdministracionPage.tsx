import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Copy, HardDrive, Loader2, Plus, UserCog } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { CardActions, CardEmpty, CardHeader, CardList, CardRow, DataCard } from '../components/DataCard'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { TelefonoInput } from '../components/TelefonoInput'
import { useUsuario } from '../lib/useUsuario'
import { actualizarUsuario, invitarUsuario, listarUsuarios, type UsuarioAdmin } from '../lib/administracion'
import { separarTelefono } from '../lib/paisesTelefono'
import { estadoCuentaServicioDrive } from '../lib/drive'

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
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
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

        <IntegracionDriveSeccion />

        {cargando ? (
          <p className="text-sm text-slate flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
            Cargando…
          </p>
        ) : (
          <>
          <div className="hidden md:block card overflow-hidden">
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
                        <div className="flex items-center justify-end gap-3 text-xs whitespace-nowrap">
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

          <CardList>
            {usuarios.map((u) => {
              const esUnoMismo = u.id === usuario?.id
              return (
                <DataCard key={u.id}>
                  <CardHeader>
                    <span className="font-medium text-ink">{u.nombre ?? '—'}</span>
                    <StatusBadge estado={u.activo ? 'activo' : 'inactivo'} />
                  </CardHeader>
                  <CardRow label="Correo">{u.email ?? '—'}</CardRow>
                  <CardRow label="WhatsApp">{u.telefono_whatsapp ?? '—'}</CardRow>
                  <CardRow label="Rol">
                    <StatusBadge estado={u.es_administrador ? 'administrador' : 'miembro'} />
                  </CardRow>
                  <CardActions>
                    <button onClick={() => setEditando(u)} className="link">
                      Editar
                    </button>
                    <button
                      onClick={() => handleCambio(u.id, { es_administrador: !u.es_administrador })}
                      disabled={esUnoMismo}
                      className="link disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
                    >
                      {u.es_administrador ? 'Quitar admin' : 'Hacer admin'}
                    </button>
                    <button
                      onClick={() => handleCambio(u.id, { activo: !u.activo })}
                      disabled={esUnoMismo}
                      className="link disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:no-underline"
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </CardActions>
                </DataCard>
              )
            })}
            {usuarios.length === 0 && <CardEmpty>No hay usuarios registrados.</CardEmpty>}
          </CardList>
          </>
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

// Cuenta de servicio de Google, una sola para todo el despacho
// (GOOGLE_SERVICE_ACCOUNT_KEY en Vercel — ver api/drive/*.ts). No hay
// nada que "conectar" desde acá: solo hace falta compartir cada carpeta
// de Drive con el correo de esa cuenta de servicio para que sea visible
// en el detalle del caso (búsqueda por número de radicado).
function IntegracionDriveSeccion() {
  const [estado, setEstado] = useState<{ configurado: boolean; cuentaEmail: string | null } | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    estadoCuentaServicioDrive()
      .then(setEstado)
      .catch((err) => setError(err instanceof Error ? err.message : 'No se pudo consultar el estado de Google Drive.'))
      .finally(() => setCargando(false))
  }, [])

  async function handleCopiar() {
    if (!estado?.cuentaEmail) return
    try {
      await navigator.clipboard.writeText(estado.cuentaEmail)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // portapapeles no disponible (ej. sin permiso o contexto no seguro): sin acción, el correo ya se ve en pantalla
    }
  }

  return (
    <section className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <HardDrive size={16} strokeWidth={1.75} className="text-slate" />
        <h2 className="font-display text-sm font-semibold">Google Drive</h2>
      </div>
      <p className="text-sm text-slate mb-3">
        El detalle de cada caso muestra los archivos de la carpeta de Drive cuyo nombre incluye el número de
        radicado. Para que una carpeta sea visible, hay que compartirla (permiso de lectura alcanza) con esta
        cuenta:
      </p>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}

      {cargando ? (
        <p className="text-sm text-slate flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
          Cargando…
        </p>
      ) : !estado?.configurado ? (
        <p className="text-sm text-slate">No hay una cuenta de servicio de Google Drive configurada todavía.</p>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 size={14} strokeWidth={1.75} className="text-success shrink-0" />
          <code className="text-sm bg-paper-sunken px-2 py-1 rounded-[var(--radius-field)]">{estado.cuentaEmail}</code>
          <button type="button" onClick={handleCopiar} className="link flex items-center gap-1 text-xs">
            <Copy size={12} strokeWidth={1.75} />
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
    </section>
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

    // El indicativo ya lo garantiza el selector de país de TelefonoInput;
    // solo falta validar que el número local en sí tenga pinta de completo.
    const telefonoLimpio = telefonoWhatsapp.trim()
    if (telefonoLimpio && separarTelefono(telefonoLimpio).numero.length < 6) {
      setError('El número de WhatsApp no parece completo.')
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
          <TelefonoInput value={telefonoWhatsapp} onChange={setTelefonoWhatsapp} />
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
