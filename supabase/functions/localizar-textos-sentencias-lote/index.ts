// Edge Function: localizar-textos-sentencias-lote
// Ver especificación técnica, sección 4.3.1, punto 4 (job asíncrono,
// con reintentos limitados). Pensada para correr como cron periódico.
//
// Recorre sentencias_cache que aún no tienen texto_completo_url ni están
// marcadas como texto_completo_no_disponible, y llama a la misma lógica
// de localizar-texto-sentencia para cada una, en lotes pequeños para no
// saturar el sitio de la Corte ni exceder el tiempo de ejecución de la
// función.

import { createClient } from 'npm:@supabase/supabase-js@2'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TAMANO_LOTE = 25

function construirUrlCandidata(
  sentenciaTipo: string,
  sentencia: string,
  fechaSentencia: string,
): string | null {
  const match = sentencia.match(/^([A-Z]+)-?(\d+)\/(\d{2})$/i)
  if (!match) return null
  const [, , numero, anioYY] = match

  const anioCompleto = new Date(fechaSentencia).getFullYear()
  if (!anioCompleto) return null

  const tipo = sentenciaTipo.toUpperCase()
  const slug =
    tipo === 'SU' ? `SU${numero}-${anioYY}` : `${tipo.toLowerCase()}-${numero}-${anioYY}`

  return `https://www.corteconstitucional.gov.co/relatoria/${anioCompleto}/${slug}.htm`
}

// El sitio de la Corte Constitucional no envía la cadena TLS completa,
// y Deno.createHttpClient({ caCerts }) no funciona de forma confiable en
// el runtime de Supabase Edge Functions (ver
// https://github.com/orgs/supabase/discussions/36035). Por eso la
// conexión real se hace desde un endpoint propio en Vercel
// (api/proxy-corte.ts, Node.js), que sí maneja certificados
// personalizados de forma confiable. Sigue siendo infraestructura
// propia, sin depender de ningún servicio de terceros.
const PROXY_CORTE_URL = 'https://legium.vercel.app/api/proxy-corte'

async function fetchCorteConstitucional(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const resp = await fetch(`${PROXY_CORTE_URL}?url=${encodeURIComponent(url)}`)
  if (!resp.ok) throw new Error(`Proxy respondió ${resp.status}`)
  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return { ok: data.status >= 200 && data.status < 300, status: data.status, text: data.body }
}

async function existeLaUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetchCorteConstitucional(url)
    return resp.ok
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: pendientes, error } = await admin
    .from('sentencias_cache')
    .select('id, sentencia, sentencia_tipo, fecha_sentencia')
    .is('texto_completo_url', null)
    .eq('texto_completo_no_disponible', false)
    .limit(TAMANO_LOTE)

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })

  let resueltas = 0
  let noDisponibles = 0

  for (const s of pendientes ?? []) {
    const candidata =
      s.sentencia_tipo && s.fecha_sentencia
        ? construirUrlCandidata(s.sentencia_tipo, s.sentencia, s.fecha_sentencia)
        : null

    if (!candidata) {
      await admin.from('sentencias_cache').update({ texto_completo_no_disponible: true }).eq('id', s.id)
      noDisponibles++
      continue
    }

    if (await existeLaUrl(candidata)) {
      await admin
        .from('sentencias_cache')
        .update({ texto_completo_url: candidata, texto_completo_no_disponible: false })
        .eq('id', s.id)
      resueltas++
    } else {
      await admin.from('sentencias_cache').update({ texto_completo_no_disponible: true }).eq('id', s.id)
      noDisponibles++
    }
  }

  return new Response(
    JSON.stringify({ ok: true, revisadas: pendientes?.length ?? 0, resueltas, noDisponibles }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
  )
})
