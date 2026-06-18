import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { LumiCharacter } from '../components/lumi/LumiCharacter'

const ROLE_LABELS = {
  parent:     'Familia',
  specialist: 'Especialista',
  admin:      'Administrador',
}

const MODULE_CARDS = [
  {
    emoji: '😊',
    title: 'Selector emocional',
    desc: '¿Cómo te sientes hoy?',
    available: true,
    path: '/emociones',
  },
  {
    emoji: '🤝',
    title: 'Escenarios sociales',
    desc: 'Practica situaciones del día a día',
    available: true,
    path: '/escenarios',
  },
  {
    emoji: '🦉',
    title: 'Chat con Lumi',
    desc: 'Conversa sobre cómo te sentís',
    available: true,
    path: '/chat',
  },
  {
    emoji: '🧘',
    title: 'Zona de calma',
    desc: 'Respira, pausa y calmáte',
    available: true,
    path: '/calma',
  },
]

const SPECIALIST_CARD = {
  emoji: '📊',
  title: 'Panel Profesional',
  desc: 'Historial de los niños',
  available: true,
  path: '/panel',
}

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const firstName        = user?.full_name?.split(' ')[0] || 'Bienvenido'

  const cards = user?.role === 'specialist'
    ? [...MODULE_CARDS, SPECIALIST_CARD]
    : MODULE_CARDS

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <PageWrapper className="px-6 py-10">
      <div className="max-w-lg mx-auto w-full flex flex-col gap-8">

        {/* Cabecera */}
        <div className="flex items-center gap-4">
          <LumiCharacter state="happy" size={80} />
          <div>
            <h1 className="text-xl font-extrabold text-primary-700">
              ¡Hola, {firstName}!
            </h1>
            <p className="text-base text-text-secondary">
              {ROLE_LABELS[user?.role] || 'Usuario'}
            </p>
          </div>
        </div>

        {/* Módulos */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">Módulos</h2>
          {cards.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {mod.available ? (
                <button
                  onClick={() => navigate(mod.path)}
                  className="
                    w-full flex items-center gap-4 p-5 rounded-3xl
                    bg-calm-surface border-2 border-calm-border
                    hover:border-primary-500 hover:bg-primary-50
                    transition-colors text-left min-h-[72px]
                  "
                  aria-label={`Ir a ${mod.title}`}
                >
                  <span className="text-3xl">{mod.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-text-primary text-base">{mod.title}</p>
                    <p className="text-base text-text-secondary">{mod.desc}</p>
                  </div>
                  <span className="text-text-muted text-xl">›</span>
                </button>
              ) : (
                <Card className="flex items-center gap-4 opacity-50">
                  <span className="text-3xl">{mod.emoji}</span>
                  <div>
                    <p className="font-bold text-text-primary text-base">{mod.title}</p>
                    <p className="text-base text-text-muted">{mod.desc}</p>
                  </div>
                </Card>
              )}
            </motion.div>
          ))}
        </div>

        <Button variant="ghost" onClick={handleLogout} className="self-start">
          Cerrar sesión
        </Button>
      </div>
    </PageWrapper>
  )
}
