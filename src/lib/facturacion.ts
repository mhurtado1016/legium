import { supabase } from './supabase'

export type EstadoCuentaCobro = 'pendiente' | 'pagada' | 'vencida' | 'anulada'

export interface RegistroTiempo {
  id: string
  fecha: string
  horas: number
  descripcion: string | null
  facturado: boolean
}

export interface HonorarioFijo {
  id: string
  monto_acordado: number
  descripcion: string | null
}

export interface CuentaCobro {
  id: string
  numero: string
  fecha_emision: string
  total: number
  estado: EstadoCuentaCobro
  storage_path: string | null
  casos?: { titulo: string }
  clientes?: { nombre: string }
}

export async function listarRegistrosTiempo(casoId: string) {
  const { data, error } = await supabase
    .from('registros_tiempo')
    .select('*')
    .eq('caso_id', casoId)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data as RegistroTiempo[]
}

export async function registrarTiempo(
  casoId: string,
  firmaId: string,
  usuarioId: string,
  horas: number,
  descripcion: string,
) {
  const { error } = await supabase
    .from('registros_tiempo')
    .insert({ caso_id: casoId, firma_id: firmaId, usuario_id: usuarioId, horas, descripcion })
  if (error) throw error
}

export async function obtenerHonorarioFijo(casoId: string) {
  const { data, error } = await supabase
    .from('honorarios_fijos')
    .select('*')
    .eq('caso_id', casoId)
    .maybeSingle()
  if (error) throw error
  return data as HonorarioFijo | null
}

export async function definirHonorarioFijo(
  casoId: string,
  firmaId: string,
  montoAcordado: number,
  descripcion: string,
) {
  const { error } = await supabase
    .from('honorarios_fijos')
    .upsert(
      { caso_id: casoId, firma_id: firmaId, monto_acordado: montoAcordado, descripcion },
      { onConflict: 'caso_id' },
    )
  if (error) throw error
}

export async function generarCuentaCobro(casoId: string) {
  const { data, error } = await supabase.functions.invoke('generar-cuenta-cobro', {
    body: { caso_id: casoId },
  })
  if (error) throw error
  return data as { ok: boolean; cuenta_cobro_id: string; numero: string; total: number }
}

export async function listarCuentasCobro(filtro?: { estado?: EstadoCuentaCobro }) {
  let query = supabase
    .from('cuentas_cobro')
    .select('*, casos(titulo), clientes(nombre)')
    .order('fecha_emision', { ascending: false })
  if (filtro?.estado) query = query.eq('estado', filtro.estado)

  const { data, error } = await query
  if (error) throw error
  return data as CuentaCobro[]
}

export async function actualizarEstadoCuentaCobro(id: string, estado: EstadoCuentaCobro) {
  const { error } = await supabase.from('cuentas_cobro').update({ estado }).eq('id', id)
  if (error) throw error
}

export async function urlDescargaFactura(storagePath: string) {
  const { data, error } = await supabase.storage
    .from('facturas')
    .createSignedUrl(storagePath, 60 * 5)
  if (error) throw error
  return data.signedUrl
}
