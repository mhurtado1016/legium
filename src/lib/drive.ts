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

// Sube directo del navegador a Drive (protocolo resumable de la Drive
// API), sin pasar por nuestro backend: las funciones de Vercel rechazan
// cualquier request de más de 4.5 MB, insuficiente para escaneos
// grandes. A cambio, el navegador maneja por unos minutos un token de
// la cuenta de servicio con permiso de escritura — ver la nota de
// api/drive/token.ts para el trade-off aceptado.
export async function subirArchivoDrive(carpetaId: string, archivo: File): Promise<void> {
  const token = await tokenSesion()
  const tokenRes = await fetch('/api/drive/token', { headers: { Authorization: `Bearer ${token}` } })
  const tokenData = await tokenRes.json()
  if (!tokenRes.ok || !tokenData.ok) throw new Error(tokenData.error || 'No se pudo autorizar la subida a Google Drive')
  const accessToken = tokenData.accessToken as string

  const iniciarRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
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
