import { PAISES_TELEFONO, combinarTelefono, separarTelefono } from '../lib/paisesTelefono'

// Campo de teléfono compuesto: selector de país (indicativo +N) + número
// local, para que el usuario no tenga que escribir el indicativo a mano
// (fuente de números de WhatsApp mal formados). `value`/`onChange`
// trabajan sobre el mismo string combinado ("+57 3001234567") que ya
// guardan `usuarios.telefono_whatsapp` y `clientes.telefono`.
export function TelefonoInput({
  value,
  onChange,
  placeholder = '300 123 4567',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const { indicativo, numero } = separarTelefono(value)

  return (
    <div className="flex gap-2">
      <select
        value={indicativo}
        onChange={(e) => onChange(combinarTelefono(e.target.value, numero))}
        className="field field-sm w-[9.5rem] shrink-0"
        aria-label="País"
      >
        {PAISES_TELEFONO.map((p) => (
          <option key={p.nombre} value={p.indicativo}>
            {p.indicativo} {p.nombre}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="numeric"
        value={numero}
        onChange={(e) => onChange(combinarTelefono(indicativo, e.target.value))}
        placeholder={placeholder}
        className="field field-sm flex-1 min-w-0"
      />
    </div>
  )
}
