import { supabase } from './supabase'

export type TipoSesion = 'presencial' | 'virtual'
export type EstadoCita = 'confirmada' | 'cancelada'

export interface ConfiguracionAgenda {
  dias_habiles: number[] // 1=lunes … 7=domingo (ISO)
  hora_inicio: string // "08:00:00"
  hora_fin: string
  duracion_franja_minutos: number
}

export interface Bloqueo {
  id: string
  fecha_inicio: string // "YYYY-MM-DD"
  fecha_fin: string
  hora_inicio: string | null // null = bloquea el día completo
  hora_fin: string | null
  motivo: string | null
  created_at: string
}

export interface Cita {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  tipo_sesion: TipoSesion
  nombre_cliente: string
  correo_cliente: string
  telefono_cliente: string | null
  notas: string | null
  estado: EstadoCita
  created_at: string
}

export interface Franja {
  fecha: string
  hora_inicio: string
  hora_fin: string
}

export const DIAS_SEMANA = [
  { valor: 1, label: 'Lunes' },
  { valor: 2, label: 'Martes' },
  { valor: 3, label: 'Miércoles' },
  { valor: 4, label: 'Jueves' },
  { valor: 5, label: 'Viernes' },
  { valor: 6, label: 'Sábado' },
  { valor: 7, label: 'Domingo' },
]

export async function obtenerConfiguracion(): Promise<ConfiguracionAgenda> {
  const { data, error } = await supabase.from('configuracion_agenda').select('*').eq('id', 1).single()
  if (error) throw error
  return data as ConfiguracionAgenda
}

export async function actualizarConfiguracion(
  cambios: Partial<ConfiguracionAgenda>,
) {
  const { error } = await supabase.from('configuracion_agenda').update(cambios).eq('id', 1)
  if (error) throw error
}

export async function listarBloqueos() {
  const { data, error } = await supabase
    .from('bloqueos_agenda')
    .select('*')
    .order('fecha_inicio', { ascending: false })
  if (error) throw error
  return data as Bloqueo[]
}

export async function crearBloqueo(
  bloqueo: Pick<Bloqueo, 'fecha_inicio' | 'fecha_fin'> &
    Partial<Pick<Bloqueo, 'hora_inicio' | 'hora_fin' | 'motivo'>>,
) {
  const { error } = await supabase.from('bloqueos_agenda').insert(bloqueo)
  if (error) throw error
}

export async function eliminarBloqueo(id: string) {
  const { error } = await supabase.from('bloqueos_agenda').delete().eq('id', id)
  if (error) throw error
}

export async function listarCitas(filtro?: { desde?: string; estado?: EstadoCita }) {
  let query = supabase
    .from('citas_agenda')
    .select('*')
    .order('fecha', { ascending: true })
    .order('hora_inicio', { ascending: true })

  if (filtro?.desde) query = query.gte('fecha', filtro.desde)
  if (filtro?.estado) query = query.eq('estado', filtro.estado)

  const { data, error } = await query
  if (error) throw error
  return data as Cita[]
}

export interface DatosReserva {
  fecha: string
  hora_inicio: string
  hora_fin: string
  tipo_sesion: TipoSesion
  nombre_cliente: string
  correo_cliente: string
  telefono_cliente?: string
  notas?: string
}

// Usada tanto por el landing público (sin sesión) como por el equipo
// interno al agendar manualmente: la política RLS de `citas_agenda`
// permite el insert a ambos roles, y `creado_por` queda en null o con
// el uuid del usuario según haya o no sesión (columna `default auth.uid()`).
export async function reservarCita(datos: DatosReserva) {
  const { data, error } = await supabase.from('citas_agenda').insert(datos).select().single()
  if (error) {
    // Violación del índice único citas_agenda_franja_unica: otra persona
    // reservó esa misma franja entre que se cargó la disponibilidad y el envío.
    if (error.code === '23505') {
      throw new Error('Esa franja horaria ya no está disponible. Por favor elige otra.')
    }
    throw error
  }
  return data as Cita
}

