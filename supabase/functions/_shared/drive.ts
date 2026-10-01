// Cliente hacia los endpoints de Google Drive que corren en Vercel
// (api/drive/listar.ts, api/drive/ver.ts) — las credenciales de la
// cuenta de servicio de Google (GOOGLE_SERVICE_ACCOUNT_KEY) solo existen
// ahí, no en Supabase. Cualquier Edge Function que necesite leer
// archivos de Drive del caso (hoy: documentos-ia-chat, para el contexto
// de Mañecito) pasa por acá en vez de duplicar la autenticación con
// Google.
//
// Se autentica reenviando el JWT de sesión del usuario que hizo la
// petición original: ambos endpoints de Vercel solo verifican que sea
// una sesión válida de Supabase (no hay nada más fino que chequear del
// lado de Drive — la cuenta de servicio es una sola para toda la
// instancia), igual que hace el frontend al llamarlos directamente
// (ver src/lib/drive.ts).

const DRIVE_API_BASE = 'https://legium.vercel.app/api/drive'

export interface ArchivoDriveCaso {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
}

// Mismo estándar de nombre de carpeta que usa la UI (CasoDetailPage):
// "{radicado} - {título}". Si no hay carpeta encontrada (o Drive no está
// configurado para esta instancia), devuelve una lista vacía — nunca
// lanza, para que la falta de Drive no tumbe el resto del contexto de
// Mañecito.
export async function listarArchivosDriveCaso(
  radicado: string,
  titulo: string,
  tokenUsuario: string,
): Promise<ArchivoDriveCaso[]> {
  try {
    const params = new URLSearchParams({ radicado, titulo })
    const resp = await fetch(`${DRIVE_API_BASE}/listar?${params.toString()}`, {
      headers: { Authorization: `Bearer ${tokenUsuario}` },
    })
    const data = await resp.json()
    if (!resp.ok || !data.ok || !data.carpetaEncontrada) return []
    return (data.archivos ?? []) as ArchivoDriveCaso[]
  } catch {
    return []
  }
}

// Descarga el contenido crudo del archivo. Null si falla (archivo
// Google-nativo sin exportar, permisos, Drive caído, etc.) — igual que
// listarArchivosDriveCaso, nunca lanza.
export async function descargarArchivoDrive(fileId: string, tokenUsuario: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(`${DRIVE_API_BASE}/ver?fileId=${encodeURIComponent(fileId)}&token=${encodeURIComponent(tokenUsuario)}`)
    if (!resp.ok) return null
    return new Uint8Array(await resp.arrayBuffer())
  } catch {
    return null
  }
}
