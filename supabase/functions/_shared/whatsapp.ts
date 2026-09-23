// Cliente genérico de WhatsApp Cloud API (Meta) — módulo compartido.
//
// No es una Edge Function por sí mismo: es el cliente que importa
// `enviar-whatsapp/index.ts` (y cualquier otra función que necesite
// mandar un WhatsApp) para no reimplementar la llamada a la Graph API
// en cada sitio. A diferencia del correo (ver notificar-cita.ts), la
// Cloud API de Meta es un POST https normal — no necesita el runtime
// Node.js de Vercel, funciona igual de bien en una Edge Function.
//
// Requiere los secretos (`supabase secrets set ...`):
//   WHATSAPP_TOKEN            token de acceso permanente del System User
//   WHATSAPP_PHONE_NUMBER_ID  id del número de teléfono de WhatsApp Business
//   WHATSAPP_API_VERSION      opcional, por defecto 'v21.0'
//
// Nota sobre mensajes de texto libre vs. plantilla: Meta solo permite
// texto libre (`enviarWhatsAppTexto`) dentro de la ventana de 24h desde
// el último mensaje del cliente ("customer service window"). Para
// iniciar una conversación fuera de esa ventana hay que usar una
// plantilla pre-aprobada en Meta Business Manager (`enviarWhatsAppPlantilla`).

const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
const WHATSAPP_API_VERSION = Deno.env.get('WHATSAPP_API_VERSION') || 'v21.0'

export interface ResultadoEnvioWhatsApp {
  ok: boolean
  id?: string
  error?: string
}

// Meta espera el número solo con dígitos (código de país incluido, sin
// '+', espacios ni guiones) — los datos en `clientes.telefono` y
// `configuracion_contacto.telefono` vienen con formato libre
// ("+57 300 000 0000"), así que se normaliza antes de cada envío.
function normalizarTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length < 8) throw new Error(`Número de WhatsApp inválido: "${telefono}"`)
  return digitos
}

async function postMensaje(payload: Record<string, unknown>): Promise<ResultadoEnvioWhatsApp> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    const msg = 'WhatsApp no configurado (faltan WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID)'
    console.error(msg)
    return { ok: false, error: msg }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
      },
    )
    const data = await res.json()
    if (!res.ok) {
      const error = data?.error?.message || `Graph API respondió ${res.status}`
      console.error('Error enviando WhatsApp:', error)
      return { ok: false, error }
    }
    return { ok: true, id: data?.messages?.[0]?.id }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('Error de red enviando WhatsApp:', error)
    return { ok: false, error }
  }
}

// Mensaje de texto libre — solo entrega dentro de la ventana de 24h de
// servicio al cliente (ver nota arriba).
export async function enviarWhatsAppTexto(telefono: string, mensaje: string): Promise<ResultadoEnvioWhatsApp> {
  try {
    return await postMensaje({
      to: normalizarTelefono(telefono),
      type: 'text',
      text: { preview_url: false, body: mensaje },
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// Mensaje de plantilla pre-aprobada — puede iniciar conversación fuera
// de la ventana de 24h. `parametros` llena las variables {{1}}, {{2}},
// ... del cuerpo de la plantilla, en orden.
export async function enviarWhatsAppPlantilla(
  telefono: string,
  nombrePlantilla: string,
  idioma = 'es',
  parametros: string[] = [],
): Promise<ResultadoEnvioWhatsApp> {
  try {
    return await postMensaje({
      to: normalizarTelefono(telefono),
      type: 'template',
      template: {
        name: nombrePlantilla,
        language: { code: idioma },
        ...(parametros.length > 0
          ? { components: [{ type: 'body', parameters: parametros.map((texto) => ({ type: 'text', text: texto })) }] }
          : {}),
      },
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
