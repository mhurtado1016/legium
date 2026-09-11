// Edge Function: buscar-sentencias
// Ver especificación técnica, sección 4.2 y 4.4.
//
// Busca primero en el cache local (sentencias_cache). Si no hay resultados
// suficientes, hace fallback a la API en vivo de datos.gov.co, guarda lo
// encontrado en el cache y responde con esos resultados. Registra la
// búsqueda en historial_busqueda.

import { createClient } from 'npm:@supabase/supabase-js@2'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DATOS_GOV_URL = 'https://www.datos.gov.co/resource/v2k4-2t8s.json'
const MIN_RESULTADOS_CACHE = 1 // debajo de esto, se intenta la API en vivo

interface Criterios {
  sentencia?: string
  sentencia_tipo?: string
  expediente_tipo?: string
  magistrado_a?: string
  sala?: string
  texto?: string
  fecha_desde?: string // YYYY-MM-DD
  fecha_hasta?: string // YYYY-MM-DD
  limit?: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const criterios: Criterios = await req.json()
    const limit = Math.min(criterios.limit ?? 25, 100)

    // 1. Buscar en cache local
    let query = supabase.from('sentencias_cache').select('*').limit(limit)
    if (criterios.sentencia) query = query.eq('sentencia', criterios.sentencia)
    if (criterios.sentencia_tipo) query = query.eq('sentencia_tipo', criterios.sentencia_tipo)
    if (criterios.expediente_tipo) query = query.eq('expediente_tipo', criterios.expediente_tipo)
    if (criterios.magistrado_a) query = query.ilike('magistrado_a', `%${criterios.magistrado_a}%`)
    if (criterios.sala) query = query.ilike('sala', `%${criterios.sala}%`)
    if (criterios.fecha_desde) query = query.gte('fecha_sentencia', criterios.fecha_desde)
    if (criterios.fecha_hasta) query = query.lte('fecha_sentencia', criterios.fecha_hasta)
    if (criterios.texto) {
      const patron = `%${criterios.texto}%`
      // Coincidencia parcial: número/citación y proceso (igual que
      // antes), más el contenido del análisis generado por IA cuando
      // existe (resumen, hechos, problema jurídico, consideraciones,
      // decisión) — es lo único con contenido temático real, ya que el
      // dataset público de datos.gov.co no trae tema ni descriptor.
      query = query.or(
        [
          `sentencia.ilike.${patron}`,
          `proceso.ilike.${patron}`,
          `resumen_ia.ilike.${patron}`,
          `hechos_ia.ilike.${patron}`,
          `problema_juridico_ia.ilike.${patron}`,
          `consideraciones_ia.ilike.${patron}`,
          `decision_ia.ilike.${patron}`,
        ].join(','),
      )
    }

    const { data: cacheResults, error: cacheError } = await query
    if (cacheError) throw cacheError

    let resultados = cacheResults ?? []
    let fuente: 'cache' | 'api_en_vivo' = 'cache'

    // 2. Fallback a la API en vivo si el cache no tiene suficientes resultados
    if (resultados.length < MIN_RESULTADOS_CACHE) {
      const params = new URLSearchParams({ $limit: String(limit) })
      if (criterios.sentencia) params.set('sentencia', criterios.sentencia)
      if (criterios.sentencia_tipo) params.set('sentencia_tipo', criterios.sentencia_tipo)
      if (criterios.expediente_tipo) params.set('expediente_tipo', criterios.expediente_tipo)

      const condicionesWhere: string[] = []
      // magistrado_a y sala usan coincidencia parcial (like), igual que en
      // el cache — un parámetro de igualdad exacta en Socrata obligaría a
      // escribir el nombre completo tal como aparece en el dataset.
      if (criterios.magistrado_a) {
        const escapado = criterios.magistrado_a.replace(/'/g, "''")
        condicionesWhere.push(`upper(magistrado_a) like upper('%${escapado}%')`)
      }
      if (criterios.sala) {
        const escapado = criterios.sala.replace(/'/g, "''")
        condicionesWhere.push(`upper(sala) like upper('%${escapado}%')`)
      }
      if (criterios.texto) {
        // Se restringe la búsqueda de texto en la API en vivo a los mismos
        // campos que en el cache (sentencia, proceso), en vez de usar el
        // $q genérico de Socrata, que busca en TODOS los campos y puede
        // devolver resultados sin relación real con lo buscado.
        const escapado = criterios.texto.replace(/'/g, "''")
        condicionesWhere.push(
          `(upper(sentencia) like upper('%${escapado}%') OR upper(proceso) like upper('%${escapado}%'))`,
        )
      }
      if (criterios.fecha_desde) condicionesWhere.push(`fecha_sentencia >= '${criterios.fecha_desde}'`)
      if (criterios.fecha_hasta) condicionesWhere.push(`fecha_sentencia <= '${criterios.fecha_hasta}'`)
      if (condicionesWhere.length > 0) params.set('$where', condicionesWhere.join(' AND '))

      const resp = await fetch(`${DATOS_GOV_URL}?${params.toString()}`)
      if (resp.ok) {
        const apiResultados = await resp.json()
        fuente = 'api_en_vivo'

        const filas = apiResultados
          .filter((r: Record<string, string>) => r.sentencia)
          .map((r: Record<string, string>) => ({
            proceso: r.proceso,
            expediente_tipo: r.expediente_tipo,
            expediente_numero: r.expediente_numero,
            magistrado_a: r.magistrado_a,
            sala: r.sala,
            sentencia_tipo: r.sentencia_tipo,
            sentencia: r.sentencia,
            fecha_sentencia: r.fecha_sentencia,
            sv_spv: r.sv_spv,
            av_apv: r.av_apv,
            ultima_sincronizacion: new Date().toISOString(),
          }))

        if (filas.length > 0) {
          const admin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          )
          // Se guarda en el cache y se devuelven las filas YA GUARDADAS
          // (con su `id` generado por la base de datos) — los datos
          // crudos de la API no traen `id`, y el frontend lo necesita
          // para enlazar a la ficha de detalle de cada sentencia.
          const { data: guardadas, error: upsertError } = await admin
            .from('sentencias_cache')
            .upsert(filas, { onConflict: 'sentencia' })
            .select()
          if (upsertError) throw upsertError
          resultados = guardadas ?? []
        }
      }
    }

    // 3. Registrar la búsqueda en el historial del tenant
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('firma_id')
        .eq('id', userData.user.id)
        .single()

      if (usuario) {
        await supabase.from('historial_busqueda').insert({
          firma_id: usuario.firma_id,
          usuario_id: userData.user.id,
          criterios,
          resultados_count: resultados.length,
          fuente,
        })
      }
    }

    return new Response(JSON.stringify({ resultados, fuente }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
