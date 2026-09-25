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
