// Vercel Serverless Function (Node.js runtime): notifica una cita
// nueva agendada desde el landing público — correo de confirmación al
// cliente, y correo + push a cada administrador del despacho.
//
// Por qué es una función de Vercel y no una Edge Function de Supabase:
// se intentó primero ahí con SMTP real (denomailer) y el runtime
// sandboxeado de Supabase Edge Functions no completa el handshake
// STARTTLS — revienta el worker completo (mismo tipo de limitación de
// TLS/sockets ya documentada en api/proxy-corte.ts para ese runtime).
// nodemailer en el runtime Node.js normal de Vercel no tiene ese
// problema.
//
// Solo recibe `cita_id`: la fila se vuelve a leer aquí con la service
// role (bypass RLS) en vez de confiar en datos que mande el cliente,
// así un visitante anónimo no puede falsificar el contenido del aviso
// a los administradores.

import nodemailer from 'nodemailer'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ---------- Plantillas de correo ----------
// Antes vivían en api/_lib/plantillasCorreo.ts, pero Vercel no empaqueta
// archivos locales importados por funciones ESM ("type": "module" en
// package.json): solo compila el archivo de entrada, así que en runtime
// el import relativo no se resolvía (ERR_MODULE_NOT_FOUND). Se dejan
// inline para que la función sea autocontenida.
//
// HTML con estilos inline y layout de tablas — no @import de fuentes ni
// CSS externo, porque la mayoría de clientes de correo (Gmail, Outlook)
// los ignora o los bloquea; todo lo que importa va inline.
//
// Reproduce los mismos tokens de marca que src/index.css: fondo
// --color-paper, tarjeta --color-paper-raised, texto --color-ink, el
// "eyebrow" en --color-seal (mismo patrón que SectionHeading en
// LandingPage.tsx) y el acento --color-seal-soft para el recuadro con
// la fecha/hora. Sin el logo como imagen: requeriría una URL absoluta a
// un dominio, y el wordmark en texto es igual de reconocible y no se
// puede romper.

const INK = '#161d27'
const PAPER = '#f7f6f3'
const PAPER_RAISED = '#ffffff'
const SEAL = '#7a2a2e'
const SEAL_SOFT = '#f3e6e6'
const SLATE = '#5b6472'
const LINE = '#e4e1d8'
const FONT = "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif"

