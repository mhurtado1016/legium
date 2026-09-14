import { supabase } from './supabase'

export interface ContactoLanding {
  nombre: string
  correo: string
  telefono?: string
  mensaje: string
}

// Envío del formulario de contacto del landing público (sección "ofertar
// servicios jurídicos"). No requiere sesión: la política RLS de
// `contactos_landing` permite insert a `anon` y `authenticated` por igual.
export async function enviarContactoLanding(contacto: ContactoLanding) {
  const { error } = await supabase.from('contactos_landing').insert({
    nombre: contacto.nombre,
    correo: contacto.correo,
    telefono: contacto.telefono || null,
    mensaje: contacto.mensaje,
  })
  if (error) throw error
}
