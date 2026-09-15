import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { SelectorFranja } from './SelectorFranja'
import type { Franja, TipoSesion } from '../lib/agenda'

/**
 * Sección "Agenda tu consulta" del landing público — reemplaza el CTA
 * genérico que antes solo llevaba al formulario de contacto por un
 * flujo real de reserva: elegir día/hora disponible, tipo de sesión
 * (presencial o virtual) y los datos de contacto.
 */
export function AgendarConsultaPublico() {
  const [franja, setFranja] = useState<Franja | null>(null)
  const [tipoSesion, setTipoSesion] = useState<TipoSesion>('presencial')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [notas, setNotas] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reservada, setReservada] = useState<Franja | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!franja) return
    setError(null)
    setEnviando(true)
    try {
      // Import dinámico: igual que en el formulario de contacto, el
      // resto del landing no depende de Supabase para renderizar.
      const { reservarCita } = await import('../lib/agenda')
      await reservarCita({
        fecha: franja.fecha,
        hora_inicio: franja.hora_inicio,
        hora_fin: franja.hora_fin,
        tipo_sesion: tipoSesion,
        nombre_cliente: nombre,
        correo_cliente: correo,
        telefono_cliente: telefono || undefined,
        notas: notas || undefined,
      })
      setReservada(franja)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agendar la consulta. Intenta de nuevo.')
      setFranja(null)
    } finally {
      setEnviando(false)
    }
  }

  if (reservada) {
    return (
      <div className="card p-8 flex items-start gap-3">
        <CheckCircle2 size={22} className="text-seal shrink-0 mt-0.5" strokeWidth={1.75} />
        <div>
          <p className="font-medium text-ink">Consulta agendada</p>
          <p className="text-sm text-slate mt-1">
            Quedó reservada para el{' '}
            {new Date(`${reservada.fecha}T${reservada.hora_inicio}`).toLocaleDateString('es-CO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            a las {formatoHora12(reservada.hora_inicio)}. Te confirmaremos por correo a {correo}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <SelectorFranja franjaSeleccionada={franja} onSeleccionar={setFranja} />

      {franja && (
        <div className="card p-8 space-y-4">
          <div>
            <span className="block text-sm text-slate mb-2">Tipo de sesión</span>
            <div className="flex gap-3">
              {(['presencial', 'virtual'] as TipoSesion[]).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setTipoSesion(tipo)}
                  className={'btn-sm ' + (tipoSesion === tipo ? 'btn-primary' : 'btn-secondary')}
                >
                  {tipo === 'presencial' ? 'Presencial' : 'Virtual'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm text-slate mb-1">Nombre</span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                className="w-full field"
              />
            </label>
            <label className="block">
              <span className="block text-sm text-slate mb-1">Correo</span>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                className="w-full field"
              />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm text-slate mb-1">Teléfono (opcional)</span>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full field"
            />
          </label>

          <label className="block">
            <span className="block text-sm text-slate mb-1">¿Sobre qué necesitas la consulta? (opcional)</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              className="w-full field"
            />
          </label>

          {error && <p className="text-sm text-seal">{error}</p>}

          <button type="submit" disabled={enviando} className="btn-primary">
            {enviando ? (
              <>
                <Loader2 size={16} className="animate-spin" strokeWidth={1.75} />
                Agendando…
              </>
            ) : (
              'Confirmar cita'
            )}
          </button>
        </div>
      )}
    </form>
  )
}

function formatoHora12(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  const periodo = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${periodo}`
}
