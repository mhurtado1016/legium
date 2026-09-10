import { supabase } from './supabase'

export interface Sentencia {
  id: string
  sentencia: string
  sentencia_tipo: string | null
  sala: string | null
  magistrado_a: string | null
  fecha_sentencia: string | null
  resumen_ia: string | null
  resumen_ia_verificado: boolean
  texto_completo_no_disponible: boolean
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

// Verificación humana de un resumen generado por IA (sección 4.3.3).
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
