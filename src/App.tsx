import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SentenciaDetailPage } from './pages/SentenciaDetailPage'
import { CasosListPage } from './pages/CasosListPage'
import { CasoDetailPage } from './pages/CasoDetailPage'
import { PlazosPage } from './pages/PlazosPage'
import { CuentasCobroPage } from './pages/CuentasCobroPage'
import { ReportesPage } from './pages/ReportesPage'

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return null // evita parpadeo de redirección mientras se resuelve la sesión
  if (!session) return <Navigate to="/login" replace />
  return children
}

// Guardia inversa: si ya hay sesión activa, no tiene sentido mostrar el
// login — se redirige directo al dashboard.
function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sentencias/:id"
        element={
          <ProtectedRoute>
            <SentenciaDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/casos"
        element={
          <ProtectedRoute>
            <CasosListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/casos/:id"
        element={
          <ProtectedRoute>
            <CasoDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plazos"
        element={
          <ProtectedRoute>
            <PlazosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturacion"
        element={
          <ProtectedRoute>
            <CuentasCobroPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes"
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
