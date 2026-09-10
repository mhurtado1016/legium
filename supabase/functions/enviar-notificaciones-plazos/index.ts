// Edge Function: enviar-notificaciones-plazos
// Ver especificación técnica, sección 6.3. Job programado (cron, ej. cada hora).
//
// Revisa plazo_notificaciones con enviado = false cuya fecha de disparo
// (fecha_vencimiento - dias_antes) ya se cumplió, y despacha según el canal:
// - app:   no requiere envío; el frontend consulta `plazos` directamente.
//          Se marca enviado = true solo para no reprocesarla.
// - email: vía Resend (requiere secreto RESEND_API_KEY).
// - push:  vía Web Push API (requiere VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:soporte@legium.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: pendientes, error } = await admin
    .from('plazo_notificaciones')
    .select('*, plazos(titulo, fecha_vencimiento, responsable_id, caso_id)')
    .eq('enviado', false)

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })

  let enviadas = 0

  for (const n of pendientes ?? []) {
    const plazo = n.plazos as {
      titulo: string
      fecha_vencimiento: string
      responsable_id: string
    }
    if (!plazo) continue

    const disparo = new Date(plazo.fecha_vencimiento)
    disparo.setDate(disparo.getDate() - n.dias_antes)
    if (new Date() < disparo) continue // aún no toca enviar esta

    const { data: responsable } = await admin
      .from('usuarios')
      .select('email, nombre')
      .eq('id', plazo.responsable_id)
      .single()

    try {
      if (n.canal === 'email' && RESEND_API_KEY && responsable?.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Legium <notificaciones@legium.app>',
            to: responsable.email,
            subject: `Plazo próximo a vencer: ${plazo.titulo}`,
            text: `El plazo "${plazo.titulo}" vence el ${new Date(plazo.fecha_vencimiento).toLocaleDateString('es-CO')}.`,
          }),
        })
      }

      if (n.canal === 'push' && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('*')
          .eq('usuario_id', plazo.responsable_id)

        for (const sub of subs ?? []) {
          const payload = JSON.stringify({
            title: 'Legium',
            body: `Plazo próximo a vencer: ${plazo.titulo}`,
          })
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            )
          } catch {
            // suscripción expirada/inválida: se limpia para no reintentar en vano
            await admin.from('push_subscriptions').delete().eq('id', sub.id)
          }
        }
      }

      // canal 'app': no requiere envío, el frontend consulta `plazos` directamente.

      await admin
        .from('plazo_notificaciones')
        .update({ enviado: true, enviado_en: new Date().toISOString() })
        .eq('id', n.id)
      enviadas++
    } catch (err) {
      console.error(`Error notificando plazo ${n.plazo_id} (canal ${n.canal}):`, err)
    }
  }

  return new Response(JSON.stringify({ ok: true, enviadas }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
})
