// Edge Function: exportar-documento-legal
// Convierte el borrador de una conversación de "Documentos IA"
// (documentos_ia_conversaciones.contenido_generado) a un archivo
// descargable en Word o PDF, y lo guarda en el bucket `documentos-ia`.
//
// No se parte de una plantilla .docx prearmada (como sí hace
// generar-documento-plantilla): el documento se construye en código con
// npm:docx, igual de válido en este runtime que npm:docxtemplater o
// npm:pdf-lib, que ya se usan en otras Edge Functions de este proyecto.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'npm:docx@9'
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  conversacion_id: string
  formato: 'docx' | 'pdf'
}

type Linea = { tipo: 'h1' | 'h2' | 'bullet' | 'parrafo'; texto: string }

// Interpretación mínima del borrador (no es un parser de markdown
// completo): "# "/"## " como encabezados, "- "/"* " como viñeta, el resto
// como párrafo. Suficiente para la estructura de un escrito jurídico.
function interpretarContenido(contenido: string): Linea[] {
  return contenido
    .split('\n')
    .map((linea) => linea.trimEnd())
    .filter((linea) => linea.trim().length > 0)
    .map((linea) => {
      const t = linea.trim()
      if (t.startsWith('## ')) return { tipo: 'h2' as const, texto: t.slice(3) }
      if (t.startsWith('# ')) return { tipo: 'h1' as const, texto: t.slice(2) }
      if (t.startsWith('- ') || t.startsWith('* ')) return { tipo: 'bullet' as const, texto: t.slice(2) }
      return { tipo: 'parrafo' as const, texto: t }
    })
}

async function generarDocx(lineas: Linea[], titulo: string): Promise<Uint8Array> {
  const parrafos = [
    new Paragraph({ text: titulo, heading: HeadingLevel.TITLE }),
    ...lineas.map((l) => {
      if (l.tipo === 'h1') return new Paragraph({ text: l.texto, heading: HeadingLevel.HEADING_1 })
      if (l.tipo === 'h2') return new Paragraph({ text: l.texto, heading: HeadingLevel.HEADING_2 })
      if (l.tipo === 'bullet') return new Paragraph({ text: l.texto, bullet: { level: 0 } })
      return new Paragraph({ children: [new TextRun(l.texto)], alignment: AlignmentType.JUSTIFIED })
    }),
  ]
  const doc = new Document({ sections: [{ children: parrafos }] })
  return await Packer.toBuffer(doc)
}

// pdf-lib no hace ajuste de línea automático: hay que medir el ancho del
// texto con la fuente y partir por palabras (a diferencia de
// generar-cuenta-cobro, que solo dibuja líneas fijas de una página).
function envolverTexto(texto: string, font: import('npm:pdf-lib@1').PDFFont, size: number, anchoMax: number): string[] {
  const palabras = texto.split(' ')
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra
    if (font.widthOfTextAtSize(candidata, size) > anchoMax && actual) {
      lineas.push(actual)
      actual = palabra
    } else {
      actual = candidata
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

async function generarPdf(lineas: Linea[], titulo: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const margenX = 60
  const anchoUtil = 595 - margenX * 2
  const margenInferior = 50

  let page = pdfDoc.addPage([595, 842]) // A4
  let y = 780

  function nuevaPaginaSiNecesario(alturaNecesaria: number) {
    if (y - alturaNecesaria < margenInferior) {
      page = pdfDoc.addPage([595, 842])
      y = 780
    }
  }

  function dibujarParrafo(texto: string, size: number, fuente: typeof font, extraEspacioAntes = 0) {
    const lineasEnvueltas = envolverTexto(texto, fuente, size, anchoUtil)
    nuevaPaginaSiNecesario(extraEspacioAntes + lineasEnvueltas.length * (size + 4))
    y -= extraEspacioAntes
    for (const l of lineasEnvueltas) {
      page.drawText(l, { x: margenX, y, size, font: fuente, color: rgb(0.1, 0.1, 0.1) })
      y -= size + 4
    }
  }

  dibujarParrafo(titulo, 15, fontBold)
  y -= 10

  for (const linea of lineas) {
    if (linea.tipo === 'h1') dibujarParrafo(linea.texto, 13, fontBold, 12)
    else if (linea.tipo === 'h2') dibujarParrafo(linea.texto, 12, fontBold, 8)
    else if (linea.tipo === 'bullet') dibujarParrafo(`•  ${linea.texto}`, 11, font, 2)
    else dibujarParrafo(linea.texto, 11, font, 6)
  }

  return await pdfDoc.save()
}

function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'documento'
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
    const { conversacion_id, formato }: Body = await req.json()
    if (!conversacion_id || (formato !== 'docx' && formato !== 'pdf')) {
      throw new Error('Falta conversacion_id o el formato no es válido.')
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) throw new Error('No autenticado')

    const { data: quienExporta, error: quienExportaError } = await supabase
      .from('usuarios')
      .select('firma_id, es_administrador')
      .eq('id', userData.user.id)
      .single()
    if (quienExportaError || !quienExporta) throw new Error('No se pudo verificar el usuario.')
    if (!quienExporta.es_administrador) throw new Error('Solo un administrador puede exportar este documento.')

    const { data: conversacion, error: conversacionError } = await admin
      .from('documentos_ia_conversaciones')
      .select('*')
      .eq('id', conversacion_id)
      .single()
    if (conversacionError || !conversacion) throw new Error('Conversación no encontrada.')
    if (conversacion.firma_id !== quienExporta.firma_id) throw new Error('No autorizado.')
    if (!conversacion.contenido_generado) throw new Error('Esta conversación todavía no tiene un borrador generado.')

    const lineas = interpretarContenido(conversacion.contenido_generado)
    const nombreBase = slug(conversacion.titulo)

    let bytes: Uint8Array
    let mimeType: string
    let nombreArchivo: string
    if (formato === 'docx') {
      bytes = await generarDocx(lineas, conversacion.titulo)
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      nombreArchivo = `${nombreBase}.docx`
    } else {
      bytes = await generarPdf(lineas, conversacion.titulo)
      mimeType = 'application/pdf'
      nombreArchivo = `${nombreBase}.pdf`
    }

    const archivoId = crypto.randomUUID()
    const storagePath = `${conversacion.firma_id}/${conversacion_id}/generado/${archivoId}-${nombreArchivo}`

    const { error: uploadError } = await admin.storage.from('documentos-ia').upload(storagePath, bytes, {
      contentType: mimeType,
    })
    if (uploadError) throw uploadError

    const { data: archivoGenerado, error: insertError } = await admin
      .from('documentos_ia_archivos_generados')
      .insert({
        id: archivoId,
        firma_id: conversacion.firma_id,
        conversacion_id,
        formato,
        storage_path: storagePath,
        nombre_archivo: nombreArchivo,
        mime_type: mimeType,
        tamano_bytes: bytes.byteLength,
        generado_por: userData.user.id,
      })
      .select()
      .single()
    if (insertError) throw insertError

    return new Response(JSON.stringify({ ok: true, archivo: archivoGenerado }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
