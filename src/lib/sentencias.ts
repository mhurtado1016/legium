import { supabase } from './supabase'

export interface Sentencia {
  id: string
  sentencia: string
  sentencia_tipo: string | null
  sala: string | null
  magistrado_a: string | null
  fecha_sentencia: string | null
  proceso: string | null
  expediente_tipo: string | null
  expediente_numero: string | null
  sv_spv: string | null
  av_apv: string | null
  texto_completo_url: string | null
  texto_completo_no_disponible: boolean
  resumen_ia: string | null
  hechos_ia: string | null
  problema_juridico_ia: string | null
  consideraciones_ia: string | null
  decision_ia: string | null
  resumen_ia_verificado: boolean
}

export interface CriteriosBusqueda {
  sentencia?: string
  sentencia_tipo?: string
  magistrado_a?: string
  sala?: string
  texto?: string
}

// Invoca la Edge Function buscar-sentencias (sección 4.2/4.4): cache
// primero, con fallback a la API en vivo si no hay suficientes resultados.
export async function buscarSentencias(criterios: CriteriosBusqueda) {
  const { data, error } = await supabase.functions.invoke('buscar-sentencias', {
    body: criterios,
  })
  if (error) throw error
  return data as { resultados: Sentencia[]; fuente: 'cache' | 'api_en_vivo' }
}

export async function obtenerSentencia(id: string) {
  const { data, error } = await supabase.from('sentencias_cache').select('*').eq('id', id).single()
  if (error) throw error
  return data as Sentencia
}

// Invoca localizar-texto-sentencia (sección 4.3.1).
export async function localizarTexto(sentenciaId: string) {
  const { data, error } = await supabase.functions.invoke('localizar-texto-sentencia', {
    body: { sentencia_id: sentenciaId },
  })
  if (error) throw error
  return data as { ok: boolean; url?: string; motivo?: string }
}

// Invoca generar-resumen-ia (sección 4.3.2). Localiza el texto primero
// si todavía no está resuelto.
export async function generarAnalisisIA(sentenciaId: string) {
  const { data, error } = await supabase.functions.invoke('generar-resumen-ia', {
    body: { sentencia_id: sentenciaId },
  })
  if (error) throw error
  return data as { ok: boolean; motivo?: string; analisis?: Record<string, string> }
}
export async function verificarResumen(sentenciaId: string, firmaId: string, usuarioId: string) {
  const { error: updateError } = await supabase
    .from('sentencias_cache')
    .update({ resumen_ia_verificado: true })
    .eq('id', sentenciaId)
  if (updateError) throw updateError

  const { error: insertError } = await supabase.from('verificaciones_resumen').insert({
    firma_id: firmaId,
    usuario_id: usuarioId,
    sentencia_id: sentenciaId,
  })
  if (insertError) throw insertError
}

// Verificaciones pendientes del despacho: sentencias con resumen IA
// generado pero aún no verificado (sección 13.3, columna "Su actividad").
export async function contarVerificacionesPendientes() {
  const { count, error } = await supabase
    .from('sentencias_cache')
    .select('id', { count: 'exact', head: true })
    .not('resumen_ia', 'is', null)
    .eq('resumen_ia_verificado', false)
  if (error) throw error
  return count ?? 0
}
