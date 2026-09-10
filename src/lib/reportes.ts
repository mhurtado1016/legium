import { supabase } from './supabase'

export type Periodo = 'mes' | 'trimestre' | 'anio' | 'todo'

export interface Cartera {
  pendiente: number
  vencida: number
  cobrado: number
}

export interface ConteoPorEstado {
  estado: string
  total: number
}

export interface HorasUsuario {
  usuario_id: string
  nombre: string | null
  horas_totales: number
  horas_facturadas: number
}

function rangoFechas(periodo: Periodo): { desde: string | null } {
  const ahora = new Date()
  if (periodo === 'todo') return { desde: null }
  if (periodo === 'mes') return { desde: new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString() }
  if (periodo === 'trimestre')
    return { desde: new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1).toISOString() }
  return { desde: new Date(ahora.getFullYear(), 0, 1).toISOString() } // anio
}

// Cartera pendiente/vencida (estado actual, no depende del período) y
// cobrado dentro del período seleccionado.
export async function obtenerCartera(periodo: Periodo): Promise<Cartera> {
  const { data: general, error } = await supabase.from('rpt_cartera').select('*').maybeSingle()
  if (error) throw error

  const { desde } = rangoFechas(periodo)
  let cobradoQuery = supabase
    .from('cuentas_cobro')
    .select('total')
    .eq('estado', 'pagada')
  if (desde) cobradoQuery = cobradoQuery.gte('fecha_emision', desde)
  const { data: pagadas, error: pagadasError } = await cobradoQuery
  if (pagadasError) throw pagadasError

  return {
    pendiente: general?.pendiente ?? 0,
    vencida: general?.vencida ?? 0,
    cobrado: (pagadas ?? []).reduce((sum, c) => sum + Number(c.total), 0),
  }
}

export async function obtenerCasosPorEstado() {
  const { data, error } = await supabase.from('rpt_casos_por_estado').select('estado, total')
  if (error) throw error
  return data as ConteoPorEstado[]
}

export async function obtenerPlazosPorEstado() {
  const { data, error } = await supabase.from('rpt_plazos_por_estado').select('estado, total')
  if (error) throw error
  return data as ConteoPorEstado[]
}

export async function obtenerHorasPorUsuario(periodo: Periodo): Promise<HorasUsuario[]> {
  const { desde } = rangoFechas(periodo)
  let query = supabase.from('registros_tiempo').select('usuario_id, horas, facturado, fecha')
  if (desde) query = query.gte('fecha', desde)
  const { data: registros, error } = await query
  if (error) throw error

  const porUsuario = new Map<string, { horas_totales: number; horas_facturadas: number }>()
  for (const r of registros ?? []) {
    const actual = porUsuario.get(r.usuario_id) ?? { horas_totales: 0, horas_facturadas: 0 }
    actual.horas_totales += Number(r.horas)
    if (r.facturado) actual.horas_facturadas += Number(r.horas)
    porUsuario.set(r.usuario_id, actual)
  }

  const usuarioIds = [...porUsuario.keys()]
  if (usuarioIds.length === 0) return []

  const { data: usuarios } = await supabase.from('usuarios').select('id, nombre').in('id', usuarioIds)
  const nombrePorId = new Map((usuarios ?? []).map((u) => [u.id, u.nombre]))

  return usuarioIds.map((id) => ({
    usuario_id: id,
    nombre: nombrePorId.get(id) ?? null,
    ...porUsuario.get(id)!,
  }))
}