export async function cancelarCita(id: string) {
  const { error } = await supabase.from('citas_agenda').update({ estado: 'cancelada' }).eq('id', id)
  if (error) throw error
}

// Franjas libres entre `desde` y `hasta` (inclusive), agrupadas por
// fecha. Cruza la configuración de horario/duración con los bloqueos y
// las citas ya confirmadas — vía las vistas públicas, así que funciona
// igual para un visitante anónimo del landing que para el equipo interno.
export async function listarDisponibilidad(desde: Date, hasta: Date): Promise<Map<string, Franja[]>> {
  const desdeStr = formatoFecha(desde)
  const hastaStr = formatoFecha(hasta)

  const [
    { data: config, error: errConfig },
    { data: bloqueos, error: errBloqueos },
    { data: ocupadas, error: errOcupadas },
  ] = await Promise.all([
    supabase.from('configuracion_agenda').select('*').eq('id', 1).single(),
    supabase.from('bloqueos_agenda_publico').select('*').lte('fecha_inicio', hastaStr).gte('fecha_fin', desdeStr),
    supabase.from('citas_agenda_ocupacion').select('*').gte('fecha', desdeStr).lte('fecha', hastaStr),
  ])
  if (errConfig) throw errConfig
  if (errBloqueos) throw errBloqueos
  if (errOcupadas) throw errOcupadas

  const horasOcupadasPorFecha = new Map<string, Set<string>>()
  for (const cita of ocupadas ?? []) {
    if (!horasOcupadasPorFecha.has(cita.fecha)) horasOcupadasPorFecha.set(cita.fecha, new Set())
    horasOcupadasPorFecha.get(cita.fecha)!.add(cita.hora_inicio)
  }

  const ahora = new Date()
  const resultado = new Map<string, Franja[]>()

  for (const fecha of rangoDeFechas(desde, hasta)) {
    const isoDow = diaIso(new Date(`${fecha}T00:00:00`))
    if (!config!.dias_habiles.includes(isoDow)) continue

    const franjasDelDia = generarFranjas(
      config!.hora_inicio,
      config!.hora_fin,
      config!.duracion_franja_minutos,
    )
    const disponibles: Franja[] = []

    for (const franja of franjasDelDia) {
      if (new Date(`${fecha}T${franja.hora_inicio}`) <= ahora) continue

      const bloqueada = (bloqueos ?? []).some((b) => {
        if (fecha < b.fecha_inicio || fecha > b.fecha_fin) return false
        if (b.hora_inicio === null) return true // bloqueo de día completo
        return franja.hora_inicio < b.hora_fin! && franja.hora_fin > b.hora_inicio!
      })
      if (bloqueada) continue

      if (horasOcupadasPorFecha.get(fecha)?.has(franja.hora_inicio)) continue

      disponibles.push({ fecha, ...franja })
    }

    if (disponibles.length > 0) resultado.set(fecha, disponibles)
  }

  return resultado
}

function generarFranjas(horaInicio: string, horaFin: string, duracionMinutos: number) {
  const franjas: { hora_inicio: string; hora_fin: string }[] = []
  const [h, m] = horaInicio.split(':').map(Number)
  const [hFin, mFin] = horaFin.split(':').map(Number)
  let actualMin = h * 60 + m
  const finMin = hFin * 60 + mFin

  while (actualMin + duracionMinutos <= finMin) {
    const inicio = actualMin
    actualMin += duracionMinutos
    franjas.push({ hora_inicio: minutosAHora(inicio), hora_fin: minutosAHora(actualMin) })
  }
  return franjas
}

function minutosAHora(totalMinutos: number) {
  const h = Math.floor(totalMinutos / 60)
  const m = totalMinutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function formatoFecha(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function diaIso(d: Date) {
  const dow = d.getDay() // 0=domingo … 6=sábado
  return dow === 0 ? 7 : dow
}

function* rangoDeFechas(desde: Date, hasta: Date) {
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  while (cursor <= fin) {
    yield formatoFecha(cursor)
    cursor.setDate(cursor.getDate() + 1)
  }
}
