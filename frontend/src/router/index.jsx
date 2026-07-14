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
import { BibliotecaChatPage } from '../pages/BibliotecaChatPage'
import { ManageSpecialistsPage } from '../pages/ManageSpecialistsPage'
import { LumiChatAdultosPage } from '../pages/LumiChatAdultosPage'
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage'
import { ResetPasswordPage }  from '../pages/ResetPasswordPage'
import { AdminPage } from '../pages/AdminPage'

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

function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-bg flex items-center justify-center">
        <p className="text-text-secondary text-base">Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/inicio" replace />
  return children
}

function ParentOnboardingGuard({ children }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.role !== 'parent') {
      setChecked(true)
      return
    }
    profilesApi.getMe()
      .then(res => {
        if (!res.data.child) {
          navigate('/perfil/nuevo-nino', { replace: true })
        } else {
          setChecked(true)
        }
      })
      .catch(() => setChecked(true))
  }, [user, navigate])

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
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password',  element: <ResetPasswordPage /> },
  { path: '/admin', element: <AdminRoute><AdminPage /></AdminRoute> },
  {
    path: '/perfil/nuevo-nino',
    element: <ProtectedRoute><ChildProfileForm /></ProtectedRoute>,
  },
  {
    path: '/perfil/nino/:childId/especialistas',
    element: <ProtectedRoute><ManageSpecialistsPage /></ProtectedRoute>,
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
  {
    path: '/biblioteca/consultar',
    element: <ProtectedRoute><BibliotecaChatPage /></ProtectedRoute>,
  },
  {
    path: '/lumi-chat',
    element: <ProtectedRoute><LumiChatAdultosPage /></ProtectedRoute>,
  },
])
