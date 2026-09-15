import { useEffect, useState, type FormEvent } from 'react'
import { Bell, BellOff, ChevronDown, Loader2, Trash2 } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { SelectorFranja } from '../components/SelectorFranja'
import { useUsuario, type Usuario } from '../lib/useUsuario'
import { suscribirsePush } from '../lib/plazos'
import {
  DIAS_SEMANA,
  actualizarConfiguracion,
  actualizarHorarios,
  cancelarCita,
  crearBloqueo,
  eliminarBloqueo,
  listarBloqueos,
  listarCitas,
  obtenerConfiguracion,
  obtenerHorarios,
  reservarCita,
  type Bloqueo,
  type Cita,
  type ConfiguracionAgenda,
  type Franja,
  type HorarioDia,
  type TipoSesion,
} from '../lib/agenda'

/**
 * Agenda interna: citas próximas para todo el equipo, reserva manual
 * (ej. cliente que llama en vez de agendar desde el landing) y, solo
 * para administradores, la configuración de horarios/duración de
 * franja y el bloqueo de días, semanas o meses.
 */
export function AgendaPage() {
  const { usuario } = useUsuario()
  // Incrementa para forzar la recarga de CitasSeccion desde afuera —
  // necesario porque una reserva manual se crea en un componente
  // hermano, no en CitasSeccion mismo.
  const [refrescoCitas, setRefrescoCitas] = useState(0)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <AppHeader />
      <main className="px-6 py-6 max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-lg">Agenda</h1>
          {usuario?.es_administrador && <NotificacionesPushBoton usuario={usuario} />}
        </div>
        <CitasSeccion refrescar={refrescoCitas} />
        <ReservarManualSeccion onReservada={() => setRefrescoCitas((n) => n + 1)} />
        {usuario?.es_administrador && <ConfiguracionSeccion />}
      </main>
    </div>
  )
}

// Solo hay a quién avisar (notificar-cita-agendada) si al menos un
// administrador se suscribió desde su navegador — este botón es ese
// paso, ausente hasta ahora en toda la app (suscribirsePush() existía
// en src/lib/plazos.ts pero nada la invocaba).
function NotificacionesPushBoton({ usuario }: { usuario: Usuario }) {
  const [estado, setEstado] = useState<'inactivo' | 'activando' | 'activo' | 'error' | 'no_soportado'>('inactivo')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('no_soportado')
      return
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) setEstado('activo')
      })
      .catch(() => {})
  }, [])

  async function activar() {
    setEstado('activando')
    try {
      await suscribirsePush(usuario.firma_id, usuario.id)
      setEstado('activo')
    } catch (err) {
      console.error('No se pudo activar las notificaciones push:', err)
      setEstado('error')
    }
  }

  if (estado === 'no_soportado') return null

  if (estado === 'activo') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-slate">
        <Bell size={14} strokeWidth={1.75} className="text-success" />
        Notificaciones activas
      </span>
    )
  }

  return (
    <button type="button" onClick={activar} disabled={estado === 'activando'} className="btn-secondary btn-sm">
      {estado === 'activando' ? (
        <>
          <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
          Activando…
        </>
      ) : (
        <>
          <BellOff size={14} strokeWidth={1.75} />
          {estado === 'error' ? 'Reintentar activar notificaciones' : 'Activar notificaciones'}
        </>
      )}
    </button>
  )
}

function EncabezadoColapsable({
  titulo,
  abierto,
  onToggle,
}: {
  titulo: string
  abierto: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-1.5 w-full text-left">
      <h2 className="font-display text-base">{titulo}</h2>
      <ChevronDown
        size={18}
        strokeWidth={1.75}
        className={'text-slate transition-transform ' + (abierto ? 'rotate-180' : '')}
      />
    </button>
  )
}

const ESTADO_LABEL: Record<Cita['estado'], string> = {
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
}

