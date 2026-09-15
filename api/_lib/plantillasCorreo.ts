// Plantillas de correo (usadas por api/notificar-cita.ts). HTML con
// estilos inline y layout de tablas — no @import de fuentes ni CSS
// externo, porque la mayoría de clientes de correo (Gmail, Outlook)
// los ignora o los bloquea; todo lo que importa va inline.
//
// Reproduce los mismos tokens de marca que src/index.css: fondo
// --color-paper, tarjeta --color-paper-raised, texto --color-ink, el
// "eyebrow" en --color-seal (mismo patrón que SectionHeading en
// LandingPage.tsx) y el acento --color-seal-soft para el recuadro con
// la fecha/hora. Sin el logo como imagen: requeriría una URL absoluta
// a un dominio, y el wordmark en texto es igual de reconocible y no se
// puede romper.

const INK = '#161d27'
const PAPER = '#f7f6f3'
const PAPER_RAISED = '#ffffff'
const SEAL = '#7a2a2e'
const SEAL_SOFT = '#f3e6e6'
const SLATE = '#5b6472'
const LINE = '#e4e1d8'
const FONT = "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif"

// Los datos del cliente (nombre, correo, teléfono, notas) llegan del
// formulario público sin sanitizar — hay que escaparlos antes de
// meterlos en el HTML del correo, o cualquiera puede inyectar markup
// (o intentar algo peor) con solo escribirlo en el campo "Nombre".
function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function envolverCorreo(eyebrow: string, titulo: string, contenidoHtml: string) {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titulo}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAPER};font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:${PAPER_RAISED};border:1px solid ${LINE};border-radius:12px;">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid ${LINE};">
                <span style="font-size:20px;font-weight:700;letter-spacing:0.02em;color:${INK};">LEGIUM</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${SEAL};">
                  ${eyebrow}
                </p>
                <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${INK};font-family:${FONT};">
                  ${titulo}
                </h1>
                <div style="font-size:15px;line-height:1.6;color:${INK};">
                  ${contenidoHtml}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px 26px;border-top:1px solid ${LINE};">
                <p style="margin:0;font-size:12px;color:${SLATE};">
                  Legium — Claridad jurídica para decisiones que importan.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function recuadroDato(label: string, valor: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${SEAL_SOFT};border-radius:8px;margin:4px 0 20px;">
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${SEAL};">${label}</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:${INK};">${valor}</p>
      </td>
    </tr>
  </table>`
}

export function correoConfirmacionCliente(datos: { nombre: string; cuando: string; tipoTexto: string }) {
  const { nombre, cuando, tipoTexto } = datos
  const html = envolverCorreo(
    'Confirmación de cita',
    'Tu consulta quedó agendada',
    `<p style="margin:0 0 16px;">Hola ${escaparHtml(nombre)},</p>
     <p style="margin:0 0 4px;">Agendaste una consulta <strong>${tipoTexto}</strong> con nosotros:</p>
     ${recuadroDato('Fecha y hora', cuando)}
     <p style="margin:0;color:${SLATE};">Si necesitas reprogramarla, contáctanos respondiendo este correo.</p>`,
  )
  const text =
    `Hola ${nombre},\n\n` +
    `Tu consulta quedó agendada para el ${cuando} (${tipoTexto}).\n\n` +
    `Si necesitas reprogramarla, contáctanos respondiendo este correo.\n\n— Legium`
  return { html, text }
}

export function correoAvisoAdmin(datos: {
  nombreCliente: string
  cuando: string
  tipoTexto: string
  correoCliente: string
  telefono: string | null
  notas: string | null
}) {
  const { nombreCliente, cuando, tipoTexto, correoCliente, telefono, notas } = datos
  const html = envolverCorreo(
    'Nueva cita',
    'Se agendó una consulta desde el landing',
    `<p style="margin:0 0 4px;"><strong>${escaparHtml(nombreCliente)}</strong> agendó una consulta <strong>${tipoTexto}</strong>:</p>
     ${recuadroDato('Fecha y hora', cuando)}
     <p style="margin:0 0 6px;"><strong>Correo:</strong> ${escaparHtml(correoCliente)}</p>
     <p style="margin:0 0 6px;"><strong>Teléfono:</strong> ${telefono ? escaparHtml(telefono) : '—'}</p>
     ${notas ? `<p style="margin:0;"><strong>Notas:</strong> ${escaparHtml(notas)}</p>` : ''}`,
  )
  const text =
    `${nombreCliente} agendó una consulta ${tipoTexto} para el ${cuando}.\n\n` +
    `Correo: ${correoCliente}\n` +
    `Teléfono: ${telefono || '—'}\n` +
    (notas ? `Notas: ${notas}\n` : '')
  return { html, text }
}
