import { supabase } from './supabase'
import { TAMANO_MAXIMO_BYTES } from './documentos'

// Mismo motivo que en sentencias.ts/administracion.ts/whatsapp.ts: el
// SDK da un mensaje genérico para respuestas de error de una Edge
// Function; esto recupera el { error: "..." } real del cuerpo.
async function mensajeErrorFuncion(error: unknown): Promise<string> {
  const conContexto = error as { message?: string; context?: Response }
  if (conContexto?.context && typeof conContexto.context.json === 'function') {
    try {
      const cuerpo = await conContexto.context.clone().json()
      if (cuerpo?.error) return String(cuerpo.error)
    } catch {
      // el cuerpo no era JSON; se usa el mensaje genérico como respaldo
    }
  }
  return conContexto?.message ?? String(error)
}

// Solo PDF/imagen/texto: son los tipos que Gemini puede leer de forma
// nativa como archivo de soporte (ver documentos-ia-chat/index.ts).
export const TIPOS_PERMITIDOS_SOPORTE_IA = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain']
export const MAX_ARCHIVOS_SOPORTE = 5

export interface TipoDocumentoLegal {
  id: string
  firma_id: string | null
  nombre: string
  descripcion: string | null
  especificacion_md: string
  es_predefinida: boolean
  activo: boolean
}

export interface ConversacionIA {
  id: string
  firma_id: string
  caso_id: string | null
  tipo_documento_id: string
  titulo: string
  contenido_generado: string | null
  datos_faltantes: string[] | null
  estado: 'en_curso' | 'con_borrador'
  created_at: string
  updated_at: string
  tipos_documento_legal?: { nombre: string }
  casos?: { titulo: string }
}

export interface MensajeIA {
  id: string
  conversacion_id: string
  rol: 'usuario' | 'asistente'
  contenido: string
  created_at: string
}

export interface ArchivoSoporteIA {
  id: string
  conversacion_id: string
  storage_path: string
  nombre_archivo: string
  mime_type: string | null
  tamano_bytes: number | null
  created_at: string
}

export interface ArchivoGeneradoIA {
  id: string
  conversacion_id: string
  formato: 'docx' | 'pdf'
  storage_path: string
  nombre_archivo: string
  mime_type: string | null
  created_at: string
}

export async function listarTiposDocumento() {
  const { data, error } = await supabase.from('tipos_documento_legal').select('*').order('nombre')
  if (error) throw error
  return data as TipoDocumentoLegal[]
}

export async function crearTipoDocumento(params: {
  firmaId: string
  usuarioId: string
  nombre: string
  descripcion: string
  especificacionMd: string
}) {
  const { data, error } = await supabase
    .from('tipos_documento_legal')
    .insert({
      firma_id: params.firmaId,
      nombre: params.nombre,
      descripcion: params.descripcion || null,
      especificacion_md: params.especificacionMd,
      creado_por: params.usuarioId,
    })
    .select()
    .single()
  if (error) throw error
  return data as TipoDocumentoLegal
}

