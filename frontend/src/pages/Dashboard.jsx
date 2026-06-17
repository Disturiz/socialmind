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
  { emoji: '😊', title: 'Selector emocional',   desc: 'Próximamente',  available: false },
  { emoji: '🤝', title: 'Escenarios sociales',  desc: 'Próximamente',  available: false },
  { emoji: '🧘', title: 'Zona de calma',        desc: 'Próximamente',  available: false },
]

export function Dashboard() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const firstName        = user?.full_name?.split(' ')[0] || 'Bienvenido'

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
            <p className="text-sm text-text-secondary">
              {ROLE_LABELS[user?.role] || 'Usuario'}
            </p>
          </div>
        </div>

        {/* Módulos */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-text-primary">Módulos</h2>
          {MODULE_CARDS.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="flex items-center gap-4 opacity-60">
                <span className="text-3xl">{mod.emoji}</span>
                <div>
                  <p className="font-bold text-text-primary text-sm">{mod.title}</p>
                  <p className="text-xs text-text-muted">{mod.desc}</p>
                </div>
              </Card>
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
