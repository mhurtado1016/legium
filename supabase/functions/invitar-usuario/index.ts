// Edge Function: invitar-usuario
// Panel de administración — gestión de usuarios (sección 4.7 / Fase 0,
// "creación de usuarios desde el panel del administrador").
//
// Crear un usuario en auth.users requiere la Admin API de Supabase
// (service_role), así que esto no se puede hacer con un insert directo
// desde el cliente. Mismo patrón de dos clientes que ya usan
// generar-cuenta-cobro y las demás funciones de este proyecto: un
// cliente "anon" con el Authorization del que llama (para leer su
// propia fila de `usuarios` respetando RLS) y un cliente "admin" con
// service_role para lo que RLS no permite (crear el usuario de Auth).

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  nombre: string
  email: string
  redirect_to?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { nombre, email, redirect_to }: Body = await req.json()
    if (!nombre?.trim() || !email?.trim()) throw new Error('Falta nombre o correo.')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) throw new Error('No autenticado')

    // Lectura con el cliente anon: RLS ya permite ver la propia fila
    // ("lectura de usuarios de la propia firma").
    const { data: quienInvita, error: quienInvitaError } = await supabase
      .from('usuarios')
      .select('firma_id, es_administrador')
      .eq('id', userData.user.id)
      .single()
    if (quienInvitaError || !quienInvita) throw new Error('No se pudo verificar el usuario que invita.')
    if (!quienInvita.es_administrador) throw new Error('Solo un administrador puede invitar usuarios.')

    const { data: yaExiste } = await admin
      .from('usuarios')
      .select('id')
      .eq('firma_id', quienInvita.firma_id)
      .eq('email', email.trim())
      .maybeSingle()
    if (yaExiste) throw new Error('Ya existe un usuario con este correo en la firma.')

    const { data: invitado, error: invitarError } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
      redirectTo: redirect_to,
      data: { nombre: nombre.trim() },
    })
    if (invitarError || !invitado?.user) {
      throw new Error(
        invitarError?.message?.includes('already been registered')
          ? 'Ya existe un usuario de Auth con este correo (en otra firma o sin completar registro).'
          : invitarError?.message ?? 'No se pudo enviar la invitación.',
      )
    }

    const { error: insertError } = await admin.from('usuarios').insert({
      id: invitado.user.id,
      firma_id: quienInvita.firma_id,
      nombre: nombre.trim(),
      email: email.trim(),
      es_administrador: false,
      activo: true,
      creado_por: userData.user.id,
    })
    if (insertError) {
      // El usuario de Auth ya quedó creado e invitado en este punto; no se
      // revierte (la Admin API no tiene una forma simple de "deshacer" el
      // envío del correo). Si esto falla, hay que completar la fila de
      // `usuarios` a mano para ese id en el SQL Editor.
      throw new Error(`Se envió la invitación pero falló el registro interno: ${insertError.message}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
