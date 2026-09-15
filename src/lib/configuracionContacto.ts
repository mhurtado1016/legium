import { supabase } from './supabase'

export interface ConfiguracionContacto {
  correo: string
  telefono: string
  ciudad: string
}

export async function obtenerConfiguracionContacto(): Promise<ConfiguracionContacto> {
  const { data, error } = await supabase
    .from('configuracion_contacto')
    .select('correo, telefono, ciudad')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data as ConfiguracionContacto
}

export async function actualizarConfiguracionContacto(cambios: Partial<ConfiguracionContacto>) {
  const { error } = await supabase.from('configuracion_contacto').update(cambios).eq('id', 1)
  if (error) throw error
}
