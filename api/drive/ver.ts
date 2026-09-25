// Vercel Serverless Function: sirve el contenido de un archivo de Drive
// a través de nuestro propio backend, en vez de que el navegador lo pida
// directo a Google con el access_token pegado en la query string.
//
// El visor de PDF nativo de iOS/Safari re-solicita ese tipo de URLs de
// una forma que Google interpreta como tráfico automatizado y responde
// con su página de "Sorry... unusual traffic" en vez del archivo. Acá
// el pedido a Google va con el access_token en el header Authorization
// (la forma que Google sí recomienda), y lo que el navegador recibe es
// una URL propia, estable, sin token visible.
//
// Trade-off: al pasar por una función de Vercel, la respuesta queda
// acotada a su límite de 4.5 MB — para archivos más grandes hay que
// usar "Abrir en Drive" en vez del visor embebido.

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SCOPE_DRIVE_LECTURA = 'https://www.googleapis.com/auth/drive.readonly'
const LIMITE_BYTES = 4 * 1024 * 1024 // margen bajo el límite real de 4.5 MB de Vercel

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function obtenerAccessToken(client_email: string, private_key: string) {
  const ahora = Math.floor(Date.now() / 1000)
  const encabezado = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const cuerpo = base64url(
    JSON.stringify({
      iss: client_email,
      scope: SCOPE_DRIVE_LECTURA,
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
  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : null
  const token = typeof req.query.token === 'string' ? req.query.token : null

  if (!fileId) {
    res.status(400).json({ ok: false, error: 'Falta fileId' })
    return
  }
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

    const accessToken = await obtenerAccessToken(client_email, private_key)

    const archivoRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!archivoRes.ok) {
      res.status(archivoRes.status === 404 ? 404 : 502).json({ ok: false, error: 'No se pudo obtener el archivo de Google Drive' })
      return
    }

    const largoDeclarado = Number(archivoRes.headers.get('content-length') || '0')
    if (largoDeclarado > LIMITE_BYTES) {
      res.status(413).json({ ok: false, error: 'El archivo es demasiado grande para previsualizar; usá "Abrir en Drive".' })
      return
    }

    const buffer = Buffer.from(await archivoRes.arrayBuffer())
    if (buffer.byteLength > LIMITE_BYTES) {
      res.status(413).json({ ok: false, error: 'El archivo es demasiado grande para previsualizar; usá "Abrir en Drive".' })
      return
    }

    res.setHeader('Content-Type', archivoRes.headers.get('content-type') || 'application/octet-stream')
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.status(200).send(buffer)
  } catch (err) {
    console.error('Error en drive/ver:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
