// Vercel Serverless Function: emite un access_token de corta duración
// (~1h) de la cuenta de servicio de Drive, con permiso de lectura y
// escritura, para que el navegador suba el archivo directo a Google sin
// pasar por nuestro servidor — las funciones de Vercel rechazan
// cualquier request de más de 4.5 MB (límite fijo de la plataforma, no
// configurable), insuficiente para escaneos de expedientes grandes.
//
// Trade-off aceptado explícitamente (ver conversación de diseño): mientras
// dure ese token, quien lo tenga en el navegador puede leer/escribir
// TODO lo que la cuenta de servicio pueda tocar (todas las carpetas que
// alguien le haya compartido, no solo la de este caso) — Drive no
// permite emitir un token de cuenta de servicio acotado a una sola
// carpeta o caso.

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SCOPE_DRIVE_LECTURA_ESCRITURA = 'https://www.googleapis.com/auth/drive'

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const token = (req.headers.authorization || '').replace(/^Bearer /i, '')
  if (!token) {
    res.status(401).json({ ok: false, error: 'No autenticado' })
    return
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).json({ ok: false, error: 'Supabase no configurado' })
    return
  }

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

    const ahora = Math.floor(Date.now() / 1000)
    const encabezado = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const cuerpo = base64url(
      JSON.stringify({
        iss: client_email,
        scope: SCOPE_DRIVE_LECTURA_ESCRITURA,
        aud: 'https://oauth2.googleapis.com/token',
        exp: ahora + 3600,
        iat: ahora,
      }),
    )
    const firma = base64url(crypto.createSign('RSA-SHA256').update(`${encabezado}.${cuerpo}`).sign(private_key))
    const jwt = `${encabezado}.${cuerpo}.${firma}`

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'No se pudo autenticar la cuenta de servicio de Google')
    }

    res.status(200).json({ ok: true, accessToken: tokenData.access_token, expiraEn: tokenData.expires_in })
  } catch (err) {
    console.error('Error en drive/token:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
