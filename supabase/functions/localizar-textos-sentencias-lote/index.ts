// Edge Function: localizar-textos-sentencias-lote
// Ver especificación técnica, sección 4.3.1, punto 4 (job asíncrono,
// con reintentos limitados). Pensada para correr como cron periódico.
//
// Recorre sentencias_cache que aún no tienen texto_completo_url ni están
// marcadas como texto_completo_no_disponible, y llama a la misma lógica
// de localizar-texto-sentencia para cada una, en lotes pequeños para no
// saturar el sitio de la Corte ni exceder el tiempo de ejecución de la
// función.

import { createClient } from 'npm:@supabase/supabase-js@2'

const TAMANO_LOTE = 25

function construirUrlCandidata(
  sentenciaTipo: string,
  sentencia: string,
  fechaSentencia: string,
): string | null {
  const match = sentencia.match(/^([A-Z]+)-?(\d+)\/(\d{2})$/i)
  if (!match) return null
  const [, , numero, anioYY] = match

  const anioCompleto = new Date(fechaSentencia).getFullYear()
  if (!anioCompleto) return null

  const tipo = sentenciaTipo.toUpperCase()
  const slug =
    tipo === 'SU' ? `SU${numero}-${anioYY}` : `${tipo.toLowerCase()}-${numero}-${anioYY}`

  return `https://www.corteconstitucional.gov.co/relatoria/${anioCompleto}/${slug}.htm`
}

Deno.serve(async (_req) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: pendientes, error } = await admin
    .from('sentencias_cache')
    .select('id, sentencia, sentencia_tipo, fecha_sentencia')
    .is('texto_completo_url', null)
    .eq('texto_completo_no_disponible', false)
    .limit(TAMANO_LOTE)

  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })

  let resueltas = 0
  let noDisponibles = 0

  for (const s of pendientes ?? []) {
    const candidata =
      s.sentencia_tipo && s.fecha_sentencia
        ? construirUrlCandidata(s.sentencia_tipo, s.sentencia, s.fecha_sentencia)
        : null

    if (!candidata) {
      await admin.from('sentencias_cache').update({ texto_completo_no_disponible: true }).eq('id', s.id)
      noDisponibles++
      continue
    }

    try {
      const resp = await fetch(candidata)
      if (resp.ok) {
        await admin
          .from('sentencias_cache')
          .update({ texto_completo_url: candidata, texto_completo_no_disponible: false })
          .eq('id', s.id)
        resueltas++
      } else {
        await admin.from('sentencias_cache').update({ texto_completo_no_disponible: true }).eq('id', s.id)
        noDisponibles++
      }
    } catch {
      // Error de red puntual: se deja pendiente para el siguiente lote
      // (no se marca como no_disponible por una falla transitoria).
    }
  }

  return new Response(
    JSON.stringify({ ok: true, revisadas: pendientes?.length ?? 0, resueltas, noDisponibles }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
