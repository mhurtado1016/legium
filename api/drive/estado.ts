// Vercel Serverless Function: estado de la conexión con Google Drive de
// la firma del usuario que llama (para el panel de Administración).
// No expone el refresh_token, solo si hay una cuenta conectada y cuál.

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

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
      .select('cuenta_email')
      .eq('firma_id', quienConsulta.firma_id)
      .maybeSingle()

    res.status(200).json({ ok: true, conectado: !!integracion, cuentaEmail: integracion?.cuenta_email ?? null })
  } catch (err) {
    console.error('Error en drive/estado:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
