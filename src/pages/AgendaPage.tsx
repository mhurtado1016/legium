import { useEffect, useState, type FormEvent } from 'react'
import { Bell, BellOff, Loader2, Trash2 } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { EncabezadoColapsable } from '../components/EncabezadoColapsable'
import { SelectorFranja } from '../components/SelectorFranja'
import { StatusBadge } from '../components/StatusBadge'
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
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto space-y-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Agenda</h1>
            <p className="text-sm text-slate mt-1">Citas del equipo y disponibilidad para agendar.</p>
          </div>
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
      <h2 className="font-display text-base font-semibold mb-3">Próximas citas</h2>
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
                <th>Fecha</th>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {citas.map((c) => (
                <tr key={c.id} className={c.estado === 'cancelada' ? 'text-slate' : ''}>
                  <td>{formatoFechaCorta(c.fecha)}</td>
                  <td>{formatoHora12(c.hora_inicio)}</td>
                  <td>
                    <div className="font-medium text-ink">{c.nombre_cliente}</div>
                    <div className="text-xs text-slate">{c.correo_cliente}</div>
                  </td>
                  <td className="capitalize">{c.tipo_sesion}</td>
                  <td>
                    <StatusBadge estado={c.estado} />
                  </td>
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
                  <td colSpan={6} className="py-6 text-slate text-center">
                    No hay citas próximas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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

              {error && <p className="text-sm text-danger">{error}</p>}

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
            <h3 className="font-display text-sm font-semibold mb-3">Bloqueos</h3>
            <NuevoBloqueoForm onCreado={(b) => setBloqueos((prev) => [b, ...prev])} />

            {cargandoBloqueos ? null : (
              <div className="card overflow-hidden overflow-x-auto mt-4">
                <table className="table-modern">
                  <thead>
                    <tr>
                      <th>Desde</th>
                      <th>Hasta</th>
                      <th>Horario</th>
                      <th>Motivo</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {bloqueos.map((b) => (
                      <tr key={b.id}>
                        <td>{formatoFechaCorta(b.fecha_inicio)}</td>
                        <td>{formatoFechaCorta(b.fecha_fin)}</td>
                        <td>
                          {b.hora_inicio ? `${formatoHora12(b.hora_inicio)} – ${formatoHora12(b.hora_fin!)}` : 'Día completo'}
                        </td>
                        <td>{b.motivo || '—'}</td>
                        <td>
                          <button
                            onClick={() => handleEliminarBloqueo(b.id)}
                            aria-label="Eliminar bloqueo"
                            className="text-slate hover:text-danger transition-colors"
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {bloqueos.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-slate text-center">
                          No hay bloqueos registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

const DURACIONES_MINUTOS = [15, 30, 45, 60, 90, 120]

// Un "grupo" es el equivalente visual de "lunes, martes y miércoles
// atiendo de 8 a 6, jueves y viernes de 9 a 1": un mismo horario
// compartido por varios días. Cada día solo puede estar en un grupo a
// la vez; el que no aparece en ninguno queda sin atención ese día.
interface GrupoHorario {
  dias: number[]
  horaInicio: string
  horaFin: string
}

function agruparHorarios(horarios: HorarioDia[]): GrupoHorario[] {
  const grupos: GrupoHorario[] = []
  for (const h of horarios) {
    if (!h.activo || !h.hora_inicio || !h.hora_fin) continue
    const horaInicio = h.hora_inicio.slice(0, 5)
    const horaFin = h.hora_fin.slice(0, 5)
    const existente = grupos.find((g) => g.horaInicio === horaInicio && g.horaFin === horaFin)
    if (existente) existente.dias.push(h.dia)
    else grupos.push({ dias: [h.dia], horaInicio, horaFin })
  }
  return grupos
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
  const [grupos, setGrupos] = useState<GrupoHorario[]>(() => {
    const iniciales = agruparHorarios(horarios)
    return iniciales.length > 0 ? iniciales : [{ dias: [], horaInicio: '08:00', horaFin: '18:00' }]
  })
  const [duracion, setDuracion] = useState(config.duracion_franja_minutos)
  const [error, setError] = useState('')

  const diasAsignados = new Set(grupos.flatMap((g) => g.dias))
  const diasSinHorario = DIAS_SEMANA.filter((d) => !diasAsignados.has(d.valor))

  function toggleDiaEnGrupo(indice: number, dia: number) {
    setGrupos((prev) =>
      prev.map((g, i) => {
        if (i === indice) {
          return g.dias.includes(dia)
            ? { ...g, dias: g.dias.filter((d) => d !== dia) }
            : { ...g, dias: [...g.dias, dia].sort((a, b) => a - b) }
        }
        // Un día solo pertenece a un horario: al asignarlo a este grupo
        // se le quita a cualquier otro que lo tuviera.
        return g.dias.includes(dia) ? { ...g, dias: g.dias.filter((d) => d !== dia) } : g
      }),
    )
  }

  function agregarGrupo() {
    setGrupos((prev) => [...prev, { dias: [], horaInicio: '08:00', horaFin: '18:00' }])
  }

  function eliminarGrupo(indice: number) {
    setGrupos((prev) => prev.filter((_, i) => i !== indice))
  }

  function actualizarGrupo(indice: number, cambios: Partial<GrupoHorario>) {
    setGrupos((prev) => prev.map((g, i) => (i === indice ? { ...g, ...cambios } : g)))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const conDias = grupos.filter((g) => g.dias.length > 0)
    if (conDias.some((g) => g.horaFin <= g.horaInicio)) {
      setError('La hora fin debe ser posterior a la hora inicio en cada horario.')
      return
    }
    setError('')

    const resultado: HorarioDia[] = DIAS_SEMANA.map((d) => ({
      dia: d.valor,
      activo: false,
      hora_inicio: null,
      hora_fin: null,
    }))
    for (const g of conDias) {
      for (const dia of g.dias) {
        const fila = resultado.find((r) => r.dia === dia)!
        fila.activo = true
        fila.hora_inicio = `${g.horaInicio}:00`
        fila.hora_fin = `${g.horaFin}:00`
      }
    }
    onGuardar(duracion, resultado)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <span className="block text-sm text-slate mb-2">Horario de atención</span>
        {grupos.map((g, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3 border border-line rounded-[var(--radius-field)] p-3">
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  onClick={() => toggleDiaEnGrupo(i, d.valor)}
                  className={'btn-sm ' + (g.dias.includes(d.valor) ? 'btn-primary' : 'btn-secondary')}
                >
                  {d.label.slice(0, 3)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="time"
                value={g.horaInicio}
                onChange={(e) => actualizarGrupo(i, { horaInicio: e.target.value })}
                className="field field-sm w-auto"
              />
              <span className="text-slate text-sm">a</span>
              <input
                type="time"
                value={g.horaFin}
                onChange={(e) => actualizarGrupo(i, { horaFin: e.target.value })}
                className="field field-sm w-auto"
              />
            </div>
            {grupos.length > 1 && (
              <button
                type="button"
                onClick={() => eliminarGrupo(i)}
                aria-label="Eliminar horario"
                className="text-slate hover:text-danger transition-colors ml-auto"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={agregarGrupo} className="btn-secondary btn-sm">
          + Agregar horario
        </button>
        {diasSinHorario.length > 0 && (
          <p className="text-xs text-slate">Sin atención: {diasSinHorario.map((d) => d.label).join(', ')}</p>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

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
      {error && <p className="text-sm text-danger w-full">{error}</p>}
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
