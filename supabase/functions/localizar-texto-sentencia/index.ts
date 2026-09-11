// Edge Function: localizar-texto-sentencia
// Ver especificación técnica, sección 4.3.1.
//
// Dado un registro de sentencias_cache, intenta construir y verificar la
// URL de la providencia en el sitio oficial de la Corte Constitucional,
// a partir del patrón observado:
//
//   https://www.corteconstitucional.gov.co/relatoria/{año}/{tipo}-{numero}-{añoYY}.htm
//
// Excepción: las sentencias de unificación (SU) no llevan guion entre el
// tipo y el número, ej. SU037-09.htm (no su-037-09.htm).
//
// Si la URL construida no responde 200, se marca
// texto_completo_no_disponible = true en vez de generar nada por
// inferencia (prohibición de suplencia, sección 4.3.3).
//
// NOTA: este patrón se dedujo de observar URLs reales publicadas por la
// Corte; no hay documentación oficial de la estructura del sitio, así
// que conviene revisar este código si en algún momento deja de
// encontrar sentencias que sí existen.

import { createClient } from 'npm:@supabase/supabase-js@2'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  sentencia_id: string
}

function construirUrlCandidata(
  sentenciaTipo: string,
  sentencia: string,
  fechaSentencia: string,
): string | null {
  // `sentencia` viene como "T-760/08" o "SU-037/09" (formato de datos.gov.co)
  const match = sentencia.match(/^([A-Z]+)-?(\d+)\/(\d{2})$/i)
  if (!match) return null
  const [, , numero, anioYY] = match

  const anioCompleto = new Date(fechaSentencia).getFullYear()
  if (!anioCompleto) return null

  const tipo = sentenciaTipo.toUpperCase()
  const slug =
    tipo === 'SU'
      ? `SU${numero}-${anioYY}` // sin guion entre tipo y número
      : `${tipo.toLowerCase()}-${numero}-${anioYY}`

  return `https://www.corteconstitucional.gov.co/relatoria/${anioCompleto}/${slug}.htm`
}

// El sitio de la Corte a veces no envía la cadena completa de
// certificados TLS (le falta el intermedio), lo que hace que el cliente
// HTTP de Deno rechace la conexión con "UnknownIssuer" aunque un
// navegador normal sí la acepte. Como respaldo para la verificación, si
// la petición directa falla por red/certificado, se reintenta a través
// de un servicio de lectura público. Se sigue guardando la URL oficial
// (`candidata`), nunca la del proxy, una vez confirmada su existencia.
async function existeLaUrl(url: string): Promise<boolean> {
  try {
    const resp = await fetch(url)
    if (resp.ok) return true
  } catch {
    // sigue al respaldo
  }
  try {
    const resp = await fetch(`https://r.jina.ai/${url}`)
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

  try {
    const { sentencia_id }: Body = await req.json()

    const { data: s, error: fetchError } = await admin
      .from('sentencias_cache')
      .select('*')
      .eq('id', sentencia_id)
      .single()
    if (fetchError || !s) throw new Error('Sentencia no encontrada')

    if (s.texto_completo_url) {
      return new Response(JSON.stringify({ ok: true, url: s.texto_completo_url, ya_resuelta: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const candidata = s.sentencia_tipo && s.fecha_sentencia
      ? construirUrlCandidata(s.sentencia_tipo, s.sentencia, s.fecha_sentencia)
      : null

    if (!candidata) {
      await admin.from('sentencias_cache').update({ texto_completo_no_disponible: true }).eq('id', sentencia_id)
      return new Response(JSON.stringify({ ok: false, motivo: 'no_se_pudo_construir_la_url' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Verificación real: la URL construida debe existir de verdad.
    if (!(await existeLaUrl(candidata))) {
      await admin.from('sentencias_cache').update({ texto_completo_no_disponible: true }).eq('id', sentencia_id)
      return new Response(
        JSON.stringify({ ok: false, motivo: 'url_construida_no_responde', url_intentada: candidata }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    await admin
      .from('sentencias_cache')
      .update({ texto_completo_url: candidata, texto_completo_no_disponible: false })
      .eq('id', sentencia_id)

    return new Response(JSON.stringify({ ok: true, url: candidata }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
