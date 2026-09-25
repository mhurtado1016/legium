// Vercel Serverless Function: si hay una cuenta de servicio de Google
// Drive configurada (GOOGLE_SERVICE_ACCOUNT_KEY) y cuál es su
// client_email — el dato que un administrador necesita para compartir
// las carpetas de Drive con esa cuenta (Compartir → pegar ese correo).
// No expone la clave privada.

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY

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
    if (!raw) {
      res.status(200).json({ ok: true, configurado: false, cuentaEmail: null })
      return
    }
    const { client_email } = JSON.parse(raw)
    res.status(200).json({ ok: true, configurado: !!client_email, cuentaEmail: client_email ?? null })
  } catch (err) {
    console.error('Error en drive/estado:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
