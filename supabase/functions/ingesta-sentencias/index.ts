// Edge Function: ingesta-sentencias
// Ver especificación técnica, sección 4.2, punto 1.
//
// Job programado (configurar como cron en Supabase, ej. diario) que
// sincroniza el dataset de datos.gov.co hacia sentencias_cache de forma
// incremental, usando $offset para paginar (límite de 1000 por consulta,
// sección 4.5).

import { createClient } from 'npm:@supabase/supabase-js@2'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DATOS_GOV_URL = 'https://www.datos.gov.co/resource/v2k4-2t8s.json'
const PAGE_SIZE = 1000
const MAX_PAGES_POR_EJECUCION = 5 // evita ejecuciones demasiado largas; se retoma en la siguiente corrida

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let totalProcesados = 0

  try {
    for (let page = 0; page < MAX_PAGES_POR_EJECUCION; page++) {
      const offset = page * PAGE_SIZE
      const params = new URLSearchParams({
        $limit: String(PAGE_SIZE),
        $offset: String(offset),
        $order: 'fecha_sentencia DESC',
      })

      const resp = await fetch(`${DATOS_GOV_URL}?${params.toString()}`)
      if (!resp.ok) throw new Error(`datos.gov.co respondió ${resp.status}`)

      const registros = await resp.json()
      if (registros.length === 0) break // ya no hay más páginas

      const filas = registros
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

      const { error } = await admin
        .from('sentencias_cache')
        .upsert(filas, { onConflict: 'sentencia' })
      if (error) throw error

      totalProcesados += filas.length
      if (registros.length < PAGE_SIZE) break // última página
    }

    return new Response(JSON.stringify({ ok: true, totalProcesados }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err), totalProcesados }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
