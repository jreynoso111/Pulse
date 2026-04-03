import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { usePulseWorkspace } from './context/PulseWorkspaceContext'

const AppLayout = lazy(() => import('./layout/AppLayout'))
const AutomationsPage = lazy(() => import('./pages/AutomationsPage'))
const BoardWorkspacePage = lazy(() => import('./pages/BoardWorkspacePage'))
const BoardsPage = lazy(() => import('./pages/BoardsPage'))
const DashboardDetailPage = lazy(() => import('./pages/DashboardDetailPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-500">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-soft">
        <p className="text-sm font-medium">Loading workspace...</p>
      </div>
    </div>
  )
}

function App() {
  const { authReady, isAuthenticated, settings, workspaceLoading } = usePulseWorkspace()
  const homePage = settings.homePage || 'dashboard'

  if (!authReady || (isAuthenticated && workspaceLoading)) {
    return <PageFallback />
  }

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={isAuthenticated ? <AppLayout /> : <Navigate to="/" replace />}>
          <Route index element={<Navigate to={homePage} replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard/:metricKey" element={<DashboardDetailPage />} />
          <Route path="boards" element={<BoardsPage />} />
          <Route path="boards/:boardSlug" element={<BoardWorkspacePage />} />
          <Route path="automations" element={<AutomationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to={isAuthenticated ? `/app/${homePage}` : '/'} replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
