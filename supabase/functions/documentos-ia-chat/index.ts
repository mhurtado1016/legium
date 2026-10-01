// Edge Function: documentos-ia-chat
// Un turno del chat de redacción de documentos jurídicos con IA (módulo
// "Documentos IA"). Recibe el mensaje nuevo del usuario, arma el
// historial completo de la conversación y lo envía a Gemini junto con la
// especificación del tipo de documento elegido; si la IA entrega un
// borrador, se guarda en documentos_ia_conversaciones.contenido_generado.
//
// Los archivos de soporte no se reenvían como bytes en cada turno: se
// suben una sola vez a la Gemini File API y se referencian por URI
// (documentos_ia_archivos_soporte.gemini_file_uri) — reenviar el base64
// de cada PDF en cada mensaje de un chat de varios turnos sería lento y
// costoso. Solo se aceptan PDF, imagen y texto plano como soporte: son
// los tipos que Gemini puede "leer" de forma nativa — Word no se puede
// pasar así de forma fiable (para ese caso, el texto de los documentos
// ya cargados en el caso sí llega vía extraer-texto-documento, más abajo).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { descargarArchivoDrive, listarArchivosDriveCaso } from '../_shared/drive.ts'
import { extraerTexto, TIPOS_CON_EXTRACCION } from '../_shared/extraerTexto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Dos respaldos (no uno): en la práctica, un pico de demanda puede saturar
// más de una versión del modelo a la vez — se vio en producción que
// gemini-3.8-flash y gemini-3.6-flash devolvieron 503 juntos en el mismo
// momento, mientras que gemini-3.5-flash sí respondía. Son versiones
// fijas independientes (no alias "-latest", que en la práctica parece
// compartir la saturación de la versión más nueva).
const GEMINI_MODEL_PRINCIPAL = 'gemini-3.8-flash'
const GEMINI_MODEL_RESPALDO = 'gemini-3.6-flash'
const GEMINI_MODEL_RESPALDO_2 = 'gemini-3.5-flash'
const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_UPLOAD_URL = 'https://generativelanguage.googleapis.com/upload/v1beta/files'

interface Body {
  conversacion_id: string
  mensaje: string
  archivo_ids_nuevos?: string[]
}

interface RespuestaIA {
  respuesta_chat: string
  contenido_markdown: string | null
  datos_faltantes: string[]
}

function concatBytes(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of partes) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

