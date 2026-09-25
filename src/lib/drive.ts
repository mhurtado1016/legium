import { supabase } from './supabase'

export interface ArchivoDrive {
  id: string
  name: string
  mimeType: string
  webViewLink: string
  iconLink: string
  modifiedTime: string
}

export interface EstadoArchivosDrive {
  conectado: boolean
  carpetaEncontrada: boolean
  carpetaId?: string
  carpetaNombre?: string
  archivos: ArchivoDrive[]
}

async function tokenSesion() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('No autenticado')
  return session.access_token
}

export async function listarArchivosDrive(radicado: string): Promise<EstadoArchivosDrive> {
  const token = await tokenSesion()
  const res = await fetch(`/api/drive/listar?radicado=${encodeURIComponent(radicado)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo consultar Google Drive')
  return data as EstadoArchivosDrive
}

export async function estadoCuentaServicioDrive(): Promise<{ configurado: boolean; cuentaEmail: string | null }> {
  const token = await tokenSesion()
  const res = await fetch('/api/drive/estado', { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo consultar el estado de Google Drive')
  return data
}

// Token de corta duración de la cuenta de servicio — ver la nota de
// api/drive/token.ts para el trade-off aceptado (queda unos minutos en
// el navegador, con permiso de lectura+escritura sobre todo lo que la
// cuenta de servicio pueda tocar).
async function obtenerAccessTokenDrive(): Promise<string> {
  const token = await tokenSesion()
  const tokenRes = await fetch('/api/drive/token', { headers: { Authorization: `Bearer ${token}` } })
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.ok) throw new Error(tokenData.error || 'No se pudo autorizar el acceso a Google Drive')
  return tokenData.accessToken as string
}

// URL con el contenido real del archivo, para usar directo como src de
// un <iframe>/<img>. El link "de vista" normal de Drive
// (drive.google.com/file/d/.../preview) no sirve para esto: depende de
// que el navegador de quien mira esté logueado con una cuenta de
// Google que tenga acceso, y nuestros usuarios no tienen por qué tener
// una — el acceso real a la Unidad compartida lo tiene solo la cuenta
// de servicio. Por eso se pide el contenido directo (alt=media) con el
// access_token de la cuenta de servicio pegado en la URL.
export async function urlVerArchivoDrive(fileId: string): Promise<string> {
  const accessToken = await obtenerAccessTokenDrive()
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true&access_token=${encodeURIComponent(accessToken)}`
}

// Sube directo del navegador a Drive (protocolo resumable de la Drive
// API), sin pasar por nuestro backend: las funciones de Vercel rechazan
// cualquier request de más de 4.5 MB, insuficiente para escaneos
// grandes. A cambio, el navegador maneja por unos minutos un token de
// la cuenta de servicio con permiso de escritura — ver la nota de
// api/drive/token.ts para el trade-off aceptado.
export async function subirArchivoDrive(carpetaId: string, archivo: File): Promise<void> {
  const accessToken = await obtenerAccessTokenDrive()

  const iniciarRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': archivo.type || 'application/octet-stream',
    },
    body: JSON.stringify({ name: archivo.name, parents: [carpetaId] }),
  })
  if (!iniciarRes.ok) {
    const detalle = await iniciarRes.json().catch(() => null)
    throw new Error(detalle?.error?.message || 'No se pudo iniciar la subida a Google Drive')
  }
  const urlSesion = iniciarRes.headers.get('Location')
  if (!urlSesion) throw new Error('Google Drive no devolvió una sesión de subida')

  const subidaRes = await fetch(urlSesion, { method: 'PUT', body: archivo })
  if (!subidaRes.ok) {
    const detalle = await subidaRes.json().catch(() => null)
    throw new Error(detalle?.error?.message || 'No se pudo completar la subida a Google Drive')
  }
}

// A diferencia de subirArchivoDrive, esto pasa por el backend
// (api/drive/eliminar.ts) en vez de exponer un token al navegador: un
// DELETE no tiene el problema de tamaño que motivó la subida directa.
export async function eliminarArchivoDrive(fileId: string): Promise<void> {
  const token = await tokenSesion()
  const res = await fetch('/api/drive/eliminar', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo eliminar el archivo de Google Drive')
}
