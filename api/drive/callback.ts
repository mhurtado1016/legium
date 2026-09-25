// Vercel Serverless Function: callback de OAuth de Google Drive.
//
// Registrada como redirect_uri en Google Cloud Console. Google llega acá
// con un GET plano tras la pantalla de consentimiento — sin ningún header
// nuestro, como cualquier redirección de navegador —, así que la
// identidad de quién inició el flujo viaja en el parámetro `state`: el
// propio access_token de su sesión de Supabase (ver iniciarConexionDrive
// en src/lib/drive.ts). Se valida acá, igual que hace invitar-usuario
// (Edge Function) con el patrón de dos clientes: uno "anon" con el
// Authorization del que llama (respeta RLS, sirve para verificar quién
// es), y uno con service_role para guardar el resultado (integraciones_drive
// no tiene políticas RLS para authenticated, ver migración 0024).

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const base = `https://${req.headers.host}`
  const irAAdministracion = (resultado: 'conectado' | 'error') => {
    res.writeHead(302, { Location: `${base}/app/administracion?drive=${resultado}` })
    res.end()
  }

  const code = typeof req.query.code === 'string' ? req.query.code : null
  const state = typeof req.query.state === 'string' ? req.query.state : null
  const errorParam = typeof req.query.error === 'string' ? req.query.error : null

  if (errorParam || !code || !state) {
    if (errorParam) console.error('Google devolvió un error en el consentimiento de Drive:', errorParam)
    irAAdministracion('error')
    return
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Faltan variables de entorno para conectar Google Drive (Supabase o GOOGLE_CLIENT_ID/SECRET)')
    irAAdministracion('error')
    return
  }

  try {
    const comoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${state}` } },
    })
    const { data: userData } = await comoUsuario.auth.getUser()
    if (!userData?.user) throw new Error('Sesión inválida o expirada; volvé a intentar desde Administración')

    const { data: quienConecta } = await comoUsuario
      .from('usuarios')
      .select('firma_id, es_administrador')
      .eq('id', userData.user.id)
      .single()
    if (!quienConecta?.es_administrador) throw new Error('Solo un administrador puede conectar Google Drive')

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: `${base}/api/drive/callback`,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.refresh_token) {
      throw new Error(
        tokenData.error_description ||
          tokenData.error ||
          'Google no devolvió un token de refresco para esta cuenta',
      )
    }

    const perfilRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const perfil = perfilRes.ok ? await perfilRes.json() : null

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { error: upsertError } = await admin.from('integraciones_drive').upsert({
      firma_id: quienConecta.firma_id,
      refresh_token: tokenData.refresh_token,
      cuenta_email: perfil?.email ?? null,
      conectado_por: userData.user.id,
      updated_at: new Date().toISOString(),
    })
    if (upsertError) throw upsertError

    irAAdministracion('conectado')
  } catch (err) {
    console.error('Error conectando Google Drive:', err)
    irAAdministracion('error')
  }
}
