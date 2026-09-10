// Edge Function: extraer-texto-documento
// Ver especificación técnica, sección 7.3.
//
// Se invoca después de subir una nueva documento_version. Descarga el
// archivo, extrae texto según el tipo MIME y lo guarda en
// documento_versiones.texto_extraido, para habilitar la búsqueda de
// contenido (sección 7.4).
//
// NOTA: la extracción de texto real de PDF/DOCX requiere una librería
// dedicada (ej. pdf-parse, mammoth); aquí se implementa el caso simple
// de texto plano/HTML como base, y se deja explícito qué falta para
// los demás formatos (ver sección 7.5, pendiente de definir).

import { createClient } from 'npm:@supabase/supabase-js@2'
// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  documento_version_id: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const { documento_version_id }: Body = await req.json()

    const { data: version, error: fetchError } = await admin
      .from('documento_versiones')
      .select('*')
      .eq('id', documento_version_id)
      .single()
    if (fetchError || !version) throw new Error('Versión de documento no encontrada')

    const { data: file, error: downloadError } = await admin.storage
      .from('documentos')
      .download(version.storage_path)
    if (downloadError) throw downloadError

    let texto = ''
    const mime = version.mime_type ?? ''

    if (mime.startsWith('text/') || mime === 'application/json') {
      texto = await file.text()
    } else if (mime === 'text/html') {
      texto = (await file.text()).replace(/<[^>]+>/g, ' ')
    } else {
      // PDF, DOCX, etc.: pendiente integrar una librería de extracción
      // (ver sección 7.5). Por ahora se deja sin texto extraído, sin que
      // eso bloquee la subida del documento.
      await admin
        .from('documento_versiones')
        .update({ texto_extraido_en: new Date().toISOString() })
        .eq('id', documento_version_id)
      return new Response(
        JSON.stringify({ ok: true, motivo: 'tipo_de_archivo_sin_extraccion_implementada' }),
        { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    await admin
      .from('documento_versiones')
      .update({ texto_extraido: texto.slice(0, 500_000), texto_extraido_en: new Date().toISOString() })
      .eq('id', documento_version_id)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
