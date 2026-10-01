// Extracción de texto de PDF/DOCX — módulo compartido.
//
// Usado por extraer-texto-documento (documentos del módulo de
// Documentos) y por documentos-ia-chat (documentos de Google Drive del
// caso, ver _shared/drive.ts): la misma lógica sirve para ambos, solo
// cambia de dónde vienen los bytes.
//
// PDF: unpdf — build de pdf.js empaquetado para entornos serverless/edge
// (sin canvas, sin workers, sin los cmaps/standard_fonts de varios MB que
// trae el paquete pdfjs-dist completo, que hacía fallar el deploy de la
// función con "413 request entity too large").
// DOCX: mammoth, que solo lee el formato .docx (XML) — el .doc binario
// antiguo (application/msword) no tiene extracción implementada.

import { extractText } from 'npm:unpdf@1'
import mammoth from 'npm:mammoth@1'

export const TIPOS_CON_EXTRACCION = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/plain',
  'application/json',
]

export async function extraerTexto(bytes: Uint8Array, mimeType: string): Promise<string | null> {
  const mime = mimeType || ''

  if (mime.startsWith('text/') || mime === 'application/json') {
    const texto = new TextDecoder().decode(bytes)
    return mime === 'text/html' ? texto.replace(/<[^>]+>/g, ' ') : texto
  }
  if (mime === 'application/pdf') {
    const { text } = await extractText(bytes, { mergePages: true })
    return text
  }
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const resultado = await mammoth.extractRawText({ buffer: bytes })
    return resultado.value
  }
  // .doc binario antiguo, imágenes, Google Docs/Sheets nativos, etc.: sin
  // librería viable sin dependencias pesadas (OCR, parser binario, export
  // de formatos nativos de Google) — null en vez de inventar el contenido.
  return null
}