// Los datos del cliente (nombre, correo, teléfono, notas) llegan del
// formulario público sin sanitizar — hay que escaparlos antes de
// meterlos en el HTML del correo, o cualquiera puede inyectar markup
// (o intentar algo peor) con solo escribirlo en el campo "Nombre".
function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function envolverCorreo(eyebrow: string, titulo: string, contenidoHtml: string) {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titulo}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAPER};font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${PAPER_RAISED};border:1px solid ${LINE};border-radius:12px;">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid ${LINE};">
                <span style="font-size:20px;font-weight:700;letter-spacing:0.02em;color:${INK};">EFRATA 360</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${SEAL};">
                  ${eyebrow}
                </p>
                <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${INK};font-family:${FONT};">
                  ${titulo}
                </h1>
                <div style="font-size:15px;line-height:1.6;color:${INK};">
                  ${contenidoHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 26px;border-top:1px solid ${LINE};">
                <p style="margin:0;font-size:12px;color:${SLATE};">
                  Efrata 360 — Claridad jurídica para decisiones que importan.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function recuadroDato(label: string, valor: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SEAL_SOFT};border-radius:8px;margin:4px 0 20px;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${SEAL};">${label}</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:${INK};">${valor}</p>
      </td>
    </tr>
  </table>`
}

function correoConfirmacionCliente(datos: { nombre: string; cuando: string; tipoTexto: string }) {
  const { nombre, cuando, tipoTexto } = datos
  const html = envolverCorreo(
    'Confirmación de cita',
    'Tu consulta quedó agendada',
    `<p style="margin:0 0 16px;">Hola ${escaparHtml(nombre)},</p>
     <p style="margin:0 0 4px;">Agendaste una consulta <strong>${tipoTexto}</strong> con nosotros:</p>
     ${recuadroDato('Fecha y hora', cuando)}
     <p style="margin:0;color:${SLATE};">Si necesitas reprogramarla, contáctanos respondiendo este correo.</p>`,
  )
  const text =
    `Hola ${nombre},\n\n` +
    `Tu consulta quedó agendada para el ${cuando} (${tipoTexto}).\n\n` +
    `Si necesitas reprogramarla, contáctanos respondiendo este correo.\n\n— Efrata 360`
  return { html, text }
}

function correoAvisoAdmin(datos: {
  nombreCliente: string
  cuando: string
  tipoTexto: string
  correoCliente: string
  telefono: string | null
  notas: string | null
}) {
  const { nombreCliente, cuando, tipoTexto, correoCliente, telefono, notas } = datos
  const html = envolverCorreo(
    'Nueva cita',
    'Se agendó una consulta desde el landing',
    `<p style="margin:0 0 4px;"><strong>${escaparHtml(nombreCliente)}</strong> agendó una consulta <strong>${tipoTexto}</strong>:</p>
     ${recuadroDato('Fecha y hora', cuando)}
     <p style="margin:0 0 6px;"><strong>Correo:</strong> ${escaparHtml(correoCliente)}</p>
     <p style="margin:0 0 6px;"><strong>Teléfono:</strong> ${telefono ? escaparHtml(telefono) : '—'}</p>
     ${notas ? `<p style="margin:0;"><strong>Notas:</strong> ${escaparHtml(notas)}</p>` : ''}`,
  )
  const text =
    `${nombreCliente} agendó una consulta ${tipoTexto} para el ${cuando}.\n\n` +
    `Correo: ${correoCliente}\n` +
    `Teléfono: ${telefono || '—'}\n` +
    (notas ? `Notas: ${notas}\n` : '')
  return { html, text }
}

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@efrata360.com'

// web-push valida el formato de la vapid key al configurarla y lanza de
// forma síncrona si está mal formada — sin este try/catch eso tumbaba
// el módulo entero en cada cold start y todas las peticiones recibían
// un 500 genérico de la plataforma, sin llegar nunca al handler ni a
// su try/catch (que sí devuelve el detalle en JSON).
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  } catch (err) {
    console.error('VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY inválidas, push deshabilitado:', err)
  }
}

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = Number(process.env.SMTP_PORT || '587')
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

const transporter =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // 465 = TLS implícito; 587 negocia STARTTLS
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null

async function enviarCorreo(to: string, subject: string, contenido: { html: string; text: string }) {
  if (!transporter) {
    console.error('SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS); se omite el correo a', to)
    return
  }
  await transporter.sendMail({ from: SMTP_FROM!, to, subject, html: contenido.html, text: contenido.text })
}

function formatoFechaHora(fecha: string, horaInicio: string) {
  const dt = new Date(`${fecha}T${horaInicio}`)
  const fechaTexto = dt.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const horaTexto = dt.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
  return `${fechaTexto} a las ${horaTexto}`
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

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ ok: false, error: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas' })
    return
  }

  const citaId = typeof req.body?.cita_id === 'string' ? req.body.cita_id : null
  if (!citaId) {
    res.status(400).json({ ok: false, error: 'Falta cita_id' })
    return
  }

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: cita, error: errCita } = await admin
      .from('citas_agenda')
      .select('*')
      .eq('id', citaId)
      .single()

    if (errCita || !cita) {
      res.status(404).json({ ok: false, error: 'Cita no encontrada' })
      return
    }

    const cuando = formatoFechaHora(cita.fecha, cita.hora_inicio)
    const tipoTexto = cita.tipo_sesion === 'presencial' ? 'presencial' : 'virtual'

    // ---------- Correo de confirmación al cliente ----------
    try {
      await enviarCorreo(
        cita.correo_cliente,
        'Confirmación de tu consulta con Efrata 360',
        correoConfirmacionCliente({ nombre: cita.nombre_cliente, cuando, tipoTexto }),
      )
    } catch (err) {
      console.error('Error enviando correo de confirmación al cliente:', err)
    }

    // ---------- Aviso a administradores ----------
    const { data: admins } = await admin.from('usuarios').select('id, nombre, email').eq('es_administrador', true)

    let pushEnviados = 0
    let correosAdminEnviados = 0

    for (const adminUsuario of admins ?? []) {
      if (adminUsuario.email) {
        try {
          await enviarCorreo(
            adminUsuario.email,
            'Nueva cita agendada desde el landing',
            correoAvisoAdmin({
              nombreCliente: cita.nombre_cliente,
              cuando,
              tipoTexto,
              correoCliente: cita.correo_cliente,
              telefono: cita.telefono_cliente,
              notas: cita.notas,
            }),
          )
          correosAdminEnviados++
        } catch (err) {
          console.error(`Error enviando correo al admin ${adminUsuario.id}:`, err)
        }
      }

      if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const { data: subs } = await admin.from('push_subscriptions').select('*').eq('usuario_id', adminUsuario.id)

        const payload = JSON.stringify({
          title: 'Nueva cita agendada',
          body: `${cita.nombre_cliente} — ${cuando} (${tipoTexto})`,
        })

        for (const sub of subs ?? []) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            )
            pushEnviados++
          } catch (err) {
            console.error(`Push fallido para suscripción ${sub.id}, se elimina:`, err)
            await admin.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }
    }

    res.status(200).json({ ok: true, correosAdminEnviados, pushEnviados, admins: admins?.length ?? 0 })
  } catch (err) {
    console.error('Error en notificar-cita:', err)
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
