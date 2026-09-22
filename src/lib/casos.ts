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
  created_at: string
  clientes?: { nombre: string }
  usuarios?: { nombre: string | null }
}

export interface UsuarioFirma {
  id: string
  nombre: string | null
}

export interface CasoTraslado {
  id: string
  caso_id: string
  responsable_anterior_id: string
  responsable_nuevo_id: string
  trasladado_por: string
  motivo: string | null
  created_at: string
  responsable_anterior?: string | null
  responsable_nuevo?: string | null
  trasladado_por_nombre?: string | null
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
  sentencias_cache: { sentencia: string; sala: string | null } | null
}

export type ColumnaOrdenCaso = 'titulo' | 'cliente' | 'tipo' | 'numero_radicado' | 'estado' | 'created_at'

export async function listarCasos(filtro?: {
  estado?: EstadoCaso
  tipo?: TipoCaso
  numeroRadicado?: string
  clienteNombre?: string
  titulo?: string
  orderBy?: ColumnaOrdenCaso
  orderAsc?: boolean
}) {
  const necesitaInnerJoinCliente = !!filtro?.clienteNombre
  let query = supabase
    .from('casos')
    .select(
      necesitaInnerJoinCliente
        ? '*, clientes!inner(nombre), usuarios(nombre)'
        : '*, clientes(nombre), usuarios(nombre)',
    )

  if (filtro?.estado) query = query.eq('estado', filtro.estado)
  if (filtro?.tipo) query = query.eq('tipo', filtro.tipo)
  if (filtro?.numeroRadicado) query = query.ilike('numero_radicado', `%${filtro.numeroRadicado}%`)
  if (filtro?.clienteNombre) query = query.ilike('clientes.nombre', `%${filtro.clienteNombre}%`)
  if (filtro?.titulo) query = query.ilike('titulo', `%${filtro.titulo}%`)

  const orderAsc = filtro?.orderAsc ?? false
  if (filtro?.orderBy === 'cliente') {
    query = query.order('nombre', { ascending: orderAsc, referencedTable: 'clientes' })
  } else {
    query = query.order(filtro?.orderBy ?? 'created_at', { ascending: orderAsc })
  }

  const { data, error } = await query
  if (error) throw error
  return data as Caso[]
}

export async function obtenerCaso(id: string) {
  const { data, error } = await supabase
    .from('casos')
    .select('*, clientes(nombre), usuarios(nombre)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Caso
}

export async function listarUsuariosFirma() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data as UsuarioFirma[]
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
  caso: Pick<Caso, 'cliente_id' | 'tipo' | 'titulo' | 'descripcion' | 'numero_radicado'> & {
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

export async function actualizarNumeroRadicado(id: string, numeroRadicado: string | null) {
  const { error } = await supabase
    .from('casos')
    .update({ numero_radicado: numeroRadicado })
    .eq('id', id)
  if (error) throw error
}

// Reasigna el responsable de un caso vía la función `fn_trasladar_caso`
// (en vez de un update directo) para que el traslado quede registrado
// en `caso_traslados`.
export async function trasladarCaso(casoId: string, nuevoResponsableId: string, motivo: string) {
  const { error } = await supabase.rpc('fn_trasladar_caso', {
    p_caso_id: casoId,
    p_nuevo_responsable_id: nuevoResponsableId,
    p_motivo: motivo.trim() || null,
  })
  if (error) throw error
}

export async function listarTraslados(casoId: string) {
  const { data: traslados, error } = await supabase
    .from('caso_traslados')
    .select('*')
    .eq('caso_id', casoId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!traslados || traslados.length === 0) return []

  const usuarioIds = [
    ...new Set(traslados.flatMap((t) => [t.responsable_anterior_id, t.responsable_nuevo_id, t.trasladado_por])),
  ]
  const { data: usuariosData, error: usuariosError } = await supabase
    .from('usuarios')
    .select('id, nombre')
    .in('id', usuarioIds)
  if (usuariosError) throw usuariosError
  const nombrePorId = new Map((usuariosData ?? []).map((u) => [u.id, u.nombre]))

  return traslados.map((t) => ({
    ...t,
    responsable_anterior: nombrePorId.get(t.responsable_anterior_id) ?? null,
    responsable_nuevo: nombrePorId.get(t.responsable_nuevo_id) ?? null,
    trasladado_por_nombre: nombrePorId.get(t.trasladado_por) ?? null,
  })) as CasoTraslado[]
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
