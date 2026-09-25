// Vercel Serverless Function: elimina un archivo de Google Drive.
//
// A diferencia de la subida, esto sí pasa por el backend (no expone
// ningún token al navegador): un DELETE no tiene el problema de tamaño
// de las subidas grandes, así que no hace falta el trade-off de
// seguridad aceptado en api/drive/token.ts.

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

async function obtenerAccessToken(client_email: string, private_key: string) {
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

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'No se pudo autenticar la cuenta de servicio de Google')
  return data.access_token as string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método no permitido' })
    return
  }

  const token = (req.headers.authorization || '').replace(/^Bearer /i, '')
  const fileId = typeof req.body?.fileId === 'string' ? req.body.fileId : null

  if (!token) {
    res.status(401).json({ ok: false, error: 'No autenticado' })
    return
  }
  if (!fileId) {
    res.status(400).json({ ok: false, error: 'Falta fileId' })
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

    const accessToken = await obtenerAccessToken(client_email, private_key)

    const eliminarRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } },
    )
    // Log temporal para diagnosticar por qué el archivo sigue apareciendo
    // en Drive pese a que el endpoint devuelve éxito — files.delete
    // debería responder 204 sin cuerpo; cualquier otra cosa es una pista.
    const cuerpoRespuesta = await eliminarRes.text()
    console.log(`drive/eliminar fileId=${fileId} status=${eliminarRes.status} body=${cuerpoRespuesta || '(vacío)'}`)

    if (!eliminarRes.ok && eliminarRes.status !== 404) {
      let detalle: { error?: { message?: string } } | null = null
      try {
        detalle = JSON.parse(cuerpoRespuesta)
      } catch {
        // cuerpo no era JSON, se ignora y se usa el mensaje genérico
      }
      throw new Error(detalle?.error?.message || 'No se pudo eliminar el archivo de Google Drive')
    }

    res.status(200).json({ ok: true, googleStatus: eliminarRes.status })
  } catch (err) {
    console.error('Error en drive/eliminar:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
