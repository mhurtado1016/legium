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
import { correoAvisoAdmin, correoConfirmacionCliente } from './_lib/plantillasCorreo'

export const config = {
  runtime: 'nodejs',
  maxDuration: 30,
}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@legium.app'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
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

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
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
        'Confirmación de tu consulta con Legium',
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
