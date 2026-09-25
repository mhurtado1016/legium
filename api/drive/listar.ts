// Vercel Serverless Function: lista los archivos de la carpeta de
// Google Drive cuyo nombre contiene el número de radicado del caso.
//
// Autenticación: cuenta de servicio de Google (una sola, compartida para
// todo el despacho — GOOGLE_SERVICE_ACCOUNT_KEY, el JSON completo que
// descarga Google Cloud Console al crearla). No hay OAuth de por medio:
// la cuenta de servicio solo ve las carpetas que alguien comparte
// explícitamente con su client_email (ver api/drive/estado.ts), igual
// que se comparte una carpeta con cualquier otra cuenta de Google.

import { createClient } from '@supabase/supabase-js'
import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SCOPE_DRIVE_LECTURA = 'https://www.googleapis.com/auth/drive.readonly'

interface CredencialesCuentaServicio {
  client_email: string
  private_key: string
}

function leerCredenciales(): CredencialesCuentaServicio {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no configurada')
  const datos = JSON.parse(raw)
  if (!datos.client_email || !datos.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY no tiene client_email/private_key')
  return datos
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

// Flujo estándar de Google para cuentas de servicio (RFC 7523,
// "JWT Bearer Token"): un JWT autofirmado con la clave privada de la
// cuenta de servicio, canjeado por un access_token de corta duración.
async function obtenerAccessToken({ client_email, private_key }: CredencialesCuentaServicio) {
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
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'No se pudo autenticar la cuenta de servicio de Google')
  return data.access_token as string
}

// La sintaxis de búsqueda de Drive delimita strings con comillas simples;
// sin escapar esto, un radicado con un apóstrofe rompería la query.
function escaparParaQueryDrive(texto: string) {
  return texto.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const radicado = typeof req.query.radicado === 'string' ? req.query.radicado.trim() : ''
  const token = (req.headers.authorization || '').replace(/^Bearer /i, '')

  if (!radicado) {
    res.status(400).json({ ok: false, error: 'Falta el número de radicado' })
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
    // No hace falta saber la firma del que consulta (la cuenta de
    // servicio es una sola para toda la instancia): solo se verifica que
    // sea un usuario autenticado real, para no dejar esto como proxy
    // abierto hacia la cuenta de Drive.
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData } = await comoUsuario.auth.getUser()
    if (!userData?.user) throw new Error('Sesión inválida')

    let credenciales: CredencialesCuentaServicio
    try {
      credenciales = leerCredenciales()
    } catch {
      res.status(200).json({ ok: true, conectado: false, carpetaEncontrada: false, archivos: [] })
      return
    }

    const accessToken = await obtenerAccessToken(credenciales)

    const qCarpeta = `mimeType='application/vnd.google-apps.folder' and trashed=false and name contains '${escaparParaQueryDrive(radicado)}'`
    const carpetaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qCarpeta)}&fields=files(id,name)&pageSize=5&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const carpetaData = await carpetaRes.json()
    if (!carpetaRes.ok) throw new Error(carpetaData.error?.message || 'Error consultando Google Drive')

    const carpeta = carpetaData.files?.[0]
    if (!carpeta) {
      res.status(200).json({ ok: true, conectado: true, carpetaEncontrada: false, archivos: [] })
      return
    }

    const qArchivos = `'${carpeta.id}' in parents and trashed=false`
    const archivosRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qArchivos)}&fields=files(id,name,mimeType,webViewLink,iconLink,modifiedTime)&orderBy=modifiedTime desc&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const archivosData = await archivosRes.json()
    if (!archivosRes.ok) throw new Error(archivosData.error?.message || 'Error listando archivos de Google Drive')

    res.status(200).json({
      ok: true,
      conectado: true,
      carpetaEncontrada: true,
      carpetaId: carpeta.id,
      carpetaNombre: carpeta.name,
      archivos: archivosData.files ?? [],
    })
  } catch (err) {
    console.error('Error en drive/listar:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
