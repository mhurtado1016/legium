const ESTILOS: Record<string, string> = {
  // Casos
  abierto: 'badge-accent',
  en_curso: 'badge-accent',
  suspendido: 'badge-neutral',
  cerrado: 'badge-success',
  // Plazos
  pendiente: 'badge-accent',
  vencido: 'badge-danger',
  cumplido: 'badge-success',
  // Cuentas de cobro
  pagada: 'badge-success',
  vencida: 'badge-danger',
  anulada: 'badge-neutral',
  // Citas
  confirmada: 'badge-success',
  cancelada: 'badge-neutral',
  // Usuarios
  activo: 'badge-success',
  inactivo: 'badge-neutral',
  administrador: 'badge-accent',
  miembro: 'badge-neutral',
}

const ETIQUETAS: Record<string, string> = {
  abierto: 'Abierto',
  en_curso: 'En curso',
  suspendido: 'Suspendido',
  cerrado: 'Cerrado',
  pendiente: 'Pendiente',
  vencido: 'Vencido',
  cumplido: 'Cumplido',
  pagada: 'Pagada',
  vencida: 'Vencida',
  anulada: 'Anulada',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  activo: 'Activo',
  inactivo: 'Inactivo',
  administrador: 'Administrador',
  miembro: 'Miembro',
}

/**
 * Insignia de estado reutilizada en las tablas de casos, plazos y
 * cuentas de cobro — antes cada estado se mostraba como texto plano,
 * sin distinción visual entre "vencido" y "cerrado", por ejemplo.
 */
export function StatusBadge({ estado }: { estado: string }) {
  return <span className={ESTILOS[estado] ?? 'badge-neutral'}>{ETIQUETAS[estado] ?? estado}</span>
}
