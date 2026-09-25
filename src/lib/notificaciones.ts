import { supabase } from './supabase'

export interface Notificacion {
  id: string
  titulo: string
  cuerpo: string | null
  enlace: string | null
  leido: boolean
  created_at: string
}

const LIMITE_LISTADO = 20

export async function listarNotificaciones() {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, titulo, cuerpo, enlace, leido, created_at')
    .order('created_at', { ascending: false })
    .limit(LIMITE_LISTADO)
  if (error) throw error
  return data as Notificacion[]
}

export async function contarNoLeidas() {
  const { count, error } = await supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('leido', false)
  if (error) throw error
  return count ?? 0
}

export async function marcarLeida(id: string) {
  const { error } = await supabase.from('notificaciones').update({ leido: true }).eq('id', id)
  if (error) throw error
}

export async function marcarTodasLeidas() {
  const { error } = await supabase.from('notificaciones').update({ leido: true }).eq('leido', false)
  if (error) throw error
}
