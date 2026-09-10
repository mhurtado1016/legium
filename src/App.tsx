import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CasosListPage } from './pages/CasosListPage'
import { CasoDetailPage } from './pages/CasoDetailPage'
import { PlazosPage } from './pages/PlazosPage'

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return null // evita parpadeo de redirección mientras se resuelve la sesión
  if (!session) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
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
