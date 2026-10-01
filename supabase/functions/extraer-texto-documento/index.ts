// Edge Function: extraer-texto-documento
// Ver especificación técnica, sección 7.3.
//
// Se invoca después de subir una nueva documento_version. Descarga el
// archivo, extrae texto según el tipo MIME y lo guarda en
// documento_versiones.texto_extraido, para habilitar la búsqueda de
// contenido (sección 7.4) y el contexto del asistente de Documentos IA
// (ver documentos-ia-chat).
//
// PDF: pdfjs-dist (build "legacy", pensado para entornos sin DOM/worker
// como este) — se usa en vez de pdf-parse porque esa librería intenta
// leer un PDF de prueba de su propio paquete en modo "debug" cuando no
// detecta un module.parent normal de Node, algo que rompe en runtimes
// como Deno/edge; pdfjs-dist no tiene ese problema.
// DOCX: mammoth, que solo sabe leer el formato .docx (XML) — el .doc
// binario antiguo (application/msword) sigue sin extracción, ver más
// abajo.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getDocument } from 'npm:pdfjs-dist@4/legacy/build/pdf.mjs'
import mammoth from 'npm:mammoth@1'

// Headers CORS: sin esto, el navegador bloquea la respuesta por venir
// de un origen distinto al de la app (Vercel vs. Supabase).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  documento_version_id: string
}

async function extraerTextoPdf(bytes: Uint8Array): Promise<string> {
  const documento = await getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise

  const paginas: string[] = []
  for (let numeroPagina = 1; numeroPagina <= documento.numPages; numeroPagina++) {
    const pagina = await documento.getPage(numeroPagina)
    const contenido = await pagina.getTextContent()
    const texto = contenido.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    paginas.push(texto)
  }
  return paginas.join('\n\n')
}

async function extraerTextoDocx(bytes: ArrayBuffer): Promise<string> {
  const resultado = await mammoth.extractRawText({ buffer: new Uint8Array(bytes) })
  return resultado.value
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
    } else if (mime === 'application/pdf') {
      texto = await extraerTextoPdf(new Uint8Array(await file.arrayBuffer()))
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      texto = await extraerTextoDocx(await file.arrayBuffer())
    } else {
      // .doc binario antiguo, imágenes, etc.: sin librería viable sin
      // dependencias pesadas (OCR para imágenes, parser binario para
      // .doc) — se deja sin texto extraído, sin que eso bloquee la
      // subida del documento.
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
    // Si la extracción falla (PDF corrupto, escaneado como imagen sin
    // capa de texto, etc.) no debe tumbar la subida del documento, que ya
    // ocurrió antes de invocar esto — queda sin texto_extraido, igual que
    // un tipo de archivo sin extracción implementada.
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
