// Vercel Edge Function: sirve el contenido de un archivo de Drive a
// través de nuestro propio backend, transmitiéndolo en streaming en vez
// de cargarlo entero en memoria — así no hay límite de tamaño para
// previsualizar. Antes esto corría como Serverless Function de Node.js
// (`runtime: 'nodejs'`) y esas funciones tienen un tope fijo de ~4.5 MB
// en el cuerpo de la respuesta (lo mismo aplica al cuerpo del request,
// ver la nota de api/drive/token.ts): cualquier archivo más grande
// llegaba como un error JSON en vez del archivo. Las Edge Functions no
// tienen ese tope — transmiten la respuesta en streaming sin
// materializarla completa en memoria.
//
// El trade-off es no poder usar `node:crypto` (no existe en el runtime
// de Edge, que es Web APIs puras): la firma del JWT de la cuenta de
// servicio se hace acá con Web Crypto (`crypto.subtle`) en vez de
// `crypto.createSign`, a diferencia de los demás api/drive/*.ts.
//
// El visor de PDF nativo de iOS/Safari re-solicita ese tipo de URLs de
// una forma que Google interpreta como tráfico automatizado y responde
// con su página de "Sorry... unusual traffic" en vez del archivo. Acá
// el pedido a Google va con el access_token en el header Authorization
// (la forma que Google sí recomienda), y lo que el navegador recibe es
// una URL propia, estable, sin token visible.

import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'edge',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SCOPE_DRIVE_LECTURA = 'https://www.googleapis.com/auth/drive.readonly'

function base64urlDesdeTexto(texto: string) {
  return btoa(texto).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64urlDesdeBuffer(buffer: ArrayBuffer) {
  let binario = ''
  for (const byte of new Uint8Array(buffer)) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// El private_key de la cuenta de servicio viene en PEM (PKCS#8); Web
// Crypto necesita los bytes DER crudos, sin encabezados ni saltos de
// línea.
function pemAArrayBuffer(pem: string) {
  const base64 = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '')
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes.buffer
}

// Mismo flujo estándar de Google para cuentas de servicio (RFC 7523)
// que en los demás api/drive/*.ts, pero firmado con Web Crypto en vez
// de node:crypto.
async function obtenerAccessToken(clientEmail: string, privateKeyPem: string) {
  const ahora = Math.floor(Date.now() / 1000)
  const encabezado = base64urlDesdeTexto(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const cuerpo = base64urlDesdeTexto(
    JSON.stringify({
      iss: clientEmail,
      scope: SCOPE_DRIVE_LECTURA,
      aud: 'https://oauth2.googleapis.com/token',
      exp: ahora + 3600,
      iat: ahora,
    }),
  )

  const clave = await crypto.subtle.importKey(
    'pkcs8',
    pemAArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const firma = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    clave,
    new TextEncoder().encode(`${encabezado}.${cuerpo}`),
  )
  const jwt = `${encabezado}.${cuerpo}.${base64urlDesdeBuffer(firma)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'No se pudo autenticar la cuenta de servicio de Google')
  return data.access_token as string
}

function errorJson(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const fileId = url.searchParams.get('fileId')
  const token = url.searchParams.get('token')

  if (!fileId) return errorJson(400, 'Falta fileId')
  if (!token) return errorJson(401, 'No autenticado')
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return errorJson(500, 'Supabase no configurado')

  try {
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData } = await comoUsuario.auth.getUser()
    if (!userData?.user) throw new Error('Sesión inválida')

    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no configurada')
    const { client_email, private_key } = JSON.parse(raw)
    if (!client_email || !private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no tiene client_email/private_key')

    const accessToken = await obtenerAccessToken(client_email, private_key)

    const archivoRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!archivoRes.ok || !archivoRes.body) {
      return errorJson(archivoRes.status === 404 ? 404 : 502, 'No se pudo obtener el archivo de Google Drive')
    }

    // Se pasa el stream directo, sin materializarlo en memoria: es lo
    // que permite no tener límite de tamaño.
    return new Response(archivoRes.body, {
      status: 200,
      headers: {
        'Content-Type': archivoRes.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (err) {
    console.error('Error en drive/ver:', err)
    return errorJson(500, err instanceof Error ? err.message : String(err))
  }
}
