// Edge Function: obtener-texto-sentencia
//
// Pide al proxy de Vercel (api/proxy-corte.ts) el texto de una
// providencia y lo devuelve tal cual — el proxy ya se encarga de
// detectar la codificación real del sitio (evita símbolos corruptos por
// asumir UTF-8 cuando el sitio usa otra) y de extraer solo el texto
// plano, sin las etiquetas HTML ni la navegación/menús del sitio. El
// frontend lo muestra como texto normal dentro de la página, no en un
// iframe con scroll propio.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  const data = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new Error(`Proxy respondió ${resp.status}${data?.error ? `: ${data.error}` : ''}`)
  }
  if (data?.error) throw new Error(data.error)
  return { ok: data.status >= 200 && data.status < 300, status: data.status, text: data.body }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { url } = await req.json()
    if (!url || !url.startsWith('https://www.corteconstitucional.gov.co/')) {
      throw new Error('URL no permitida')
    }

    const resp = await fetchCorteConstitucional(url)
    if (!resp.ok) throw new Error(`El sitio respondió ${resp.status}`)

    return new Response(JSON.stringify({ texto: resp.text }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
