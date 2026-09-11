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
import sanitizeHtml from 'sanitize-html'
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

function detectarCharset(headerContentType: string | undefined, muestraLatin1: string): string {
  // 1. Content-Type del header HTTP
  const enHeader = headerContentType?.match(/charset=["']?([\w-]+)/i)?.[1]
  if (enHeader) return enHeader.toLowerCase()

  // 2. <meta charset="..."> o <meta http-equiv="Content-Type" content="...charset=...">
  const enMeta =
    muestraLatin1.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    muestraLatin1.match(/<meta[^>]+http-equiv=["']content-type["'][^>]+content=["'][^"']*charset=([\w-]+)/i)?.[1]
  if (enMeta) return enMeta.toLowerCase()

  return 'utf-8'
}

function decodificarBuffer(buffer: Buffer, headerContentType: string | undefined): string {
  const muestraLatin1 = buffer.subarray(0, 2000).toString('latin1')
  const charset = detectarCharset(headerContentType, muestraLatin1)

  // UTF-8 se decodifica tal cual. Cualquier variante de ISO-8859-1 /
  // Windows-1252 (lo más común en sitios de gobierno colombianos) se
  // trata como 'latin1': Node no tiene un decodificador nativo para
  // windows-1252, pero para las letras con tilde y la ñ del español
  // ambas codificaciones coinciden, así que el resultado es correcto
  // en la práctica.
  if (charset.includes('utf-8') || charset.includes('utf8')) {
    return buffer.toString('utf-8')
  }
  return buffer.toString('latin1')
}

function extraerTextoPlano(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(p|br|div|li|tr|h[1-6])[^>]*>/gi, '\n') // saltos de línea en bloques
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // colapsar líneas en blanco repetidas
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

// Conserva el formato real de la providencia (negrita, cursiva,
// subrayado, títulos, listas, tablas) para que el texto se vea idéntico
// al del sitio oficial — a diferencia de extraerTextoPlano(), que
// aplana todo a texto simple (usado solo como insumo para el prompt de
// Gemini, donde el formato no aporta nada). Se usa una librería real de
// sanitización (no expresiones regulares) porque limpiar HTML a mano de
// forma segura es fácil de hacer mal: sanitize-html quita explícitamente
// <script>, <style>, manejadores de eventos (onclick, etc.) y cualquier
// atributo, dejando solo la estructura de formato.
function sanitizarHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'div', 'span',
      'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'blockquote', 'hr',
    ],
    allowedAttributes: {}, // se quita todo atributo (style, class, onclick, etc.)
    exclusiveFilter: (frame) =>
      // Quita contenedores vacíos que sobran al eliminar scripts/estilos/nav.
      ['div', 'span'].includes(frame.tag) && !frame.text.trim() && frame.attribs && Object.keys(frame.attribs).length === 0,
  })
}

function fetchViaHttps(url: string): Promise<{ status: number; texto: string; html: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { agent: agenteSinVerificacion, headers: HEADERS_NAVEGADOR, timeout: 20_000 },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const buffer = Buffer.concat(chunks)
          const htmlOriginal = decodificarBuffer(buffer, res.headers['content-type'])
          resolve({
            status: res.statusCode ?? 0,
            texto: extraerTextoPlano(htmlOriginal),
            html: sanitizarHtml(htmlOriginal),
          })
        })
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
    const { status, texto, html } = await fetchViaHttps(url)
    res.status(200).json({ status, texto, html })
  } catch (err) {
    console.error('proxy-corte error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}
