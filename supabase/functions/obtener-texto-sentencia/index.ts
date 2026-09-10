// Edge Function: obtener-texto-sentencia
//
// Descarga del lado del servidor el HTML de texto_completo_url y lo
// devuelve como texto plano, para que el frontend lo muestre con
// `srcDoc` en un iframe sandboxed. Esto evita el bloqueo por
// X-Frame-Options que muchos sitios de gobierno aplican cuando se
// intenta embeber su página directamente con <iframe src="...">
// (esa cabecera solo restringe el navegador del usuario, no una
// petición servidor-a-servidor como esta).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    if (!url || !url.startsWith('https://www.corteconstitucional.gov.co/')) {
      throw new Error('URL no permitida')
    }

    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`El sitio respondió ${resp.status}`)

    let html = await resp.text()

    // Insertar una etiqueta <base> para que las rutas relativas del sitio
    // (imágenes, CSS) sigan resolviendo contra el dominio original.
    const base = `<base href="${url}">`
    html = html.includes('<head>') ? html.replace('<head>', `<head>${base}`) : base + html

    return new Response(JSON.stringify({ html }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
