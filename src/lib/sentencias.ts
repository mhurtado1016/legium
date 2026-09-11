import { supabase } from './supabase'

// El SDK de Supabase, cuando una Edge Function responde con un código de
// error, normalmente da un mensaje genérico ("Edge Function returned a
// non-2xx status code") que no dice nada útil. El cuerpo real de la
// respuesta (nuestro propio { error: "..." }) queda en `error.context`
// (un objeto Response). Esta función intenta leerlo para mostrar el
// error real en pantalla.
async function mensajeErrorFuncion(error: unknown): Promise<string> {
  const conContexto = error as { message?: string; context?: Response }
  if (conContexto?.context && typeof conContexto.context.json === 'function') {
    try {
      const cuerpo = await conContexto.context.clone().json()
      if (cuerpo?.error) return String(cuerpo.error)
      if (cuerpo?.motivo) return String(cuerpo.motivo)
    } catch {
      // el cuerpo no era JSON; se usa el mensaje genérico como respaldo
    }
  }
  return conContexto?.message ?? String(error)
}

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
  expediente_tipo?: string
  magistrado_a?: string
  sala?: string
  texto?: string
  fecha_desde?: string
  fecha_hasta?: string
}

// Invoca la Edge Function buscar-sentencias (sección 4.2/4.4): cache
// primero, con fallback a la API en vivo si no hay suficientes resultados.
export async function buscarSentencias(criterios: CriteriosBusqueda) {
  const { data, error } = await supabase.functions.invoke('buscar-sentencias', {
    body: criterios,
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { resultados: Sentencia[]; fuente: 'cache' | 'api_en_vivo' }
}

// Busca por el número/citación de la sentencia (ej. "T-760/98"), no por
// el id interno — reutiliza buscar-sentencias, que ya resuelve contra el
// cache y, si no está ahí, contra la API en vivo, guardando el
// resultado y devolviéndolo YA CON su id real. Esto evita depender de
// que un id capturado en un momento anterior siga siendo válido.
export async function obtenerSentenciaPorNumero(numero: string) {
  const { resultados } = await buscarSentencias({ sentencia: numero })
  const encontrada = resultados.find((r) => r.sentencia === numero) ?? resultados[0]
  if (!encontrada) throw new Error(`No se encontró la sentencia ${numero}.`)
  return encontrada
}

// Invoca localizar-texto-sentencia (sección 4.3.1).
export async function localizarTexto(sentenciaId: string) {
  const { data, error } = await supabase.functions.invoke('localizar-texto-sentencia', {
    body: { sentencia_id: sentenciaId },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { ok: boolean; url?: string; motivo?: string; url_intentada?: string; detalle?: string }
}

// Invoca generar-resumen-ia (sección 4.3.2). Localiza el texto primero
// si todavía no está resuelto.
export async function generarAnalisisIA(sentenciaId: string) {
  const { data, error } = await supabase.functions.invoke('generar-resumen-ia', {
    body: { sentencia_id: sentenciaId },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { ok: boolean; motivo?: string; analisis?: Record<string, string> }
}
// Obtiene el texto completo con su formato original (negrita, cursiva,
// listas, tablas) — el proxy en Vercel lo sanitiza (sin scripts ni
// atributos peligrosos) pero conserva las etiquetas de formato, para
// que se vea igual al sitio oficial. Se muestra dentro de la página,
// no en un visor con scroll aparte.
export async function obtenerTextoCompleto(url: string) {
  const { data, error } = await supabase.functions.invoke('obtener-texto-sentencia', {
    body: { url },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { html: string }
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