export async function actualizarTipoDocumento(
  id: string,
  cambios: { nombre?: string; descripcion?: string; especificacionMd?: string; activo?: boolean },
) {
  const { error } = await supabase
    .from('tipos_documento_legal')
    .update({
      ...(cambios.nombre !== undefined ? { nombre: cambios.nombre } : {}),
      ...(cambios.descripcion !== undefined ? { descripcion: cambios.descripcion || null } : {}),
      ...(cambios.especificacionMd !== undefined ? { especificacion_md: cambios.especificacionMd } : {}),
      ...(cambios.activo !== undefined ? { activo: cambios.activo } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export async function listarConversaciones(casoId?: string) {
  let query = supabase
    .from('documentos_ia_conversaciones')
    .select('*, tipos_documento_legal(nombre), casos(titulo)')
    .order('updated_at', { ascending: false })
  if (casoId) query = query.eq('caso_id', casoId)
  const { data, error } = await query
  if (error) throw error
  return data as ConversacionIA[]
}

export async function crearConversacion(params: {
  firmaId: string
  usuarioId: string
  tipoDocumentoId: string
  titulo: string
  casoId?: string
}) {
  const { data, error } = await supabase
    .from('documentos_ia_conversaciones')
    .insert({
      firma_id: params.firmaId,
      caso_id: params.casoId ?? null,
      tipo_documento_id: params.tipoDocumentoId,
      titulo: params.titulo,
      creado_por: params.usuarioId,
    })
    .select()
    .single()
  if (error) throw error
  return data as ConversacionIA
}

export async function obtenerConversacion(id: string) {
  const { data: conversacion, error } = await supabase
    .from('documentos_ia_conversaciones')
    .select('*, tipos_documento_legal(nombre), casos(titulo)')
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: mensajes, error: mensajesError } = await supabase
    .from('documentos_ia_mensajes')
    .select('*')
    .eq('conversacion_id', id)
    .order('created_at', { ascending: true })
  if (mensajesError) throw mensajesError

  const { data: archivosSoporte, error: archivosError } = await supabase
    .from('documentos_ia_archivos_soporte')
    .select('id, conversacion_id, storage_path, nombre_archivo, mime_type, tamano_bytes, created_at')
    .eq('conversacion_id', id)
    .order('created_at', { ascending: true })
  if (archivosError) throw archivosError

  const { data: archivosGenerados, error: generadosError } = await supabase
    .from('documentos_ia_archivos_generados')
    .select('id, conversacion_id, formato, storage_path, nombre_archivo, mime_type, created_at')
    .eq('conversacion_id', id)
    .order('created_at', { ascending: false })
  if (generadosError) throw generadosError

  return {
    conversacion: conversacion as ConversacionIA,
    mensajes: mensajes as MensajeIA[],
    archivosSoporte: archivosSoporte as ArchivoSoporteIA[],
    archivosGenerados: archivosGenerados as ArchivoGeneradoIA[],
  }
}

export async function actualizarContenidoGenerado(conversacionId: string, contenido: string) {
  const { error } = await supabase
    .from('documentos_ia_conversaciones')
    .update({ contenido_generado: contenido, updated_at: new Date().toISOString() })
    .eq('id', conversacionId)
  if (error) throw error
}

// Sube un archivo de soporte (PDF/imagen/texto) al bucket `documentos-ia`.
// La Edge Function documentos-ia-chat lo sube a la Gemini File API en el
// siguiente turno en el que se referencie su id.
export async function subirArchivoSoporte(params: {
  file: File
  firmaId: string
  conversacionId: string
  usuarioId: string
}) {
  const { file, firmaId, conversacionId, usuarioId } = params

  if (file.size > TAMANO_MAXIMO_BYTES) throw new Error('El archivo supera el límite de 20 MB.')
  if (!TIPOS_PERMITIDOS_SOPORTE_IA.includes(file.type)) {
    throw new Error('Solo se aceptan PDF, imágenes (JPG/PNG) o texto plano como archivo de soporte.')
  }

  const { count } = await supabase
    .from('documentos_ia_archivos_soporte')
    .select('id', { count: 'exact', head: true })
    .eq('conversacion_id', conversacionId)
  if ((count ?? 0) >= MAX_ARCHIVOS_SOPORTE) {
    throw new Error(`No se pueden adjuntar más de ${MAX_ARCHIVOS_SOPORTE} archivos por conversación.`)
  }

  const archivoId = crypto.randomUUID()
  const storagePath = `${firmaId}/${conversacionId}/soporte/${archivoId}-${file.name}`

  const { error: uploadError } = await supabase.storage.from('documentos-ia').upload(storagePath, file, {
    contentType: file.type,
  })
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('documentos_ia_archivos_soporte')
    .insert({
      id: archivoId,
      firma_id: firmaId,
      conversacion_id: conversacionId,
      storage_path: storagePath,
      nombre_archivo: file.name,
      mime_type: file.type,
      tamano_bytes: file.size,
      subido_por: usuarioId,
    })
    .select()
    .single()
  if (error) throw error
  return data as ArchivoSoporteIA
}

export async function eliminarArchivoSoporte(archivo: ArchivoSoporteIA) {
  const { error: storageError } = await supabase.storage.from('documentos-ia').remove([archivo.storage_path])
  if (storageError) throw storageError

  const { error } = await supabase.from('documentos_ia_archivos_soporte').delete().eq('id', archivo.id)
  if (error) throw error
}

export async function urlDescargaIA(storagePath: string) {
  const { data, error } = await supabase.storage.from('documentos-ia').createSignedUrl(storagePath, 60 * 5)
  if (error) throw error
  return data.signedUrl
}

export async function enviarMensaje(conversacionId: string, mensaje: string, archivoIdsNuevos: string[] = []) {
  const { data, error } = await supabase.functions.invoke('documentos-ia-chat', {
    body: { conversacion_id: conversacionId, mensaje, archivo_ids_nuevos: archivoIdsNuevos },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { ok: boolean; mensaje_asistente: MensajeIA; contenido_generado: string | null; datos_faltantes: string[] }
}

export async function exportarConversacion(conversacionId: string, formato: 'docx' | 'pdf') {
  const { data, error } = await supabase.functions.invoke('exportar-documento-legal', {
    body: { conversacion_id: conversacionId, formato },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { ok: boolean; archivo: ArchivoGeneradoIA }
}
