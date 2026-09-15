import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CasosListPage } from './pages/CasosListPage'
import { CasoDetailPage } from './pages/CasoDetailPage'
import { PlazosPage } from './pages/PlazosPage'
import { AgendaPage } from './pages/AgendaPage'
import { CuentasCobroPage } from './pages/CuentasCobroPage'
import { ReportesPage } from './pages/ReportesPage'

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return null // evita parpadeo de redirección mientras se resuelve la sesión
  if (!session) return <Navigate to="/login" replace />
  return children
}

// Guardia inversa: si ya hay sesión activa, no tiene sentido mostrar el
// login — se redirige directo a la app interna.
function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/app" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing público: lo primero que ve cualquier visitante del
          dominio (sección "ofertar servicios jurídicos"). La app interna
          de gestión de casos vive bajo /app y requiere sesión. */}
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/casos"
        element={
          <ProtectedRoute>
            <CasosListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/casos/:id"
        element={
          <ProtectedRoute>
            <CasoDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/plazos"
        element={
          <ProtectedRoute>
            <PlazosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/agenda"
        element={
          <ProtectedRoute>
            <AgendaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/facturacion"
        element={
          <ProtectedRoute>
            <CuentasCobroPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/reportes"
        element={
          <ProtectedRoute>
            <ReportesPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