function CitasSeccion({ refrescar }: { refrescar: number }) {
  const [citas, setCitas] = useState<Cita[]>([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    setCargando(true)
    try {
      const hoy = new Date()
      const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      setCitas(await listarCitas({ desde }))
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refrescar])

  async function handleCancelar(id: string) {
    await cancelarCita(id)
    cargar()
  }

  return (
    <section>
      <h2 className="font-display text-base mb-3">Próximas citas</h2>
      {cargando ? (
        <p className="text-sm text-slate flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
          Cargando…
        </p>
      ) : (
        <table className="table-modern">
          <thead>
            <tr>
              <th className="pr-3">Fecha</th>
              <th className="pr-3">Hora</th>
              <th className="pr-3">Cliente</th>
              <th className="pr-3">Tipo</th>
              <th className="pr-3">Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {citas.map((c) => (
              <tr key={c.id} className={c.estado === 'cancelada' ? 'text-slate' : ''}>
                <td className="pr-3">{formatoFechaCorta(c.fecha)}</td>
                <td className="pr-3">{formatoHora12(c.hora_inicio)}</td>
                <td className="pr-3">
                  <div>{c.nombre_cliente}</div>
                  <div className="text-xs text-slate">{c.correo_cliente}</div>
                </td>
                <td className="pr-3 capitalize">{c.tipo_sesion}</td>
                <td className="pr-3">{ESTADO_LABEL[c.estado]}</td>
                <td>
                  {c.estado === 'confirmada' && (
                    <button onClick={() => handleCancelar(c.id)} className="link">
                      cancelar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {citas.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-slate">
                  No hay citas próximas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}

function ReservarManualSeccion({ onReservada }: { onReservada: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [franja, setFranja] = useState<Franja | null>(null)
  const [tipoSesion, setTipoSesion] = useState<TipoSesion>('presencial')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!franja) return
    setError(null)
    setGuardando(true)
    try {
      await reservarCita({
        fecha: franja.fecha,
        hora_inicio: franja.hora_inicio,
        hora_fin: franja.hora_fin,
        tipo_sesion: tipoSesion,
        nombre_cliente: nombre,
        correo_cliente: correo,
        telefono_cliente: telefono || undefined,
        notas: notas || undefined,
      })
      setFranja(null)
      setNombre('')
      setCorreo('')
      setTelefono('')
      setNotas('')
      setAbierto(false)
      onReservada()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agendar la cita.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="card p-4">
      <EncabezadoColapsable titulo="Reservar cita manualmente" abierto={abierto} onToggle={() => setAbierto((v) => !v)} />
      {abierto && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-6">
          <SelectorFranja franjaSeleccionada={franja} onSeleccionar={setFranja} />

          {franja && (
            <div className="space-y-4">
              <div>
                <span className="block text-sm text-slate mb-2">Tipo de sesión</span>
                <div className="flex gap-3">
                  {(['presencial', 'virtual'] as TipoSesion[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setTipoSesion(tipo)}
                      className={'btn-sm ' + (tipoSesion === tipo ? 'btn-primary' : 'btn-secondary')}
                    >
                      {tipo === 'presencial' ? 'Presencial' : 'Virtual'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="block text-sm text-slate mb-1">Nombre del cliente</span>
                  <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full field" />
                </label>
                <label className="block">
                  <span className="block text-sm text-slate mb-1">Correo</span>
                  <input
                    type="email"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    required
                    className="w-full field"
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-sm text-slate mb-1">Teléfono (opcional)</span>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full field" />
              </label>
              <label className="block">
                <span className="block text-sm text-slate mb-1">Notas (opcional)</span>
                <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full field" />
              </label>

              {error && <p className="text-sm text-seal">{error}</p>}

              <button type="submit" disabled={guardando} className="btn-primary btn-sm">
                {guardando ? 'Guardando…' : 'Agendar cita'}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  )
}

function ConfiguracionSeccion() {
  const [abierto, setAbierto] = useState(false)
  const [config, setConfig] = useState<ConfiguracionAgenda | null>(null)
  const [horarios, setHorarios] = useState<HorarioDia[] | null>(null)
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([])
  const [cargandoBloqueos, setCargandoBloqueos] = useState(true)

  async function cargar() {
    const [c, h, b] = await Promise.all([obtenerConfiguracion(), obtenerHorarios(), listarBloqueos()])
    setConfig(c)
    setHorarios(h)
    setBloqueos(b)
    setCargandoBloqueos(false)
  }

  useEffect(() => {
    if (abierto && !config) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto])

  async function handleGuardarConfig(duracion: number, nuevosHorarios: HorarioDia[]) {
    setGuardandoConfig(true)
    try {
      await Promise.all([
        actualizarConfiguracion({ duracion_franja_minutos: duracion }),
        actualizarHorarios(nuevosHorarios),
      ])
      setConfig({ duracion_franja_minutos: duracion })
      setHorarios(nuevosHorarios)
    } finally {
      setGuardandoConfig(false)
    }
  }

  async function handleEliminarBloqueo(id: string) {
    await eliminarBloqueo(id)
    setBloqueos((b) => b.filter((x) => x.id !== id))
  }

  return (
    <section className="card p-4">
      <EncabezadoColapsable titulo="Configuración de disponibilidad" abierto={abierto} onToggle={() => setAbierto((v) => !v)} />
      {abierto && (!config || !horarios) && (
        <p className="text-sm text-slate flex items-center gap-2 mt-4">
          <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
          Cargando…
        </p>
      )}
      {abierto && config && horarios && (
        <div className="mt-4 space-y-8">
          <ConfiguracionForm
            config={config}
            horarios={horarios}
            guardando={guardandoConfig}
            onGuardar={handleGuardarConfig}
          />

          <div>
            <h3 className="font-display text-sm mb-3">Bloqueos</h3>
            <NuevoBloqueoForm onCreado={(b) => setBloqueos((prev) => [b, ...prev])} />

            {cargandoBloqueos ? null : (
              <table className="table-modern mt-4">
                <thead>
                  <tr>
                    <th className="pr-3">Desde</th>
                    <th className="pr-3">Hasta</th>
                    <th className="pr-3">Horario</th>
                    <th className="pr-3">Motivo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bloqueos.map((b) => (
                    <tr key={b.id}>
                      <td className="pr-3">{formatoFechaCorta(b.fecha_inicio)}</td>
                      <td className="pr-3">{formatoFechaCorta(b.fecha_fin)}</td>
                      <td className="pr-3">
                        {b.hora_inicio ? `${formatoHora12(b.hora_inicio)} – ${formatoHora12(b.hora_fin!)}` : 'Día completo'}
                      </td>
                      <td className="pr-3">{b.motivo || '—'}</td>
                      <td>
                        <button
                          onClick={() => handleEliminarBloqueo(b.id)}
                          aria-label="Eliminar bloqueo"
                          className="text-slate hover:text-seal transition-colors"
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {bloqueos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-slate">
                        No hay bloqueos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

const DURACIONES_MINUTOS = [15, 30, 45, 60, 90, 120]

interface FilaHorario {
  dia: number
  activo: boolean
  horaInicio: string
  horaFin: string
}

function ConfiguracionForm({
  config,
  horarios,
  guardando,
  onGuardar,
}: {
  config: ConfiguracionAgenda
  horarios: HorarioDia[]
  guardando: boolean
  onGuardar: (duracion: number, horarios: HorarioDia[]) => void
}) {
  const [filas, setFilas] = useState<FilaHorario[]>(() =>
    DIAS_SEMANA.map((d) => {
      const h = horarios.find((x) => x.dia === d.valor)
      return {
        dia: d.valor,
        activo: h?.activo ?? false,
        horaInicio: (h?.hora_inicio ?? '08:00:00').slice(0, 5),
        horaFin: (h?.hora_fin ?? '18:00:00').slice(0, 5),
      }
    }),
  )
  const [duracion, setDuracion] = useState(config.duracion_franja_minutos)
  const [error, setError] = useState('')

  function actualizarFila(dia: number, cambios: Partial<FilaHorario>) {
    setFilas((prev) => prev.map((f) => (f.dia === dia ? { ...f, ...cambios } : f)))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const activasInvalidas = filas.filter((f) => f.activo && f.horaFin <= f.horaInicio)
    if (activasInvalidas.length > 0) {
      setError('La hora fin debe ser posterior a la hora inicio en cada día activo.')
      return
    }
    setError('')
    onGuardar(
      duracion,
      filas.map((f) => ({
        dia: f.dia,
        activo: f.activo,
        hora_inicio: f.activo ? `${f.horaInicio}:00` : null,
        hora_fin: f.activo ? `${f.horaFin}:00` : null,
      })),
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <span className="block text-sm text-slate mb-2">Horario por día</span>
        {filas.map((f) => {
          const label = DIAS_SEMANA.find((d) => d.valor === f.dia)!.label
          return (
            <div key={f.dia} className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => actualizarFila(f.dia, { activo: !f.activo })}
                className={'btn-sm w-28 ' + (f.activo ? 'btn-primary' : 'btn-secondary')}
              >
                {label}
              </button>
              <input
                type="time"
                value={f.horaInicio}
                disabled={!f.activo}
                onChange={(e) => actualizarFila(f.dia, { horaInicio: e.target.value })}
                className="field field-sm"
              />
              <span className="text-slate text-sm">a</span>
              <input
                type="time"
                value={f.horaFin}
                disabled={!f.activo}
                onChange={(e) => actualizarFila(f.dia, { horaFin: e.target.value })}
                className="field field-sm"
              />
            </div>
          )
        })}
      </div>

      {error && <p className="text-sm text-seal">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-sm text-slate mb-1">Duración de la franja</span>
          <select
            value={duracion}
            onChange={(e) => setDuracion(Number(e.target.value))}
            className="field field-sm"
          >
            {DURACIONES_MINUTOS.map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={guardando} className="btn-primary btn-sm">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function NuevoBloqueoForm({ onCreado }: { onCreado: (b: Bloqueo) => void }) {
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [diaCompleto, setDiaCompleto] = useState(true)
  const [horaInicio, setHoraInicio] = useState('')
  const [horaFin, setHoraFin] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      await crearBloqueo({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || fechaInicio,
        hora_inicio: diaCompleto ? undefined : `${horaInicio}:00`,
        hora_fin: diaCompleto ? undefined : `${horaFin}:00`,
        motivo: motivo || undefined,
      })
      onCreado({
        id: crypto.randomUUID(),
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || fechaInicio,
        hora_inicio: diaCompleto ? null : `${horaInicio}:00`,
        hora_fin: diaCompleto ? null : `${horaFin}:00`,
        motivo: motivo || null,
        created_at: new Date().toISOString(),
      })
      setFechaInicio('')
      setFechaFin('')
      setHoraInicio('')
      setHoraFin('')
      setMotivo('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el bloqueo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="block">
        <span className="block text-slate mb-1">Desde</span>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          required
          className="field field-sm"
        />
      </label>
      <label className="block">
        <span className="block text-slate mb-1">Hasta (opcional)</span>
        <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="field field-sm" />
      </label>
      <label className="flex items-center gap-1.5 pb-2">
        <input type="checkbox" checked={diaCompleto} onChange={(e) => setDiaCompleto(e.target.checked)} />
        Día completo
      </label>
      {!diaCompleto && (
        <>
          <label className="block">
            <span className="block text-slate mb-1">Hora inicio</span>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              required={!diaCompleto}
              className="field field-sm"
            />
          </label>
          <label className="block">
            <span className="block text-slate mb-1">Hora fin</span>
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              required={!diaCompleto}
              className="field field-sm"
            />
          </label>
        </>
      )}
      <label className="block flex-1 min-w-[10rem]">
        <span className="block text-slate mb-1">Motivo (opcional)</span>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="field field-sm w-full" />
      </label>
      <button type="submit" disabled={guardando} className="btn-secondary btn-sm">
        {guardando ? 'Guardando…' : 'Agregar bloqueo'}
      </button>
      {error && <p className="text-sm text-seal w-full">{error}</p>}
    </form>
  )
}

function formatoHora12(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  const periodo = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${periodo}`
}

function formatoFechaCorta(fecha: string) {
  return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}
