import { useAuth } from '../lib/AuthContext'

/**
 * Placeholder de la pantalla "Dashboard + Buscador de sentencias
 * unificados" (sección 13.3). El buscador de sentencias y el panel de
 * actividad (Módulos 1-3) se implementan en fases posteriores; este
 * componente solo confirma que el login y el enrutamiento protegido
 * funcionan de punta a punta.
 */
export function DashboardPage() {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-paper text-ink px-6 py-4">
      <header className="flex items-center justify-between border-b border-line pb-4 mb-6">
        <h1 className="text-xl font-display">Legium</h1>
        <button
          onClick={() => signOut()}
          className="text-sm text-slate hover:text-ink underline underline-offset-4"
        >
          Cerrar sesión
        </button>
      </header>
      <p className="text-slate">
        Buscador de sentencias y panel de actividad — pendiente de implementar (Fase 1 en adelante).
      </p>
    </div>
  )
}