// Sube un archivo (una sola vez) a la Gemini File API y devuelve su URI
// referenciable. Protocolo "multipart" simple (no el resumable de varios
// pasos): un único POST con metadata + bytes en multipart/related.
async function subirArchivoAGemini(
  bytes: Uint8Array,
  mimeType: string,
  apiKey: string,
): Promise<{ uri: string; expirationTime: string }> {
  const boundary = `legium_${crypto.randomUUID()}`
  const encoder = new TextEncoder()
  const body = concatBytes([
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"file":{}}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    bytes,
    encoder.encode(`\r\n--${boundary}--`),
  ])

  const resp = await fetch(`${GEMINI_UPLOAD_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'multipart',
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  })
  const data = await resp.json()
  if (!resp.ok || !data?.file?.uri) {
    throw new Error(`No se pudo subir el archivo a Gemini: ${data?.error?.message ?? resp.status}`)
  }
  return { uri: data.file.uri, expirationTime: data.file.expirationTime }
}

// Llama a Gemini con reintentos y espera creciente si responde 503/429
// (saturación temporal del modelo). Mismo patrón que generar-resumen-ia,
// adaptado a systemInstruction + contents de varios turnos.
async function llamarGemini(
  modelo: string,
  systemInstruction: string,
  contents: unknown[],
  intentos: number,
): Promise<{ resp: Response; ultimoError: string }> {
  const url = `${GEMINI_URL_BASE}/${modelo}:generateContent`
  let resp: Response | null = null
  let ultimoError = ''

  for (let intento = 1; intento <= intentos; intento++) {
    resp = await fetch(`${url}?key=${Deno.env.get('GEMINI_API_KEY')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })
    if (resp.ok) break

    const cuerpoError = await resp.clone().json().catch(() => null)
    const detalle = cuerpoError?.error?.message
    ultimoError = `Gemini (${modelo}) respondió ${resp.status}${detalle ? `: ${detalle}` : ''}`

    const esSaturacionTemporal = resp.status === 503 || resp.status === 429
    if (!esSaturacionTemporal || intento === intentos) break

    await new Promise((resolve) => setTimeout(resolve, 1500 * intento))
  }

  return { resp: resp!, ultimoError }
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
    const { conversacion_id, mensaje, archivo_ids_nuevos = [] }: Body = await req.json()
    if (!conversacion_id || !mensaje?.trim()) throw new Error('Falta conversacion_id o mensaje.')

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) throw new Error('No autenticado')

    const { data: quienEscribe, error: quienEscribeError } = await supabase
      .from('usuarios')
      .select('firma_id, es_administrador')
      .eq('id', userData.user.id)
      .single()
    if (quienEscribeError || !quienEscribe) throw new Error('No se pudo verificar el usuario.')
    if (!quienEscribe.es_administrador) throw new Error('Solo un administrador puede usar este asistente.')

    const { data: conversacion, error: conversacionError } = await admin
      .from('documentos_ia_conversaciones')
      .select('*, tipos_documento_legal(nombre, especificacion_md), casos(titulo, estado, numero_radicado, despacho_judicial, etapa_procesal, descripcion, clientes(nombre))')
      .eq('id', conversacion_id)
      .single()
    if (conversacionError || !conversacion) throw new Error('Conversación no encontrada.')
    if (conversacion.firma_id !== quienEscribe.firma_id) throw new Error('No autorizado.')

    // 1. Guardar el mensaje del usuario.
    const { error: insertMensajeError } = await admin.from('documentos_ia_mensajes').insert({
      firma_id: conversacion.firma_id,
      conversacion_id,
      rol: 'usuario',
      contenido: mensaje.trim(),
      creado_por: userData.user.id,
    })
    if (insertMensajeError) throw insertMensajeError

    // 2. Subir a la Gemini File API los archivos nuevos que aún no tengan
    // referencia (o cuya referencia ya expiró).
    const apiKey = Deno.env.get('GEMINI_API_KEY')!
    for (const archivoId of archivo_ids_nuevos) {
      const { data: archivo } = await admin
        .from('documentos_ia_archivos_soporte')
        .select('*')
        .eq('id', archivoId)
        .eq('conversacion_id', conversacion_id)
        .maybeSingle()
      if (!archivo) continue

      const vencida = !archivo.gemini_file_uri || (archivo.gemini_file_expira && new Date(archivo.gemini_file_expira) < new Date())
      if (!vencida) continue

      const { data: descarga, error: descargaError } = await admin.storage
        .from('documentos-ia')
        .download(archivo.storage_path)
      if (descargaError) continue

      const bytes = new Uint8Array(await descarga.arrayBuffer())
      const subido = await subirArchivoAGemini(bytes, archivo.mime_type || 'application/octet-stream', apiKey)
      await admin
        .from('documentos_ia_archivos_soporte')
        .update({ gemini_file_uri: subido.uri, gemini_file_expira: subido.expirationTime })
        .eq('id', archivoId)
    }

    // 3. Historial completo de la conversación (ya incluye el mensaje que
    // se acaba de insertar).
    const { data: mensajes, error: mensajesError } = await admin
      .from('documentos_ia_mensajes')
      .select('rol, contenido')
      .eq('conversacion_id', conversacion_id)
      .order('created_at', { ascending: true })
    if (mensajesError) throw mensajesError

    const { data: archivosSoporte } = await admin
      .from('documentos_ia_archivos_soporte')
      .select('gemini_file_uri, mime_type')
      .eq('conversacion_id', conversacion_id)
      .not('gemini_file_uri', 'is', null)

    const contents = mensajes.map((m, i) => {
      const esUltimo = i === mensajes.length - 1
      const parts: Record<string, unknown>[] = [{ text: m.contenido }]
      // Se referencian todos los archivos de soporte disponibles en el
      // turno actual (el fileData es solo una URI, no bytes, así que
      // repetirla en cada turno no tiene costo relevante).
      if (esUltimo && archivosSoporte) {
        for (const a of archivosSoporte) {
          parts.push({ fileData: { fileUri: a.gemini_file_uri, mimeType: a.mime_type || 'application/octet-stream' } })
        }
      }
      return { role: m.rol === 'usuario' ? 'user' : 'model', parts }
    })

    // 4. Instrucción del sistema: especificación del tipo + regla de no
    // inventar + contexto del caso vinculado, si lo hay (datos generales,
    // bitácora/pasos y documentación ya cargada en el caso).
    const caso = conversacion.casos
    let contextoCaso = ''
    if (caso) {
      contextoCaso = `\n\nContexto del caso vinculado (úsalo si es relevante, no lo contradigas):
- Título: ${caso.titulo}
- Cliente: ${caso.clientes?.nombre ?? '[DATO FALTANTE: cliente]'}
- Estado del caso: ${caso.estado}
- Número de radicado: ${caso.numero_radicado ?? '[DATO FALTANTE: número de radicado]'}
- Despacho judicial: ${caso.despacho_judicial ?? '[DATO FALTANTE: despacho judicial]'}
- Etapa procesal: ${caso.etapa_procesal ?? '[DATO FALTANTE: etapa procesal]'}
- Descripción: ${caso.descripcion ?? '—'}`

      // Bitácora (pasos dados en el caso), más reciente primero.
      const { data: actividad } = await admin
        .from('caso_actividad')
        .select('descripcion, created_at')
        .eq('caso_id', conversacion.caso_id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (actividad && actividad.length > 0) {
        contextoCaso += `\n\nBitácora del caso (pasos dados, más reciente primero):\n${actividad
          .map((a) => `- ${new Date(a.created_at).toLocaleDateString('es-CO')}: ${a.descripcion}`)
          .join('\n')}`
      }

      // Documentación ya cargada en el caso (módulo de Documentos). Solo se
      // incluye el texto de los archivos que ya tienen texto_extraido (ver
      // extraer-texto-documento); para los que no, se avisa que existen
      // pero no se puede leer su contenido, en vez de inventarlo.
      const { data: documentosCaso } = await admin
        .from('documentos')
        .select('id, nombre, descripcion, categorias_documento(nombre)')
        .eq('caso_id', conversacion.caso_id)
        .order('created_at', { ascending: false })
        .limit(8)
      if (documentosCaso && documentosCaso.length > 0) {
        const bloques: string[] = []
        for (const doc of documentosCaso) {
          const { data: version } = await admin
            .from('documento_versiones')
            .select('texto_extraido')
            .eq('documento_id', doc.id)
            .order('version_numero', { ascending: false })
            .limit(1)
            .maybeSingle()
          const encabezado = `- ${doc.nombre} (${doc.categorias_documento?.nombre ?? 'sin categoría'})${doc.descripcion ? `: ${doc.descripcion}` : ''}`
          bloques.push(
            version?.texto_extraido
              ? `${encabezado}\n  Contenido: """${version.texto_extraido.slice(0, 3000)}"""`
              : `${encabezado}\n  (sin texto extraído disponible todavía; no inventes su contenido)`,
          )
        }
        contextoCaso += `\n\nDocumentación del caso:\n${bloques.join('\n')}`
      }

      // Documentación en Google Drive del caso. Las credenciales de Drive
      // solo existen en Vercel (ver _shared/drive.ts); se cachea el texto
      // ya extraído por (caso_id, drive_file_id) en
      // documentos_ia_archivos_drive_cache para no volver a descargar y
      // procesar el mismo archivo en cada turno — modified_time detecta si
      // el archivo cambió en Drive y toca re-extraer.
      if (caso.numero_radicado) {
        const tokenUsuario = authHeader.replace(/^Bearer /i, '')
        const archivosDrive = await listarArchivosDriveCaso(caso.numero_radicado, caso.titulo, tokenUsuario)
        if (archivosDrive.length > 0) {
          const bloques: string[] = []
          for (const archivo of archivosDrive.slice(0, 8)) {
            const encabezado = `- ${archivo.name} (Google Drive)`
            const { data: cacheado } = await admin
              .from('documentos_ia_archivos_drive_cache')
              .select('texto_extraido, modified_time')
              .eq('caso_id', conversacion.caso_id)
              .eq('drive_file_id', archivo.id)
              .maybeSingle()

            let texto: string | null
            if (cacheado && cacheado.modified_time === archivo.modifiedTime) {
              texto = cacheado.texto_extraido
            } else if (!TIPOS_CON_EXTRACCION.includes(archivo.mimeType)) {
              texto = null
            } else {
              const bytes = await descargarArchivoDrive(archivo.id, tokenUsuario)
              texto = bytes ? await extraerTexto(bytes, archivo.mimeType) : null
              await admin.from('documentos_ia_archivos_drive_cache').upsert(
                {
                  firma_id: conversacion.firma_id,
                  caso_id: conversacion.caso_id,
                  drive_file_id: archivo.id,
                  nombre_archivo: archivo.name,
                  mime_type: archivo.mimeType,
                  modified_time: archivo.modifiedTime,
                  texto_extraido: texto,
                  actualizado_en: new Date().toISOString(),
                },
                { onConflict: 'caso_id,drive_file_id' },
              )
            }

            bloques.push(
              texto
                ? `${encabezado}\n  Contenido: """${texto.slice(0, 3000)}"""`
                : `${encabezado}\n  (sin texto extraído disponible; no inventes su contenido)`,
            )
          }
          contextoCaso += `\n\nDocumentación en Google Drive del caso:\n${bloques.join('\n')}`
        }
      }
    }

    const systemInstruction = `Te llamas "Mañecito": eres el asistente de redacción jurídica de Legium. Ayudas a un abogado administrador de una firma en Colombia a redactar o responder el siguiente tipo de documento: "${conversacion.tipos_documento_legal.nombre}".

Especificación de cómo debe quedar ese documento:
"""
${conversacion.tipos_documento_legal.especificacion_md}
"""

Reglas estrictas:
- No inventes hechos, nombres, fechas, números de radicado ni fundamentos jurídicos que no te haya dado el usuario o que no estén en los archivos adjuntos. Si falta un dato necesario para el documento, dilo en tu respuesta y, dentro del borrador, usa exactamente "[DATO FALTANTE: descripción del dato]" en el lugar correspondiente.
- Compórtate como un asistente conversacional: si es el primer mensaje o falta información clave para redactar bien, puedes preguntar antes de entregar el borrador completo, en vez de inventar el contenido.
- Cuando tengas suficiente información, entrega el borrador COMPLETO del documento en "contenido_markdown" (usa "# "/"## " para encabezados y "- " para viñetas).
- Si el usuario pide un ajuste sobre un borrador ya generado, responde con el documento COMPLETO actualizado en "contenido_markdown" (no solo el fragmento que cambió).
- Si tu respuesta es solo conversación (una pregunta, una aclaración) y no estás entregando ni actualizando el borrador, deja "contenido_markdown" en null.
- Responde ÚNICAMENTE con un objeto JSON con las claves: respuesta_chat (string, tu mensaje para el chat), contenido_markdown (string o null), datos_faltantes (arreglo de strings, puede ser vacío).${contextoCaso}`

    // 5. Llamar a Gemini, con dos modelos de respaldo si el principal está
    // saturado (ver nota junto a las constantes de modelo).
    let { resp: geminiResp, ultimoError } = await llamarGemini(GEMINI_MODEL_PRINCIPAL, systemInstruction, contents, 3)
    for (const modeloRespaldo of [GEMINI_MODEL_RESPALDO, GEMINI_MODEL_RESPALDO_2]) {
      if (geminiResp.ok || (geminiResp.status !== 503 && geminiResp.status !== 429)) break
      const resultado = await llamarGemini(modeloRespaldo, systemInstruction, contents, 2)
      geminiResp = resultado.resp
      ultimoError = resultado.ultimoError
    }
    if (!geminiResp.ok) {
      const saturado = geminiResp.status === 503 || geminiResp.status === 429
      throw new Error(
        saturado
          ? 'Mañecito está recibiendo mucha demanda en este momento. Intenta de nuevo en un par de minutos.'
          : ultimoError,
      )
    }

    const geminiData = await geminiResp.json()
    const jsonText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
    if (!jsonText) throw new Error('Respuesta de Gemini sin contenido')
    const resultado: RespuestaIA = JSON.parse(jsonText)

    // 6. Guardar el mensaje de la IA y, si trajo borrador, actualizar la conversación.
    const { data: mensajeAsistente, error: insertAsistenteError } = await admin
      .from('documentos_ia_mensajes')
      .insert({
        firma_id: conversacion.firma_id,
        conversacion_id,
        rol: 'asistente',
        contenido: resultado.respuesta_chat,
      })
      .select()
      .single()
    if (insertAsistenteError) throw insertAsistenteError

    if (resultado.contenido_markdown) {
      await admin
        .from('documentos_ia_conversaciones')
        .update({
          contenido_generado: resultado.contenido_markdown,
          datos_faltantes: resultado.datos_faltantes ?? [],
          estado: 'con_borrador',
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversacion_id)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        mensaje_asistente: mensajeAsistente,
        contenido_generado: resultado.contenido_markdown,
        datos_faltantes: resultado.datos_faltantes ?? [],
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
