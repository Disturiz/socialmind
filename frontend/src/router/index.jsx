import { useState, useEffect } from 'react'
import { createBrowserRouter, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { profilesApi } from '../services/api'
import { Welcome }           from '../pages/Welcome'
import { Login }             from '../pages/Login'
import { Register }          from '../pages/Register'
import { Dashboard }         from '../pages/Dashboard'
import { EmotionSelector }   from '../pages/EmotionSelector'
import { ScenarioList }      from '../pages/ScenarioList'
import { ScenarioFlow }      from '../pages/ScenarioFlow'
import { ChatIA }            from '../pages/ChatIA'
import { ZonaCalma }         from '../pages/ZonaCalma'
import { PanelProfesional }  from '../pages/PanelProfesional'
import { ChildDetail }       from '../pages/ChildDetail'
import { Biblioteca }        from '../pages/Biblioteca'
import { MiAventura }        from '../pages/MiAventura'
import { ChildProfileForm }  from '../pages/ChildProfileForm'

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

function SpecialistRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'specialist') return <Navigate to="/inicio" replace />
  return children
}

function ParentOnboardingGuard({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(user?.role !== 'parent')

  useEffect(() => {
    if (user?.role !== 'parent') return
    profilesApi.getMe()
      .then(res => {
        if (!res.data.child) {
          navigate('/perfil/nuevo-nino', { replace: true })
        } else {
          setChecked(true)
        }
      })
      .catch(() => setChecked(true))
  }, [user?.role, navigate])

  if (!checked) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  return children
}

export const router = createBrowserRouter([
  { path: '/',         element: <Welcome /> },
  { path: '/login',    element: <Login /> },
  { path: '/registro', element: <Register /> },
  {
    path: '/perfil/nuevo-nino',
    element: <ProtectedRoute><ChildProfileForm /></ProtectedRoute>,
  },
  {
    path: '/inicio',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><Dashboard /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/emociones',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><EmotionSelector /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/escenarios',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ScenarioList /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/escenarios/:scenarioId',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ScenarioFlow /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/chat',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ChatIA /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/calma',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><ZonaCalma /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/mi-aventura',
    element: (
      <ProtectedRoute>
        <ParentOnboardingGuard><MiAventura /></ParentOnboardingGuard>
      </ProtectedRoute>
    ),
  },
  {
    path: '/panel',
    element: <SpecialistRoute><PanelProfesional /></SpecialistRoute>,
  },
  {
    path: '/panel/ninos/:childId',
    element: <SpecialistRoute><ChildDetail /></SpecialistRoute>,
  },
  {
    path: '/biblioteca',
    element: <SpecialistRoute><Biblioteca /></SpecialistRoute>,
  },
])
