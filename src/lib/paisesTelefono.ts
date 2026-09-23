// Indicativos telefónicos por país, para el selector de `TelefonoInput`.
// Colombia primero (firma local, la mayoría de clientes/usuarios son de
// acá); el resto en orden alfabético por nombre.
export interface PaisTelefono {
  nombre: string
  indicativo: string
}

export const PAISES_TELEFONO: PaisTelefono[] = [
  { nombre: 'Colombia', indicativo: '+57' },
  { nombre: 'Alemania', indicativo: '+49' },
  { nombre: 'Argentina', indicativo: '+54' },
  { nombre: 'Bolivia', indicativo: '+591' },
  { nombre: 'Brasil', indicativo: '+55' },
  { nombre: 'Canadá', indicativo: '+1' },
  { nombre: 'Chile', indicativo: '+56' },
  { nombre: 'China', indicativo: '+86' },
  { nombre: 'Costa Rica', indicativo: '+506' },
  { nombre: 'Cuba', indicativo: '+53' },
  { nombre: 'Ecuador', indicativo: '+593' },
  { nombre: 'El Salvador', indicativo: '+503' },
  { nombre: 'España', indicativo: '+34' },
  { nombre: 'Estados Unidos', indicativo: '+1' },
  { nombre: 'Francia', indicativo: '+33' },
  { nombre: 'Guatemala', indicativo: '+502' },
  { nombre: 'Honduras', indicativo: '+504' },
  { nombre: 'India', indicativo: '+91' },
  { nombre: 'Italia', indicativo: '+39' },
  { nombre: 'Japón', indicativo: '+81' },
  { nombre: 'México', indicativo: '+52' },
  { nombre: 'Nicaragua', indicativo: '+505' },
  { nombre: 'Panamá', indicativo: '+507' },
  { nombre: 'Paraguay', indicativo: '+595' },
  { nombre: 'Perú', indicativo: '+51' },
  { nombre: 'Portugal', indicativo: '+351' },
  { nombre: 'Reino Unido', indicativo: '+44' },
  { nombre: 'República Dominicana', indicativo: '+1' },
  { nombre: 'Uruguay', indicativo: '+598' },
  { nombre: 'Venezuela', indicativo: '+58' },
]

export const INDICATIVO_DEFECTO = '+57'

// Separa un teléfono guardado ("+57 300 123 4567", "573001234567", o
// incluso sin indicativo por datos viejos) en indicativo + número local,
// para precargar `TelefonoInput` al editar. Ordena por longitud de
// indicativo descendente para no confundir "+1" con el prefijo de otro
// país que también empiece por 1.
export function separarTelefono(telefono: string | null | undefined): { indicativo: string; numero: string } {
  const limpio = (telefono ?? '').trim()
  if (!limpio) return { indicativo: INDICATIVO_DEFECTO, numero: '' }

  const conMas = limpio.startsWith('+') ? limpio : `+${limpio}`
  const candidatos = [...PAISES_TELEFONO].sort((a, b) => b.indicativo.length - a.indicativo.length)
  const encontrado = candidatos.find((p) => conMas.replace(/\s+/g, '').startsWith(p.indicativo))

  if (!encontrado) return { indicativo: INDICATIVO_DEFECTO, numero: limpio.replace(/\D/g, '') }

  const resto = conMas.replace(/\s+/g, '').slice(encontrado.indicativo.length)
  return { indicativo: encontrado.indicativo, numero: resto.replace(/\D/g, '') }
}

export function combinarTelefono(indicativo: string, numero: string): string {
  const numeroLimpio = numero.trim()
  return numeroLimpio ? `${indicativo} ${numeroLimpio}` : ''
}
