// Edge Function: generar-resumen-ia
// Ver especificación técnica, sección 4.3 (4.3.1, 4.3.2, 4.3.3).
//
// Recibe un sentencia_id de sentencias_cache. Si ya tiene texto_completo_url,
// extrae el texto y genera el resumen estructurado con Gemini. Si no fue
// posible obtener el texto completo, marca texto_completo_no_disponible y
// NO genera resumen por inferencia (prohibición de suplencia, sección 4.3.3).
//
// NOTA: la localización automática de la providencia en el sitio oficial de
// la Corte Constitucional (cruce por número de sentencia) queda pendiente
// de implementar contra la estructura real de ese sitio; esta función
// asume que texto_completo_url ya fue resuelto por otro proceso o que se
// recibe explícitamente en el body.

import { createClient } from 'npm:@supabase/supabase-js@2'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

interface Body {
  sentencia_id: string
  texto_completo_url?: string
}

interface AnalisisIA {
  resumen: string
  hechos: string
  problema_juridico: string
  consideraciones_relevantes: string
  decision: string
}

// Ver localizar-texto-sentencia/index.ts para el detalle del patrón.
// Duplicado aquí (en vez de invocar esa función por HTTP) para evitar un
// salto de red adicional en el flujo de generación de resumen.
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

// El sitio de la Corte a veces no envía la cadena completa de
// certificados TLS (le falta el intermedio), lo que hace que el cliente
// HTTP de Deno rechace la conexión con "UnknownIssuer" aunque un
// navegador normal sí la acepte (los navegadores completan la cadena
// automáticamente; Deno no). Como respaldo, si la descarga directa
// falla por error de red/certificado, se reintenta a través de un
// servicio de lectura público que sabe manejar esta clase de sitios.
// No es tan robusto como que el sitio arregle su certificado, pero no
// depende de nada de nuestro lado para funcionar.
async function descargarConRespaldo(url: string): Promise<Response> {
  try {
    const resp = await fetch(url)
    if (resp.ok) return resp
    throw new Error(`respuesta ${resp.status}`)
  } catch {
    return await fetch(`https://r.jina.ai/${url}`)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { sentencia_id, texto_completo_url }: Body = await req.json()

    const { data: sentencia, error: fetchError } = await admin
      .from('sentencias_cache')
      .select('*')
      .eq('id', sentencia_id)
      .single()
    if (fetchError || !sentencia) throw new Error('Sentencia no encontrada')

    const url =
      texto_completo_url ??
      sentencia.texto_completo_url ??
      (sentencia.sentencia_tipo && sentencia.fecha_sentencia
        ? construirUrlCandidata(sentencia.sentencia_tipo, sentencia.sentencia, sentencia.fecha_sentencia)
        : null)

    // Sección 4.3.1: si no hay texto completo, no se genera nada por inferencia.
    if (!url) {
      await admin
        .from('sentencias_cache')
        .update({ texto_completo_no_disponible: true })
        .eq('id', sentencia_id)
      return new Response(
        JSON.stringify({ ok: false, motivo: 'texto_completo_no_disponible' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    // Extracción de texto (simplificada: asume HTML/texto plano; PDFs
    // requieren una librería de extracción adicional, pendiente).
    let docResp: Response
    try {
      docResp = await descargarConRespaldo(url)
    } catch {
      await admin
        .from('sentencias_cache')
        .update({ texto_completo_no_disponible: true })
        .eq('id', sentencia_id)
      return new Response(
        JSON.stringify({ ok: false, motivo: 'no_se_pudo_descargar_el_texto' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }
    if (!docResp.ok) {
      await admin
        .from('sentencias_cache')
        .update({ texto_completo_no_disponible: true })
        .eq('id', sentencia_id)
      return new Response(
        JSON.stringify({ ok: false, motivo: 'no_se_pudo_descargar_el_texto' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }
    const textoCompleto = (await docResp.text()).replace(/<[^>]+>/g, ' ').slice(0, 100_000)

    // Sección 4.3.2: generación estructurada con Gemini, únicamente a
    // partir del texto completo (nunca del registro estructurado de la API).
    const prompt = `Eres un asistente jurídico. A partir ÚNICAMENTE del siguiente texto de una providencia de la Corte Constitucional de Colombia (sentencia ${sentencia.sentencia}), genera un análisis estructurado.

Reglas estrictas:
- No uses conocimiento general ni infieras nada que no esté en el texto.
- Si un campo no puede extraerse claramente del texto, responde exactamente "no identificado en el texto" para ese campo.
- Responde ÚNICAMENTE con un objeto JSON con las claves: resumen, hechos, problema_juridico, consideraciones_relevantes, decision.

Texto de la providencia:
"""${textoCompleto}"""`

    const geminiResp = await fetch(`${GEMINI_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })
    if (!geminiResp.ok) throw new Error(`Gemini respondió ${geminiResp.status}`)

    const geminiData = await geminiResp.json()
    const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!jsonText) throw new Error('Respuesta de Gemini sin contenido')

    const analisis: AnalisisIA = JSON.parse(jsonText)

    // Sección 4.3.3: queda sin verificar hasta revisión humana.
    await admin
      .from('sentencias_cache')
      .update({
        texto_completo_url: url,
        texto_completo_no_disponible: false,
        resumen_ia: analisis.resumen,
        hechos_ia: analisis.hechos,
        problema_juridico_ia: analisis.problema_juridico,
        consideraciones_ia: analisis.consideraciones_relevantes,
        decision_ia: analisis.decision,
        resumen_ia_verificado: false,
        resumen_ia_generado_en: new Date().toISOString(),
      })
      .eq('id', sentencia_id)

    return new Response(JSON.stringify({ ok: true, analisis }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
