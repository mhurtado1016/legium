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

// Certificados para completar la cadena TLS del sitio de la Corte
// Constitucional: su servidor no envía el certificado intermedio, lo
// que hace que Deno rechace la conexión con "UnknownIssuer" (los
// navegadores lo toleran completando la cadena por su cuenta; Deno no).
// Cadena: GoDaddy TLS Intermediate CA DV - R1v1 -> GoDaddy TLS Root CA
// - R1 (cross-signed) -> Go Daddy Root Certificate Authority - G2.
// Obtenida de https://certs.godaddy.com/repository/gd_bundle_dv-r1-g2.crt.pem
// Verificar de nuevo si GoDaddy rota estos certificados en el futuro.
const CADENA_CORTE_CONSTITUCIONAL = [
  `-----BEGIN CERTIFICATE-----
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
-----END CERTIFICATE-----`,
  `-----BEGIN CERTIFICATE-----
MIIFhjCCBG6gAwIBAgIRAJDebH+ztQs8BhdyT8E0Aq0wDQYJKoZIhvcNAQELBQAw
gYMxCzAJBgNVBAYTAlVTMRAwDgYDVQQIEwdBcml6b25hMRMwEQYDVQQHEwpTY290
dHNkYWxlMRowGAYDVQQKExFHb0RhZGR5LmNvbSwgSW5jLjExMC8GA1UEAxMoR28g
RGFkZHkgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgLSBHMjAeFw0yNTA5MjQx
MjAwMDBaFw0zNzEyMzEyMzU5NTlaMEYxCzAJBgNVBAYTAlVTMRQwEgYDVQQKEwtH
b0RhZGR5LmNvbTEhMB8GA1UEAxMYR29EYWRkeSBUTFMgUm9vdCBDQSAtIFIxMIIC
IjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAwutyndeeSeRO9j0jUjOxADwr
++nlMlGJiwJlYyK1fEYf7IPX50+4LmdXO7oEuVdZnx/sTtyzuUYFR7KB5vYKysRL
HW4W0HxHclHhQ4Aw0T8quVgXAcHJ0XUmFy20wQSSiMGq30h/4qzwajYF7isgCPj3
nIXMCsA9zwDHaTIaCp/1KXRLVJRvGS681Giaxve42D6txJaDjNRWLFCKMhmbYAgH
E1b2DNqCGzp2eiDquCrAFgqTtY2Fk58BOSr8YdT2CWeaKIwx4U8raSqj1g1aTXs3
MRiasGnoQsnAzCG66lcuJ+ag4AvZrG+Q7VyLrpYoHE8Hk4+DLlZ92FinuXYDPx30
wMpYJjA9OlGPB/jUCAYqGvAyMQn4f+0b7C7u9YfQGT4F+XaAG03IaO85sYkcyAm6
w8BINtZOEFrDg+sDqwpM09pAJi1UJiLqH8lcHf0/aKVOLF4L2GIQWY+TCmWCN/+3
/sK8XpegJEgWRTa9Rg3lZD26kthFMxkhWsc7Ec5zF6+9sPaNK4jPZnJ1ZZ3BLOhB
vyDn9uaF+tfAs+UIBmGHH4TmWMz84uWRrJKiLfmYYTgxU5+V33gnubXVR5jvq3jd
EgZbQcXt/CbnnoLe2F3vRFncpbBKI4ElAbMMzONj5HneQmdSWM9KVKoN6ZQTV+wb
t684+CtlJdzys/ZZMDECAwEAAaOCAS8wggErMA4GA1UdDwEB/wQEAwIBhjATBgNV
HSUEDDAKBggrBgEFBQcDATAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBTsUhGV
cHMZyN7KSEOXSxw1JCJDUDAfBgNVHSMEGDAWgBQ6moUHEGcotu/2vQVBbiDBlNoP
3jBUBggrBgEFBQcBAQRIMEYwRAYIKwYBBQUHMAKGOGh0dHA6Ly9jZXJ0aWZpY2F0
ZXMuZ29kYWRkeS5jb20vcmVwb3NpdG9yeS9nZHJvb3QtZzIuY3J0MCYGA1UdIAQf
MB0wCAYGZ4EMAQIBMAgGBmeBDAECAjAHBgVngQwBATA1BgNVHR8ELjAsMCqgKKAm
hiRodHRwOi8vY3JsLmdvZGFkZHkuY29tL2dkcm9vdC1nMi5jcmwwDQYJKoZIhvcN
AQELBQADggEBAEhbCwX1uaC5L9mJ+D6X4P/VH6Q2+zfX+dXnEBNNoE/xqboBmdFg
4SPi0+cRl1DBGELmn7L3wXdzuTh+e4bHIgvbzoZL8UJjQbTfE5w/EUU9tn0vsPxh
MgN2uWpme0gEGNTwUoX9D36vh1cDardevHaSbNYXRPR40Hrv5dHgoP0FVeaCZ09u
q2mtRVg6PSIQE5ycT2gPrbFxfo+lF/zxCy6BXkf46toy8AVz30rAYkVBNSqGANO0
rAeYLisohAJC59e+sjjxyFL9i8iYuD1PjUUYTNtQPPeOQKAhAmEphJ0iWPt98lrI
NaewsVVCcxYIgvifrn/Ptta4PPW7Z35c+Yc=
-----END CERTIFICATE-----`,
  `-----BEGIN CERTIFICATE-----
MIIDxTCCAq2gAwIBAgIBADANBgkqhkiG9w0BAQsFADCBgzELMAkGA1UEBhMCVVMx
EDAOBgNVBAgTB0FyaXpvbmExEzARBgNVBAcTClNjb3R0c2RhbGUxGjAYBgNVBAoT
EUdvRGFkZHkuY29tLCBJbmMuMTEwLwYDVQQDEyhHbyBEYWRkeSBSb290IENlcnRp
ZmljYXRlIEF1dGhvcml0eSAtIEcyMB4XDTA5MDkwMTAwMDAwMFoXDTM3MTIzMTIz
NTk1OVowgYMxCzAJBgNVBAYTAlVTMRAwDgYDVQQIEwdBcml6b25hMRMwEQYDVQQH
EwpTY290dHNkYWxlMRowGAYDVQQKExFHb0RhZGR5LmNvbSwgSW5jLjExMC8GA1UE
AxMoR28gRGFkZHkgUm9vdCBDZXJ0aWZpY2F0ZSBBdXRob3JpdHkgLSBHMjCCASIw
DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAL9xYgjx+lk09xvJGKP3gElY6SKD
E6bFIEMBO4Tx5oVJnyfq9oQbTqC023CYxzIBsQU+B07u9PpPL1kwIuerGVZr4oAH
/PMWdYA5UXvl+TW2dE6pjYIT5LY/qQOD+qK+ihVqf94Lw7YZFAXK6sOoBJQ7Rnwy
DfMAZiLIjWltNowRGLfTshxgtDj6AozO091GB94KPutdfMh8+7ArU6SSYmlRJQVh
GkSBjCypQ5Yj36w6gZoOKcUcqeldHraenjAKOc7xiID7S13MMuyFYkMlNAJWJwGR
tDtwKj9useiciAF9n9T521NtYJ2/LOdYq7hfRvzOxBsDPAnrSTFcaUaz4EcCAwEA
AaNCMEAwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8EBAMCAQYwHQYDVR0OBBYE
FDqahQcQZyi27/a9BUFuIMGU2g/eMA0GCSqGSIb3DQEBCwUAA4IBAQCZ21151fmX
WWcDYfF+OwYxdS2hII5PZYe096acvNjpL9DbWu7PdIxztDhC2gV7+AJ1uP2lsdeu
9tfeE8tTEH6KRtGX+rcuKxGrkLAngPnon1rpN5+r5N9ss4UXnT3ZJE95kTXWXwTr
gIOrmgIttRD02JDHBHNA7XIloKmf7J6raBKZV8aPEjoJpL1E/QYVN8Gb5DKj7Tjo
2GTzLH4U/ALqn83/B2gX2yKQOC16jdFU8WnjXzPKej17CuPKf1855eJ1usV2GDPO
LPAvTK33sefOT6jEm0pUBsV/fdUID+Ic/n4XuKxe9tQWskMJDE32p2u0mYRlynqI
4uJEvlz36hz1
-----END CERTIFICATE-----`,
]

const clienteCorteConstitucional = Deno.createHttpClient({
  caCerts: CADENA_CORTE_CONSTITUCIONAL,
})

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
      docResp = await fetch(url, { client: clienteCorteConstitucional })
    } catch (err) {
      await admin
        .from('sentencias_cache')
        .update({ texto_completo_no_disponible: true })
        .eq('id', sentencia_id)
      return new Response(
        JSON.stringify({ ok: false, motivo: 'no_se_pudo_descargar_el_texto', detalle: String(err) }),
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
