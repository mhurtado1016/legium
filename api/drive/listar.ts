// Vercel Serverless Function: lista los archivos de la carpeta de
// Google Drive cuyo nombre contiene el número de radicado del caso.
//
// La cuenta de Drive es una sola, compartida para todo el despacho
// (conectada una vez desde Administración, ver api/drive/callback.ts) —
// no hay una cuenta por usuario ni una carpeta vinculada explícitamente
// por caso: se busca por coincidencia de nombre contra numero_radicado.

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

// La sintaxis de búsqueda de Drive delimita strings con comillas simples;
// sin escapar esto, un radicado con un apóstrofe rompería la query (o,
// peor, alteraría sus condiciones).
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
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ ok: false, error: 'Supabase no configurado' })
    return
  }

  try {
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData } = await comoUsuario.auth.getUser()
    if (!userData?.user) throw new Error('Sesión inválida')

    const { data: quienConsulta } = await comoUsuario
      .from('usuarios')
      .select('firma_id')
      .eq('id', userData.user.id)
      .single()
    if (!quienConsulta) throw new Error('No se pudo verificar el usuario')

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: integracion } = await admin
      .from('integraciones_drive')
      .select('refresh_token')
      .eq('firma_id', quienConsulta.firma_id)
      .maybeSingle()

    if (!integracion) {
      res.status(200).json({ ok: true, conectado: false, carpetaEncontrada: false, archivos: [] })
      return
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) throw new Error('Credenciales de Google no configuradas')

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: integracion.refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'No se pudo renovar el acceso a Google Drive')
    const accessToken = tokenData.access_token as string

    const qCarpeta = `mimeType='application/vnd.google-apps.folder' and trashed=false and name contains '${escaparParaQueryDrive(radicado)}'`
    const carpetaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qCarpeta)}&fields=files(id,name)&pageSize=5`,
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
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qArchivos)}&fields=files(id,name,mimeType,webViewLink,iconLink,modifiedTime)&orderBy=modifiedTime desc&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const archivosData = await archivosRes.json()
    if (!archivosRes.ok) throw new Error(archivosData.error?.message || 'Error listando archivos de Google Drive')

    res.status(200).json({
      ok: true,
      conectado: true,
      carpetaEncontrada: true,
      carpetaNombre: carpeta.name,
      archivos: archivosData.files ?? [],
    })
  } catch (err) {
    console.error('Error en drive/listar:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
