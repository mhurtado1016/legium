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

async function verificarUrl(url: string): Promise<{ ok: boolean; detalle: string }> {
  try {
    const resp = await fetchCorteConstitucional(url)
    return { ok: resp.ok, detalle: `HTTP ${resp.status}` }
  } catch (err) {
    return { ok: false, detalle: String(err) }
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
    const verificacion = await verificarUrl(candidata)
    if (!verificacion.ok) {
      await admin.from('sentencias_cache').update({ texto_completo_no_disponible: true }).eq('id', sentencia_id)
      return new Response(
        JSON.stringify({
          ok: false,
          motivo: 'url_construida_no_responde',
          url_intentada: candidata,
          detalle: verificacion.detalle,
        }),
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
