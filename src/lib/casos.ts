import { supabase } from './supabase'

export type TipoCaso = 'litigio' | 'consultoria'
export type EstadoCaso = 'abierto' | 'en_curso' | 'suspendido' | 'cerrado'

export interface Cliente {
  id: string
  tipo: 'persona_natural' | 'empresa'
  nombre: string
  identificacion: string | null
  email: string | null
  telefono: string | null
}

export interface Caso {
  id: string
  cliente_id: string
  tipo: TipoCaso
  titulo: string
  descripcion: string | null
  estado: EstadoCaso
  numero_radicado: string | null
  despacho_judicial: string | null
  etapa_procesal: string | null
  fecha_apertura: string
  fecha_cierre: string | null
  responsable_id: string
  clientes?: { nombre: string }
}

export interface CasoActividad {
  id: string
  descripcion: string
  created_at: string
  usuarios?: { nombre: string | null }
}

export interface CasoSentencia {
  id: string
  nota: string | null
  sentencias_cache: { sentencia: string; sala: string | null }
}

export async function listarCasos(filtro?: { estado?: EstadoCaso; tipo?: TipoCaso }) {
  let query = supabase
    .from('casos')
    .select('*, clientes(nombre)')
    .order('created_at', { ascending: false })

  if (filtro?.estado) query = query.eq('estado', filtro.estado)
  if (filtro?.tipo) query = query.eq('tipo', filtro.tipo)

  const { data, error } = await query
  if (error) throw error
  return data as Caso[]
}

export async function obtenerCaso(id: string) {
  const { data, error } = await supabase
    .from('casos')
    .select('*, clientes(nombre)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Caso
}

export async function listarClientes() {
  const { data, error } = await supabase.from('clientes').select('*').order('nombre')
  if (error) throw error
  return data as Cliente[]
}

export async function crearCliente(cliente: Omit<Cliente, 'id'> & { firma_id: string }) {
  const { data, error } = await supabase.from('clientes').insert(cliente).select().single()
  if (error) throw error
  return data as Cliente
}

export async function crearCaso(
  caso: Pick<Caso, 'cliente_id' | 'tipo' | 'titulo' | 'descripcion'> & {
    firma_id: string
    responsable_id: string
  },
) {
  const { data, error } = await supabase.from('casos').insert(caso).select().single()
  if (error) throw error
  return data as Caso
}

export async function actualizarEstadoCaso(id: string, estado: EstadoCaso) {
  const { error } = await supabase.from('casos').update({ estado }).eq('id', id)
  if (error) throw error
}

export async function listarActividad(casoId: string) {
  const { data, error } = await supabase
    .from('caso_actividad')
    .select('*, usuarios(nombre)')
    .eq('caso_id', casoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as CasoActividad[]
}

export async function agregarActividad(
  casoId: string,
  descripcion: string,
  firmaId: string,
  usuarioId: string,
) {
  const { error } = await supabase.from('caso_actividad').insert({
    caso_id: casoId,
    firma_id: firmaId,
    usuario_id: usuarioId,
    descripcion,
  })
  if (error) throw error
}

export async function listarSentenciasVinculadas(casoId: string) {
  const { data, error } = await supabase
    .from('caso_sentencias')
    .select('id, nota, sentencias_cache(sentencia, sala)')
    .eq('caso_id', casoId)
  if (error) throw error
  return data as unknown as CasoSentencia[]
}

export async function vincularSentencia(
  casoId: string,
  sentenciaId: string,
  nota: string,
  firmaId: string,
  usuarioId: string,
) {
  const { error } = await supabase.from('caso_sentencias').insert({
    caso_id: casoId,
    sentencia_id: sentenciaId,
    nota,
    firma_id: firmaId,
    agregado_por: usuarioId,
  })
  if (error) throw error
}
