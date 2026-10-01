// Placeholders de carga reutilizables: evitan que las pantallas muestren
// "0" / listas vacías / "Sin datos" por un instante antes de que lleguen
// los datos reales (ver CasosListPage, DashboardPage, etc. — todas
// cargan con Promise.all o useEffect y antes no tenían ningún estado de
// carga, así que el primer render siempre mostraba el estado vacío).
// aria-hidden porque son puramente decorativos; el contenido real que
// reemplazan ya tiene su propio texto accesible.

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[var(--radius-field)] bg-paper-sunken ${className}`} />
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4" aria-hidden="true">
          <Skeleton className="h-4 w-4 rounded-full mb-2.5" />
          <Skeleton className="h-7 w-10 mb-2" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </>
  )
}

export function SkeletonTableRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j}>
              <Skeleton className="h-4 w-full max-w-[9rem]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function SkeletonCards({ count = 3, rows = 3 }: { count?: number; rows?: number }) {
  return (
    <div className="md:hidden space-y-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-4 w-16" />
          </div>
          {Array.from({ length: rows }).map((_, j) => (
            <div key={j} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonSideList({ count = 3 }: { count?: number }) {
  return (
    <ul className="text-sm divide-y divide-line -mx-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="px-4 py-2.5 space-y-1.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/4" />
        </li>
      ))}
    </ul>
  )
}
