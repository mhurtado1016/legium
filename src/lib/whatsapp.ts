import { supabase } from './supabase'

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

// Envío genérico de WhatsApp, para usar desde cualquier acción de la
// app (citas, plazos, casos, ...) — ver supabase/functions/enviar-whatsapp
// y supabase/functions/_shared/whatsapp.ts para el detalle del envío.
//
// Texto libre: solo entrega dentro de la ventana de 24h desde el
// último mensaje del cliente. Fuera de esa ventana hay que usar
// `enviarWhatsAppPlantilla` con una plantilla pre-aprobada en Meta.
export async function enviarWhatsApp(telefono: string, mensaje: string) {
  const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
    body: { telefono, mensaje },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { ok: boolean; id?: string }
}

export async function enviarWhatsAppPlantilla(
  telefono: string,
  plantilla: { nombre: string; idioma?: string; parametros?: string[] },
) {
  const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
    body: { telefono, plantilla },
  })
  if (error) throw new Error(await mensajeErrorFuncion(error))
  return data as { ok: boolean; id?: string }
}
