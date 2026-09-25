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

export async function estadoConexionDrive(): Promise<{ conectado: boolean; cuentaEmail: string | null }> {
  const token = await tokenSesion()
  const res = await fetch('/api/drive/estado', { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json()
  if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo consultar el estado de Google Drive')
  return data
}

// Redirige el navegador al consentimiento de Google — no hace falta el
// client_secret para este paso (solo para el intercambio del code, que
// pasa server-side en api/drive/callback.ts), así que puede armarse acá
// con el client_id público (VITE_GOOGLE_CLIENT_ID).
export async function iniciarConexionDrive() {
  const token = await tokenSesion()
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID no configurada')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${window.location.origin}/api/drive/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.readonly')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  // El callback no recibe ningún header nuestro (lo llama Google, no
  // nuestro cliente), así que la identidad de quién conecta viaja acá:
  // Google devuelve `state` sin tocarlo en el callback.
  url.searchParams.set('state', token)
  window.location.href = url.toString()
}
