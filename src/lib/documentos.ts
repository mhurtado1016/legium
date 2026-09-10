import { supabase } from './supabase'

// Límites definidos para esta primera versión (sección 7.5, pendiente
// de revisar si el despacho necesita algo distinto).
export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024 // 20 MB
export const TIPOS_PERMITIDOS = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'image/jpeg',
  'image/png',
  'text/plain',
]

export interface CategoriaDocumento {
  id: string
  nombre: string
  es_predefinida: boolean
}

export interface Documento {
  id: string
  nombre: string
  descripcion: string | null
  categoria_id: string
  categorias_documento?: { nombre: string }
  ultima_version?: DocumentoVersion
}

export interface DocumentoVersion {
  id: string
  documento_id: string
  version_numero: number
  storage_path: string
  nombre_archivo: string
  mime_type: string | null
  tamano_bytes: number | null
  created_at: string
}

export async function listarCategorias() {
  const { data, error } = await supabase
    .from('categorias_documento')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data as CategoriaDocumento[]
}

export async function listarDocumentos(casoId: string) {
  const { data, error } = await supabase
    .from('documentos')
    .select('*, categorias_documento(nombre)')
    .eq('caso_id', casoId)
    .order('created_at', { ascending: false })
  if (error) throw error

  const documentos = data as Documento[]

  // Trae la última versión de cada documento (para mostrar en el listado).
  for (const doc of documentos) {
    const { data: versiones } = await supabase
      .from('documento_versiones')
      .select('*')
      .eq('documento_id', doc.id)
      .order('version_numero', { ascending: false })
      .limit(1)
    doc.ultima_version = versiones?.[0]
  }

  return documentos
}

export async function listarVersiones(documentoId: string) {
  const { data, error } = await supabase
    .from('documento_versiones')
    .select('*')
    .eq('documento_id', documentoId)
    .order('version_numero', { ascending: false })
  if (error) throw error
  return data as DocumentoVersion[]
}

// Sube un archivo como documento nuevo (si documentoId es null) o como
// nueva versión de uno existente. Ver sección 7.3.
export async function subirDocumento(params: {
  file: File
  firmaId: string
  casoId: string
  usuarioId: string
  categoriaId: string
  nombre: string
  documentoId?: string // si se provee, se sube como nueva versión
}) {
  const { file, firmaId, casoId, usuarioId, categoriaId, nombre, documentoId } = params

  if (file.size > TAMANO_MAXIMO_BYTES) {
    throw new Error('El archivo supera el límite de 20 MB.')
  }
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    throw new Error('Tipo de archivo no soportado.')
  }

  let docId = documentoId
  let siguienteVersion = 1

  if (!docId) {
    const { data: doc, error: docError } = await supabase
      .from('documentos')
      .insert({ firma_id: firmaId, caso_id: casoId, categoria_id: categoriaId, nombre, creado_por: usuarioId })
      .select()
      .single()
    if (docError) throw docError
    docId = doc.id
  } else {
    const { data: ultima } = await supabase
      .from('documento_versiones')
      .select('version_numero')
      .eq('documento_id', docId)
      .order('version_numero', { ascending: false })
      .limit(1)
      .maybeSingle()
    siguienteVersion = (ultima?.version_numero ?? 0) + 1
  }

  const storagePath = `${firmaId}/${casoId}/${docId}/${siguienteVersion}-${file.name}`

  const { error: uploadError } = await supabase.storage.from('documentos').upload(storagePath, file, {
    contentType: file.type,
  })
  if (uploadError) throw uploadError

  const { data: version, error: versionError } = await supabase
    .from('documento_versiones')
    .insert({
      firma_id: firmaId,
      documento_id: docId,
      version_numero: siguienteVersion,
      storage_path: storagePath,
      nombre_archivo: file.name,
      mime_type: file.type,
      tamano_bytes: file.size,
      subido_por: usuarioId,
    })
    .select()
    .single()
  if (versionError) throw versionError

  // Extracción de texto en segundo plano; no bloquea la subida si falla.
  supabase.functions
    .invoke('extraer-texto-documento', { body: { documento_version_id: version.id } })
    .catch(() => {})

  return docId
}

export async function urlDescarga(storagePath: string) {
  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(storagePath, 60 * 5) // 5 minutos
  if (error) throw error
  return data.signedUrl
}
