// Edge Function: actualizar-plazos-vencidos
// Ver especificación técnica, sección 6.3, punto 5. Job diario (cron).

import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await admin
    .from('plazos')
    .update({ estado: 'vencido' })
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', new Date().toISOString())
    .select('id')

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, actualizados: data?.length ?? 0 }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
