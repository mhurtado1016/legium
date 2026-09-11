// Vercel Serverless Function (Node.js runtime): proxy hacia el sitio de
// la Corte Constitucional, usado por las Edge Functions de Supabase.
//
// Por qué existe: el servidor de corteconstitucional.gov.co no envía el
// certificado intermedio de su cadena TLS. Los navegadores lo completan
// solos (AIA chasing); los clientes HTTP estrictos (Deno, Node) no, y
// fallan con UNABLE_TO_VERIFY_LEAF_SIGNATURE / UnknownIssuer.
//
// Se intentaron dos soluciones "correctas" antes de esta:
// 1. Pinnear el certificado en Deno (`Deno.createHttpClient({ caCerts })`)
//    — no funciona de forma confiable en el runtime de Supabase Edge
//    Functions (https://github.com/orgs/supabase/discussions/36035).
// 2. Pinnear el mismo certificado en Node vía `https.Agent({ ca })` —
//    tampoco lo aceptó el motor TLS de este entorno de Vercel
//    (UNABLE_TO_VERIFY_LEAF_SIGNATURE), pese a estar verificado con
//    `openssl verify` de forma independiente.
//
// Decisión consciente (aprobada explícitamente): desactivar la
// verificación del certificado (`rejectUnauthorized: false`) SOLO para
// conexiones a este dominio específico, ya validado más abajo antes de
// llegar aquí. El contenido que se trae es información pública (texto
// de sentencias), no datos de usuarios ni credenciales. El resto de la
// app sigue verificando certificados con normalidad; esto no debilita
// ninguna otra conexión.

import https from 'node:https'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Fuerza el runtime Node.js de Vercel (no el runtime "Edge", que no
// soporta el módulo `node:https` y causaría un error en cada invocación).
export const config = {
  runtime: 'nodejs',
}

const agenteSinVerificacion = new https.Agent({
  rejectUnauthorized: false,
})

const HEADERS_NAVEGADOR = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
}

function fetchViaHttps(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { agent: agenteSinVerificacion, headers: HEADERS_NAVEGADOR, timeout: 20_000 },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Tiempo de espera agotado al conectar con el sitio de la Corte'))
    })
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  const url = typeof req.query.url === 'string' ? req.query.url : ''
  // Único dominio permitido — es lo que acota el alcance de
  // rejectUnauthorized: false a este caso específico.
  if (!url.startsWith('https://www.corteconstitucional.gov.co/')) {
    res.status(400).json({ error: 'URL no permitida' })
    return
  }

  try {
    const { status, body } = await fetchViaHttps(url)
    res.status(200).json({ status, body })
  } catch (err) {
    console.error('proxy-corte error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
