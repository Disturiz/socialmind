import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Welcome }   from '../pages/Welcome'
import { Login }     from '../pages/Login'
import { Register }  from '../pages/Register'
import { Dashboard } from '../pages/Dashboard'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

export const router = createBrowserRouter([
  { path: '/',        element: <Welcome /> },
  { path: '/login',   element: <Login /> },
  { path: '/registro',element: <Register /> },
  {
    path: '/inicio',
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>,
  },
])
