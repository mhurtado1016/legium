import type { ReactNode } from 'react'

// Vista de tarjetas para reemplazar <table> en mobile (< md): las listas
// de datos (casos, clientes, usuarios, etc.) usan <table className=
// "table-modern"> a partir de md, y este mismo set de datos se recorre
// una segunda vez acá para el layout de tarjetas apiladas por debajo de
// md — así nunca aparece scroll horizontal en pantallas angostas.

export function CardList({ children }: { children: ReactNode }) {
  return <div className="md:hidden space-y-3">{children}</div>
}

export function DataCard({
  children,
  className,
  urgente,
}: {
  children: ReactNode
  className?: string
  urgente?: boolean
}) {
  return (
    <div className={`card p-4 space-y-2.5 ${urgente ? 'bg-[var(--color-danger-soft)]/40' : ''} ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div className="flex items-start justify-between gap-3">{children}</div>
}

export function CardRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate shrink-0">{label}</span>
      <span className="text-right text-ink">{children}</span>
    </div>
  )
}

export function CardActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end flex-wrap gap-3 text-xs pt-1 border-t border-line">{children}</div>
}

export function CardEmpty({ children }: { children: ReactNode }) {
  return <p className="md:hidden text-sm text-slate text-center py-6">{children}</p>
}
