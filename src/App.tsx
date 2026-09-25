import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { useUsuario } from './lib/useUsuario'
import { LandingPage } from './pages/LandingPage'
import { PushNotificationGate } from './components/PushNotificationGate'

// Carga perezosa: el panel interno (casos, agenda, facturación, reportes,
// administración) no debe pesar en el bundle inicial del landing público
// en "/", que es lo que pagan en JS todos los visitantes anónimos.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const NuevaContrasenaPage = lazy(() =>
  import('./pages/NuevaContrasenaPage').then((m) => ({ default: m.NuevaContrasenaPage })),
)
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const CasosListPage = lazy(() => import('./pages/CasosListPage').then((m) => ({ default: m.CasosListPage })))
const CasoDetailPage = lazy(() => import('./pages/CasoDetailPage').then((m) => ({ default: m.CasoDetailPage })))
const ClientesListPage = lazy(() =>
  import('./pages/ClientesListPage').then((m) => ({ default: m.ClientesListPage })),
)
const PlazosPage = lazy(() => import('./pages/PlazosPage').then((m) => ({ default: m.PlazosPage })))
const AgendaPage = lazy(() => import('./pages/AgendaPage').then((m) => ({ default: m.AgendaPage })))
const CuentasCobroPage = lazy(() =>
  import('./pages/CuentasCobroPage').then((m) => ({ default: m.CuentasCobroPage })),
)
const ReportesPage = lazy(() => import('./pages/ReportesPage').then((m) => ({ default: m.ReportesPage })))
const AdministracionPage = lazy(() =>
  import('./pages/AdministracionPage').then((m) => ({ default: m.AdministracionPage })),
)

function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return null // evita parpadeo de redirección mientras se resuelve la sesión
  if (!session) return <Navigate to="/login" replace />
  return <PushNotificationGate>{children}</PushNotificationGate>
}

// Guardia inversa: si ya hay sesión activa, no tiene sentido mostrar el
// login — se redirige directo a la app interna.
function PublicOnlyRoute({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/app" replace />
  return children
}

// Mismo criterio de es_administrador que ya usan AgendaPage/AppHeader
// para mostrar secciones solo a administradores, aplicado a nivel de ruta.
function AdminOnlyRoute({ children }: { children: React.ReactElement }) {
  const { session, loading: loadingSesion } = useAuth()
  const { usuario, loading: loadingUsuario } = useUsuario()

  if (loadingSesion || loadingUsuario) return null
  if (!session) return <Navigate to="/login" replace />
  if (!usuario?.es_administrador) return <Navigate to="/app" replace />
  return <PushNotificationGate>{children}</PushNotificationGate>
}

function AppRoutes() {
  return (
    <Suspense fallback={null}>
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
        {/* Pública: se llega acá desde el enlace del correo de recuperación
            o de invitación (invitar-usuario), no desde la navegación normal. */}
        <Route path="/nueva-contrasena" element={<NuevaContrasenaPage />} />
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
          path="/app/clientes"
          element={
            <ProtectedRoute>
              <ClientesListPage />
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
        <Route
          path="/app/administracion"
          element={
            <AdminOnlyRoute>
              <AdministracionPage />
            </AdminOnlyRoute>
          }
        />
      </Routes>
    </Suspense>
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
