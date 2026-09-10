// Edge Function: generar-documento-plantilla
// Ver especificación técnica, sección 8.3 y 8.4.
//
// Resuelve las variables automáticas de una plantilla contra los datos
// del caso/cliente, combina con las variables manuales recibidas del
// formulario, y genera el .docx final con docxtemplater + pizzip.
// El resultado se guarda como un nuevo `documento`/`documento_version`
// vinculado al caso (reutilizando el Módulo 4).

import { createClient } from 'npm:@supabase/supabase-js@2'
import PizZip from 'npm:pizzip@3'
import Docxtemplater from 'npm:docxtemplater@3'

interface VariableDef {
  clave: string
  fuente?: string // ej. "caso.cliente.nombre", "caso.numero_radicado", "fecha_actual"
  manual?: boolean
}

interface Body {
  plantilla_id: string
  caso_id: string
  variables_manuales: Record<string, string>
}

// Resuelve una ruta de puntos (ej. "caso.cliente.nombre") contra un objeto.
function resolverRuta(obj: Record<string, unknown>, ruta: string): string {
  const valor = ruta.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
  return valor != null ? String(valor) : ''
}

Deno.serve(async (req) => {
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
    const { plantilla_id, caso_id, variables_manuales }: Body = await req.json()

    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) throw new Error('No autenticado')
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('firma_id')
      .eq('id', userData.user.id)
      .single()
    if (!usuario) throw new Error('Usuario sin firma asociada')

    const { data: plantilla, error: plantillaError } = await admin
      .from('plantillas')
      .select('*')
      .eq('id', plantilla_id)
      .single()
    if (plantillaError || !plantilla) throw new Error('Plantilla no encontrada')

    const { data: caso, error: casoError } = await admin
      .from('casos')
      .select('*, clientes(*)')
      .eq('id', caso_id)
      .single()
    if (casoError || !caso) throw new Error('Caso no encontrado')

    // 1. Resolver variables automáticas + combinar con las manuales.
    const contexto = {
      caso,
      fecha_actual: new Date().toLocaleDateString('es-CO'),
    }
    const datos: Record<string, string> = {}
    for (const v of (plantilla.variables as VariableDef[]) ?? []) {
      if (v.manual) {
        datos[v.clave] = variables_manuales[v.clave] ?? '' // nullGetter: vacío si falta, sección 8.4
      } else if (v.fuente) {
        datos[v.clave] = resolverRuta(contexto, v.fuente)
      }
    }

    // 2. Descargar el .docx base y reemplazar variables (docxtemplater + pizzip).
    const { data: templateFile, error: downloadError } = await admin.storage
      .from('plantillas')
      .download(plantilla.storage_path)
    if (downloadError) throw downloadError

    const zip = new PizZip(await templateFile.arrayBuffer())
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '', // sección 8.4: marcador vacío en vez de fallar
    })
    doc.render(datos)
    const buffer = doc.getZip().generate({ type: 'uint8array' })

    // 3. Guardar como nuevo documento/versión del caso (Módulo 4).
    const nombreArchivo = `${plantilla.nombre}.docx`
    const { data: documento, error: docError } = await admin
      .from('documentos')
      .insert({
        firma_id: usuario.firma_id,
        caso_id,
        categoria_id: plantilla.categoria_id,
        nombre: nombreArchivo,
        creado_por: userData.user.id,
      })
      .select()
      .single()
    if (docError) throw docError

    const storagePath = `${usuario.firma_id}/${caso_id}/${documento.id}/1-${nombreArchivo}`
    const { error: uploadError } = await admin.storage.from('documentos').upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    if (uploadError) throw uploadError

    const { error: versionError } = await admin.from('documento_versiones').insert({
      firma_id: usuario.firma_id,
      documento_id: documento.id,
      version_numero: 1,
      storage_path: storagePath,
      nombre_archivo: nombreArchivo,
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      tamano_bytes: buffer.byteLength,
      subido_por: userData.user.id,
    })
    if (versionError) throw versionError

    return new Response(JSON.stringify({ ok: true, documento_id: documento.id }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
