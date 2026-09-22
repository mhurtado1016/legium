import { useEffect, useState, type CSSProperties } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, Clock, Loader2 } from 'lucide-react'
import { listarDisponibilidad, type Franja } from '../lib/agenda'
import 'react-day-picker/style.css'

const DIAS_VISIBLES_ADELANTE = 90

/**
 * Calendario de disponibilidad + lista de horarios del día elegido.
 * Compartido entre el landing público (agendar sin sesión) y la agenda
 * interna del equipo (reservar manualmente) — ambos calculan franjas
 * libres igual, vía `listarDisponibilidad` (sección "Ambos" del pedido).
 */
export function SelectorFranja({
  franjaSeleccionada,
  onSeleccionar,
}: {
  franjaSeleccionada: Franja | null
  onSeleccionar: (franja: Franja) => void
}) {
  const [mes, setMes] = useState(() => new Date())
  const [disponibilidad, setDisponibilidad] = useState<Map<string, Franja[]>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | undefined>(undefined)

  useEffect(() => {
    setCargando(true)
    setError(false)
    const inicioMes = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const finMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0)
    listarDisponibilidad(inicioMes, finMes)
      .then(setDisponibilidad)
      .catch(() => setError(true))
      .finally(() => setCargando(false))
  }, [mes])

  const hoy = new Date()
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const limite = new Date(inicioHoy)
  limite.setDate(limite.getDate() + DIAS_VISIBLES_ADELANTE)

  function claveFecha(dia: Date) {
    return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`
  }

  function tieneDisponibilidad(dia: Date) {
    return (disponibilidad.get(claveFecha(dia))?.length ?? 0) > 0
  }

  const franjasDelDia = diaSeleccionado ? disponibilidad.get(claveFecha(diaSeleccionado)) ?? [] : []
  const manana = franjasDelDia.filter((f) => Number(f.hora_inicio.slice(0, 2)) < 12)
  const tarde = franjasDelDia.filter((f) => Number(f.hora_inicio.slice(0, 2)) >= 12)

  return (
    <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-8">
      {cargando && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-card)] bg-ink/50 backdrop-blur-sm">
          <p className="text-sm text-paper-raised flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" strokeWidth={1.75} />
            Cargando disponibilidad…
          </p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <CalendarDays size={16} strokeWidth={1.75} className="text-accent" />
            Elige una fecha
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate">
            <span className="inline-block w-2 h-2 rounded-full bg-success-soft border border-success/40" />
            Con disponibilidad
          </div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
          <DayPicker
            mode="single"
            locale={es}
            className="rdp-selector"
            // Estilos inline en vez de las variables CSS del archivo
            // index.css: la hoja de estilos de react-day-picker no está
            // dentro de un @layer de Tailwind, así que siempre le gana a
            // cualquier override puesto en @layer components — inline es
            // lo único que gana la cascada de forma confiable.
            style={
              {
                '--rdp-accent-color': 'var(--color-ink)',
                '--rdp-accent-background-color': 'var(--color-accent-soft)',
              } as CSSProperties
            }
            month={mes}
            onMonthChange={setMes}
            selected={diaSeleccionado}
            onSelect={setDiaSeleccionado}
            startMonth={inicioHoy}
            endMonth={limite}
            disabled={[{ before: inicioHoy }, { after: limite }, (dia) => !tieneDisponibilidad(dia)]}
            modifiers={{ disponible: tieneDisponibilidad }}
            modifiersClassNames={{ disponible: 'rdp-disponible' }}
          />
        </div>

        {error && (
          <p className="text-sm text-danger mt-3">
            No se pudo cargar la disponibilidad. Intenta de nuevo más tarde.
          </p>
        )}
      </div>

      <div>
        {!diaSeleccionado ? (
          <div className="h-full min-h-[16rem] flex flex-col items-center justify-center text-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10">
            <CalendarDays size={26} strokeWidth={1.5} className="text-slate/50" />
            <p className="text-sm text-slate">Elige un día en el calendario para ver los horarios disponibles.</p>
          </div>
        ) : franjasDelDia.length === 0 ? (
          <div className="h-full min-h-[16rem] flex flex-col items-center justify-center text-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line px-6 py-10">
            <Clock size={26} strokeWidth={1.5} className="text-slate/50" />
            <p className="text-sm text-slate">No hay horarios disponibles ese día.</p>
          </div>
        ) : (
          <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
            <p className="text-sm font-medium text-ink mb-4">
              {capitalizarPrimeraLetra(
                diaSeleccionado.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
              )}
            </p>
            <GrupoFranjas titulo="Mañana" franjas={manana} activa={franjaSeleccionada} onSeleccionar={onSeleccionar} />
            <GrupoFranjas titulo="Tarde" franjas={tarde} activa={franjaSeleccionada} onSeleccionar={onSeleccionar} />
          </div>
        )}
      </div>
    </div>
  )
}

function GrupoFranjas({
  titulo,
  franjas,
  activa,
  onSeleccionar,
}: {
  titulo: string
  franjas: Franja[]
  activa: Franja | null
  onSeleccionar: (franja: Franja) => void
}) {
  if (franjas.length === 0) return null
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs uppercase tracking-wide text-slate mb-2">{titulo}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {franjas.map((f) => {
          const seleccionada = activa?.fecha === f.fecha && activa?.hora_inicio === f.hora_inicio
          return (
            <button
              key={f.hora_inicio}
              type="button"
              onClick={() => onSeleccionar(f)}
              className={
                'flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ' +
                (seleccionada
                  ? 'bg-ink text-paper-raised border-ink'
                  : 'bg-paper-raised text-ink border-line hover:border-ink/40 hover:bg-paper')
              }
            >
              <Clock size={13} strokeWidth={1.75} className={seleccionada ? 'text-paper-raised/80' : 'text-slate'} />
              {formatoHora12(f.hora_inicio)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function capitalizarPrimeraLetra(texto: string) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function formatoHora12(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  const periodo = h < 12 ? 'a. m.' : 'p. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${periodo}`
}
