// Edge Function: enviar-whatsapp
//
// Endpoint genérico de envío de WhatsApp (Meta Cloud API) para que
// cualquier acción de la aplicación pueda mandar un mensaje sin volver
// a implementar la llamada a la Graph API — mismo rol que tienen Resend
// (correo) o Web Push para sus canales, ver `_shared/whatsapp.ts` para
// el cliente y sus notas sobre texto libre vs. plantilla.
//
// Solo exige que quien llama sea un usuario autenticado y activo de una
// firma (no necesariamente administrador): el envío en sí no expone ni
// modifica datos de otro usuario, y distintas acciones (citas, plazos,
// casos, ...) lo invocarán desde distintos roles.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { enviarWhatsAppTexto, enviarWhatsAppPlantilla } from '../_shared/whatsapp.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  telefono: string
  mensaje?: string
  plantilla?: { nombre: string; idioma?: string; parametros?: string[] }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  try {
    const { telefono, mensaje, plantilla }: Body = await req.json()
    if (!telefono?.trim()) throw new Error('Falta teléfono')
    if (!mensaje?.trim() && !plantilla?.nombre?.trim()) throw new Error('Falta mensaje o plantilla')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) throw new Error('No autenticado')

    const { data: quienEnvia, error: quienEnviaError } = await supabase
      .from('usuarios')
      .select('activo')
      .eq('id', userData.user.id)
      .single()
    if (quienEnviaError || !quienEnvia?.activo) throw new Error('No se pudo verificar el usuario.')

    const resultado = plantilla
      ? await enviarWhatsAppPlantilla(telefono, plantilla.nombre, plantilla.idioma, plantilla.parametros)
      : await enviarWhatsAppTexto(telefono, mensaje!)

    if (!resultado.ok) throw new Error(resultado.error ?? 'No se pudo enviar el mensaje de WhatsApp.')

    return new Response(JSON.stringify({ ok: true, id: resultado.id }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
