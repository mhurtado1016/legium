import { supabase } from './supabase'

export interface UsuarioAdmin {
  id: string
  nombre: string | null
  email: string | null
  activo: boolean
  es_administrador: boolean
  created_at: string
}

// Mismo problema que en sentencias.ts: cuando una Edge Function responde
// con un código de error, el SDK da un mensaje genérico y el cuerpo real
// ({ error: "..." }) queda en `error.context`.
async function mensajeErrorFuncion(error: unknown): Promise<string> {
  const conContexto = error as { message?: string; context?: Response }
  if (conContexto?.context && typeof conContexto.context.json === 'function') {
    try {
      const cuerpo = await conContexto.context.clone().json()
      if (cuerpo?.error) return String(cuerpo.error)
    } catch {
      // sigue al mensaje genérico
    }
  }
  return conContexto?.message ?? 'Ocurrió un error inesperado.'
}

export async function listarUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, activo, es_administrador, created_at')
    .order('created_at')
  if (error) throw error
  return data as UsuarioAdmin[]
}

export async function invitarUsuario(nombre: string, email: string) {
  const { data, error } = await supabase.functions.invoke('invitar-usuario', {
    body: { nombre, email, redirect_to: `${window.location.origin}/nueva-contrasena` },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { ok: boolean }
}

export async function actualizarUsuario(id: string, cambios: { activo?: boolean; es_administrador?: boolean }) {
  const { error } = await supabase.from('usuarios').update(cambios).eq('id', id)
  if (error) throw error
}
